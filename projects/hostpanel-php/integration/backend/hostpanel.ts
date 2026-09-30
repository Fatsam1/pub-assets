// HostPanel service — Express route module for Priv8Hash.
// Mount in routes/index.ts as: router.use("/hostpanel", hostpanelRouter);
//
// Model (mirrors agent.ts): subscription is bought by an ATOMIC debit of
// users.balance (funded by the existing NOWPayments wallet). Every cPanel
// operation is gated on an active subscription AND ownership of the account.
//
// Auth: global middleware in app.ts sets req.userId. We use getUserId(req).
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getUserId } from "../middlewares/auth.js";
import * as whm from "../services/hostpanel/whm.js";
import * as cf from "../services/hostpanel/cloudflare.js";

const router: IRouter = Router();

const SERVER_IP = process.env.WHM_HOST || "169.58.26.102";

// ---------- small helpers ----------

type Row = Record<string, any>;
async function q(text: any): Promise<Row[]> {
  const r: any = await db.execute(text);
  return (r?.rows ?? r) as Row[];
}

// Active subscription for a user, or null. Also auto-expires stale rows.
async function getSubscription(userId: number): Promise<Row | null> {
  const rows = await q(sql`
    SELECT s.*, p.name AS plan_name, p.display_name, p.self_service,
           p.max_sites, p.max_domains, p.features, p.price_usd
    FROM hostpanel_subscriptions s
    JOIN hostpanel_plans p ON p.id = s.plan_id
    WHERE s.user_id = ${userId}
    LIMIT 1`);
  const sub = rows[0] ?? null;
  if (!sub) return null;
  // Honest expiry: active only while not past expires_at.
  const expired = sub.expires_at && new Date(sub.expires_at).getTime() < Date.now();
  if (expired && sub.status === "active") {
    await q(sql`UPDATE hostpanel_subscriptions SET status='expired', updated_at=now() WHERE id=${sub.id}`);
    sub.status = "expired";
  }
  return sub;
}

function isActive(sub: Row | null): boolean {
  return !!sub && sub.status === "active" &&
    (!sub.expires_at || new Date(sub.expires_at).getTime() >= Date.now());
}

// Guard: require an active subscription. Returns the sub, or sends 402 and returns null.
async function requireSub(req: Request, res: Response): Promise<Row | null> {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const sub = await getSubscription(userId);
  if (!isActive(sub)) {
    res.status(402).json({ error: "No active hosting subscription", code: "NO_SUBSCRIPTION" });
    return null;
  }
  return sub;
}

// Does this user own this cPanel account? (ownership lives in hostpanel_accounts.)
async function ownsAccount(userId: number, cpanelUser: string): Promise<Row | null> {
  const rows = await q(sql`
    SELECT * FROM hostpanel_accounts
    WHERE user_id = ${userId} AND cpanel_user = ${cpanelUser} AND status <> 'terminated'
    LIMIT 1`);
  return rows[0] ?? null;
}

async function notifyAdmin(text: string): Promise<void> {
  try {
    const token = process.env.TG_BOT_TOKEN;
    const chat = process.env.TG_ADMIN_CHAT_ID || process.env.TG_ALLOWED_CHAT_ID;
    if (!token || !chat) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
    });
  } catch { /* best-effort */ }
}

// ---------- coupons (shared promo_codes table, scope 'all' | 'hostpanel') ----------

// Look up a usable coupon for a hostpanel purchase. Returns the row or null.
// Valid = active, not expired, uses remaining, scope all/hostpanel.
async function findCoupon(code: string): Promise<Row | null> {
  const c = String(code ?? "").trim().toUpperCase();
  if (!c) return null;
  const rows = await q(sql`
    SELECT * FROM promo_codes
    WHERE upper(code) = ${c} AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_uses IS NULL OR used_count < max_uses)
      AND (scope IS NULL OR scope IN ('all','hostpanel'))
    LIMIT 1`);
  return rows[0] ?? null;
}

// Compute the discounted price for a coupon (never below 0). Returns { price, discount }.
function applyDiscount(price: number, coupon: Row | null): { price: number; discount: number } {
  if (!coupon) return { price, discount: 0 };
  let d = 0;
  if (Number(coupon.discount_pct) > 0) d += price * (Number(coupon.discount_pct) / 100);
  if (Number(coupon.discount_amount) > 0) d += Number(coupon.discount_amount);
  d = Math.min(price, Math.round(d * 100) / 100);
  return { price: Math.round((price - d) * 100) / 100, discount: d };
}

// Increment a coupon's usage after a successful charge.
async function consumeCoupon(couponId: number): Promise<void> {
  try { await q(sql`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ${couponId}`); } catch {}
}

// Is the caller an admin/superadmin? (role is loaded onto req.user in app.ts.)
function isAdmin(req: Request): boolean {
  const role = (req as any).user?.role;
  return role === "admin" || role === "superadmin";
}

// Guard: require admin. Returns true if OK, else sends 403 and returns false.
function requireAdmin(req: Request, res: Response): boolean {
  if (!getUserId(req)) { res.status(401).json({ error: "Unauthorized" }); return false; }
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access required" }); return false; }
  return true;
}

// Resolve a user by numeric id or email → { id } or null.
async function resolveUser(idOrEmail: string): Promise<Row | null> {
  const v = String(idOrEmail).trim();
  if (!v) return null;
  const rows = /^\d+$/.test(v)
    ? await q(sql`SELECT id, email FROM users WHERE id = ${Number(v)} LIMIT 1`)
    : await q(sql`SELECT id, email FROM users WHERE lower(email) = ${v.toLowerCase()} LIMIT 1`);
  return rows[0] ?? null;
}

// Decide the domain for a new cPanel. If the client gave a real domain, use it.
// If they gave nothing, mint a unique subdomain on the panel base — so hosting
// can be provisioned WITHOUT a domain, and a real domain linked later. This
// deliberately separates "buy hosting" from "own a domain".
function resolveNewDomain(raw: string, userId: number): { domain: string; isSub: boolean } {
  const base = process.env.HOSTPANEL_BASE || "courtfidral-services.online";
  const cleaned = String(raw ?? "").toLowerCase().trim()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (cleaned && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleaned)) {
    const isSub = cleaned.endsWith("." + base) || cleaned === base;
    return { domain: cleaned, isSub };
  }
  // No/invalid domain → auto subdomain: u<id>-<rand>.<base>
  const rand = Math.random().toString(36).slice(2, 7);
  return { domain: `u${userId}-${rand}.${base}`, isSub: true };
}

// Provision a cPanel for a target user. Shared by client self-service and admin.
// Records ownership before the slow createacct so a timeout can't orphan it.
async function provisionCpanel(opts: {
  ownerUserId: number; planId: number | null; rawDomain: string;
  email: string; managed: boolean;
}): Promise<{ domain: string; user: string; password: string; ip: string; needsLink: boolean }> {
  const { domain, isSub } = resolveNewDomain(opts.rawDomain, opts.ownerUserId);
  const cpanelUser = whm.genUsername(domain);
  const password = whm.genPassword();

  await q(sql`
    INSERT INTO hostpanel_accounts (user_id, cpanel_user, domain, plan_id, status, managed, created_at)
    VALUES (${opts.ownerUserId}, ${cpanelUser}, ${domain}, ${opts.planId}, 'active', ${opts.managed}, now())`);
  try {
    const acct: any = await whm.whmCreateAccount(domain, cpanelUser, password, opts.email);
    return { domain, user: cpanelUser, password, ip: acct?.ip ?? SERVER_IP, needsLink: !isSub };
  } catch (e) {
    await q(sql`DELETE FROM hostpanel_accounts WHERE cpanel_user = ${cpanelUser} AND user_id = ${opts.ownerUserId}`);
    throw e;
  }
}

// ============================================================
// PLANS + SUBSCRIPTION
// ============================================================

// Public-ish: list the plans a client can buy.
router.get("/plans", async (_req, res) => {
  const rows = await q(sql`
    SELECT id, name, display_name, price_usd, self_service, max_sites, max_domains, features
    FROM hostpanel_plans WHERE is_active = true ORDER BY sort_order`);
  res.json({ plans: rows });
});

// Current user's subscription + entitlement summary.
router.get("/subscription", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const sub = await getSubscription(userId);
  const accounts = await q(sql`
    SELECT id, cpanel_user, domain, status, managed, created_at
    FROM hostpanel_accounts WHERE user_id = ${userId} AND status <> 'terminated'
    ORDER BY created_at DESC`);
  res.json({ subscription: sub, active: isActive(sub), accounts });
});

// Buy / renew a subscription. Atomic debit of users.balance (like rdp.ts).
router.post("/subscribe", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const planName = String(req.body?.plan ?? "");
  const planRows = await q(sql`SELECT * FROM hostpanel_plans WHERE name = ${planName} AND is_active = true LIMIT 1`);
  const plan = planRows[0];
  if (!plan) return res.status(400).json({ error: "Unknown plan" });

  // Optional coupon: discount the price before charging.
  const coupon = req.body?.coupon ? await findCoupon(String(req.body.coupon)) : null;
  if (req.body?.coupon && !coupon) return res.status(400).json({ error: "Invalid or expired coupon" });
  const { price, discount } = applyDiscount(Number(plan.price_usd), coupon);

  // Atomic check + deduct (prevents double-spend race).
  if (price > 0) {
    const deduct = await q(sql`
      UPDATE users SET balance = balance - ${price}
      WHERE id = ${userId} AND balance >= ${price}
      RETURNING id, balance`);
    if (deduct.length === 0) {
      const cur = await q(sql`SELECT balance FROM users WHERE id = ${userId}`);
      return res.status(402).json({
        error: "Insufficient balance", needed: price,
        current: Number(cur[0]?.balance ?? 0), code: "INSUFFICIENT_BALANCE",
      });
    }
  }
  if (coupon) await consumeCoupon(coupon.id);

  // Upsert subscription: 30-day window from now, extend if renewing before expiry.
  await q(sql`
    INSERT INTO hostpanel_subscriptions (user_id, plan_id, status, started_at, expires_at, updated_at)
    VALUES (${userId}, ${plan.id}, 'active', now(), now() + interval '30 days', now())
    ON CONFLICT (user_id) DO UPDATE SET
      plan_id    = ${plan.id},
      status     = 'active',
      started_at = COALESCE(hostpanel_subscriptions.started_at, now()),
      expires_at = GREATEST(COALESCE(hostpanel_subscriptions.expires_at, now()), now()) + interval '30 days',
      updated_at = now()`);

  // Record an order for the books (product_type 'hostpanel'), including any coupon.
  try {
    await q(sql`
      INSERT INTO orders (user_id, plan, product_type, amount, discount, final_amount, currency, status, promo_code, paid_at, created_at)
      VALUES (${userId}, ${plan.name}, 'hostpanel', ${Number(plan.price_usd)}, ${discount}, ${price}, 'USD', 'paid', ${coupon?.code ?? null}, now(), now())`);
  } catch { /* orders shape may differ; non-fatal */ }

  // Notify user + admin.
  try {
    await q(sql`
      INSERT INTO notifications (user_id, title, message, type, created_at)
      VALUES (${userId}, 'Hosting subscription active',
              ${'Your ' + plan.display_name + ' plan is now active for 30 days.'}, 'success', now())`);
  } catch { /* notifications shape may differ; non-fatal */ }
  notifyAdmin(`🖥️ HostPanel: user #${userId} subscribed to ${plan.display_name} ($${price}).`);

  const sub = await getSubscription(userId);
  res.json({ ok: true, subscription: sub });
});

// ============================================================
// STATUS + ACCOUNTS
// ============================================================

// Connectivity check (WHM + Cloudflare reachable). Gated on subscription.
router.get("/status", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  const out: any = { whm: false, cloudflare: false, serverIp: SERVER_IP, errors: [] as string[] };
  try { await whm.whmListAccounts(); out.whm = true; } catch (e: any) { out.errors.push("WHM: " + e.message); }
  try { await cf.cfListZones(); out.cloudflare = true; } catch (e: any) { out.errors.push("Cloudflare: " + e.message); }
  res.json(out);
});

// The user's own cPanel accounts (from our ownership table, enriched with live WHM data).
router.get("/accounts", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  const userId = getUserId(req)!;
  const owned = await q(sql`
    SELECT cpanel_user, domain, status, managed FROM hostpanel_accounts
    WHERE user_id = ${userId} AND status <> 'terminated'`);
  // Enrich with live suspended/ip state (best-effort).
  let live: any[] = [];
  try { live = await whm.whmListAccounts(); } catch { /* offline: return stored */ }
  const byUser = new Map(live.map((a: any) => [a.user, a]));
  const accounts = owned.map((o: Row) => {
    const l = byUser.get(o.cpanel_user);
    return { user: o.cpanel_user, domain: o.domain, managed: o.managed,
             ip: l?.ip ?? SERVER_IP, suspended: l?.suspended ?? (o.status === "suspended"),
             plan: l?.plan ?? "" };
  });
  res.json({ accounts, selfService: !!sub.self_service });
});

// ============================================================
// PROVISIONING (self-service plans only; managed => admin does it)
// ============================================================

function isSelfService(sub: Row): boolean { return !!sub.self_service; }

// Create a cPanel for THIS user, within their plan's site limit.
// Domain is OPTIONAL — omit it to get an auto subdomain now and link a real
// domain later (hosting and domain are separate steps).
router.post("/create-cpanel", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  const userId = getUserId(req)!;
  if (!isSelfService(sub))
    return res.status(403).json({ error: "Your plan is managed — our team provisions your hosting. Open a ticket." });

  const email = String(req.body?.contactemail ?? "").trim();

  // Enforce plan site limit.
  const used = await q(sql`
    SELECT count(*)::int AS n FROM hostpanel_accounts
    WHERE user_id = ${userId} AND status <> 'terminated'`);
  if (Number(used[0]?.n ?? 0) >= Number(sub.max_sites))
    return res.status(403).json({ error: `Plan limit reached (${sub.max_sites} site(s)). Upgrade to add more.` });

  try {
    const cp = await provisionCpanel({
      ownerUserId: userId, planId: sub.plan_id, rawDomain: String(req.body?.domain ?? ""),
      email, managed: false,
    });
    res.json({ ok: true, cpanel: cp });
    notifyAdmin(`🖥️ HostPanel: user #${userId} created cPanel ${cp.user} (${cp.domain}).`);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Auto-login URL into cPanel (no password prompt).
router.post("/cpanel-login", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  const userId = getUserId(req)!;
  const cu = String(req.body?.cpanelUser ?? "").replace(/[^a-z0-9_]/gi, "");
  if (!(await ownsAccount(userId, cu))) return res.status(403).json({ error: "not your account" });
  const url = await whm.whmLoginUrl(cu);
  if (!url) return res.status(500).json({ error: "could not create session" });
  res.json({ ok: true, url });
});

// ============================================================
// DOMAIN LINKING + PROTECTION
// ============================================================

// Link a real domain to a cPanel: add zone to Cloudflare, point DNS, SPF/DKIM/DMARC,
// full protection bundle + anti-bot + rate-limit + DNSSEC. Returns nameservers.
router.post("/link-domain", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  const userId = getUserId(req)!;
  if (!isSelfService(sub))
    return res.status(403).json({ error: "Your plan is managed — our team links domains for you." });

  let domain = String(req.body?.domain ?? "").toLowerCase().trim()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const cpanelUser = String(req.body?.cpanelUser ?? "").replace(/[^a-z0-9_]/gi, "");
  const email = String(req.body?.contactemail ?? "").trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))
    return res.status(400).json({ error: "Enter a valid domain" });
  if (cpanelUser && !(await ownsAccount(userId, cpanelUser)))
    return res.status(403).json({ error: "not your account" });

  const log: string[] = [];
  const step = (m: string) => log.push(m);
  const result: any = { domain, log };
  try {
    step(`Adding ${domain} to Cloudflare…`);
    const zone: any = await cf.cfAddZone(domain);
    result.zone = { id: zone.id, nameservers: zone.name_servers ?? [] };
    step("✓ Nameservers: " + ((zone.name_servers ?? []).join(", ") || "(pending)"));
    if (cpanelUser) {
      step(`Attaching ${domain} to cPanel ${cpanelUser}…`);
      try { await whm.whmAddAddon(cpanelUser, domain); step("✓ Added as addon domain"); }
      catch (e: any) { step("⚠ Addon step skipped: " + e.message); }
    }
    step(`Pointing ${domain} → ${SERVER_IP}…`);
    await cf.cfPointToServer(zone.id, domain, SERVER_IP);
    step("✓ A records set (root + www, proxied)");
    step("Writing SPF + DMARC…");
    await cf.cfSetSpf(zone.id, domain, SERVER_IP);
    await cf.cfSetDmarc(zone.id, domain, email);
    step("✓ SPF + DMARC set (p=none for warm-up)");
    if (cpanelUser) {
      step("Setting up DKIM…");
      try {
        await whm.whmEnsureDkim(cpanelUser, domain);
        const dk = await whm.whmGetDkimTxt(domain);
        if (dk) { await cf.cfSetDkim(zone.id, dk.name, dk.value); result.dkim = "published:" + dk.name; step("✓ DKIM published"); }
        else { result.dkim = "no-key-found"; step("⚠ DKIM key not found (skipped)"); }
      } catch (e: any) { result.dkim = "error"; step("⚠ DKIM skipped: " + e.message); }
    }
    step("Applying protection (SSL, TLS1.3, HSTS, bots, hotlink)…");
    result.protection = await cf.cfApplyProtection(zone.id);
    result.botFight = await cf.cfEnableBotFight(zone.id);
    result.antibot = await cf.cfApplyAntibot(zone.id);
    result.ratelimit = await cf.cfApplyRatelimit(zone.id);
    result.dnssec = await cf.cfEnableDnssec(zone.id);
    step("✓ Anti-bot + rate-limit + DNSSEC applied");
    step("DONE — set the nameservers above at your registrar.");
    result.ok = true;
    res.json(result);
  } catch (e: any) {
    step("✗ ERROR: " + e.message);
    res.status(500).json({ ok: false, error: e.message, log, zone: result.zone ?? null });
  }
});

// Real Cloudflare nameservers + honest live/pending/no-ssl status for a domain.
router.get("/zone-ns", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  let domain = String(req.query?.domain ?? "").toLowerCase().trim()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const s = await cf.cfSmartStatus(domain);
  res.json({ ok: true, nameservers: s.nameservers, status: s.status, detail: s.detail });
});

// Protection state (toggles UI).
router.get("/protection", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  const userId = getUserId(req)!;
  const cu = String(req.query?.cpanelUser ?? "").replace(/[^a-z0-9_]/gi, "");
  const acct = await ownsAccount(userId, cu);
  if (!acct) return res.status(403).json({ error: "not your account" });
  const zone: any = await cf.cfZoneForDomain(acct.domain);
  if (!zone) return res.json({ ok: true, domain: acct.domain, onCloudflare: false, state: null });
  const state: any = await cf.cfProtectionState(zone.id);
  state.dmarc = await cf.cfGetDmarcPolicy(zone.id, acct.domain);
  res.json({ ok: true, domain: acct.domain, onCloudflare: true, zoneId: zone.id, state });
});

// Toggle one protection setting.
router.post("/protection", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  const userId = getUserId(req)!;
  const cu = String(req.body?.cpanelUser ?? "").replace(/[^a-z0-9_]/gi, "");
  const acct = await ownsAccount(userId, cu);
  if (!acct) return res.status(403).json({ error: "not your account" });
  const key = String(req.body?.key ?? "");
  const value = String(req.body?.value ?? "");
  const allowed = ["security_level", "ssl", "always_use_https", "browser_check", "hotlink_protection"];
  if (!allowed.includes(key)) return res.status(400).json({ error: "invalid setting" });
  const zone: any = await cf.cfZoneForDomain(acct.domain);
  if (!zone) return res.status(400).json({ error: "domain not on Cloudflare yet" });
  await cf.cfSetSetting(zone.id, key, value);
  res.json({ ok: true, state: await cf.cfProtectionState(zone.id) });
});

// Re-apply anti-bot / rate-limit; advance DMARC; publish DKIM; blocklist check; captcha.
function protectionAction(handler: (zone: any, acct: Row) => Promise<any>) {
  return async (req: Request, res: Response) => {
    const sub = await requireSub(req, res); if (!sub) return;
    const userId = getUserId(req)!;
    const cu = String(req.body?.cpanelUser ?? req.query?.cpanelUser ?? "").replace(/[^a-z0-9_]/gi, "");
    const acct = await ownsAccount(userId, cu);
    if (!acct) return res.status(403).json({ error: "not your account" });
    const zone: any = await cf.cfZoneForDomain(acct.domain);
    if (!zone) return res.status(400).json({ error: "domain not on Cloudflare yet" });
    try { res.json(await handler(zone, acct)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  };
}

router.post("/antibot-apply", protectionAction(async (zone) => {
  const r = await cf.cfApplyAntibot(zone.id);
  return { ok: String(r).startsWith("antibot=on"), antibot: r, state: await cf.cfProtectionState(zone.id) };
}));
router.post("/ratelimit-apply", protectionAction(async (zone) => {
  const r = await cf.cfApplyRatelimit(zone.id);
  return { ok: String(r).startsWith("ratelimit=on"), ratelimit: r, state: await cf.cfProtectionState(zone.id) };
}));
router.post("/dmarc-advance", protectionAction(async (zone, acct) => {
  const p = await cf.cfAdvanceDmarc(zone.id, acct.domain, "");
  return { ok: true, dmarc: p };
}));
router.post("/dkim-apply", protectionAction(async (zone, acct) => {
  await whm.whmEnsureDkim(acct.cpanel_user, acct.domain);
  const dk = await whm.whmGetDkimTxt(acct.domain);
  if (!dk) throw new Error("DKIM key not found on server");
  await cf.cfSetDkim(zone.id, dk.name, dk.value);
  return { ok: true, dkim: dk.name };
}));
router.get("/blocklist-check", protectionAction(async (_zone, acct) => {
  const report = await cf.blocklistReport(acct.domain, SERVER_IP);
  return { ok: true, report };
}));

// captcha needs the body flag — define it explicitly (the wrapper hides req.body).
router.post("/captcha-set", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  const userId = getUserId(req)!;
  const cu = String(req.body?.cpanelUser ?? "").replace(/[^a-z0-9_]/gi, "");
  const acct = await ownsAccount(userId, cu);
  if (!acct) return res.status(403).json({ error: "not your account" });
  const zone: any = await cf.cfZoneForDomain(acct.domain);
  if (!zone) return res.status(400).json({ error: "domain not on Cloudflare yet" });
  const on = !!req.body?.on;
  await cf.cfSetUnderAttack(zone.id, on);
  res.json({ ok: true, captcha: on ? "on" : "off" });
});

// ============================================================
// ACCOUNT MANAGEMENT (reset / suspend / fix-perms / terminate)
// ============================================================

router.post("/reset-password", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  const userId = getUserId(req)!;
  const cu = String(req.body?.cpanelUser ?? "").replace(/[^a-z0-9_]/gi, "");
  if (!(await ownsAccount(userId, cu))) return res.status(403).json({ error: "not your account" });
  const password = await whm.whmResetPassword(cu);
  res.json({ ok: true, password });
});

router.post("/suspend", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  const userId = getUserId(req)!;
  const cu = String(req.body?.cpanelUser ?? "").replace(/[^a-z0-9_]/gi, "");
  if (!(await ownsAccount(userId, cu))) return res.status(403).json({ error: "not your account" });
  const on = !!req.body?.on;
  await whm.whmSuspend(cu, on);
  await q(sql`UPDATE hostpanel_accounts SET status=${on ? "suspended" : "active"} WHERE cpanel_user=${cu} AND user_id=${userId}`);
  res.json({ ok: true, suspended: on });
});

router.post("/fix-permissions", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  const userId = getUserId(req)!;
  const cu = String(req.body?.cpanelUser ?? "").replace(/[^a-z0-9_]/gi, "");
  if (!(await ownsAccount(userId, cu))) return res.status(403).json({ error: "not your account" });
  const fixed = await whm.whmFixPermissions(cu);
  const n = (fixed.dirs?.length ?? 0) + (fixed.files?.length ?? 0);
  res.json({ ok: true, fixed, note: n === 0 ? "All permissions already correct." : `Fixed ${n} item(s).` });
});

router.post("/terminate", async (req, res) => {
  const sub = await requireSub(req, res); if (!sub) return;
  const userId = getUserId(req)!;
  const cu = String(req.body?.cpanelUser ?? "").replace(/[^a-z0-9_]/gi, "");
  if (!(await ownsAccount(userId, cu))) return res.status(403).json({ error: "not your account" });
  await whm.whmTerminate(cu);
  await q(sql`UPDATE hostpanel_accounts SET status='terminated' WHERE cpanel_user=${cu} AND user_id=${userId}`);
  res.json({ ok: true });
});

// ============================================================
// SUBSCRIPTION LIFECYCLE — cancel / auto-renew toggle / change plan / invoices
// ============================================================

// Toggle auto-renew, or cancel outright. Body: { autoRenew?: boolean, cancel?: boolean }
// - cancel:true      → status stays active until expiry, but auto_renew off (no charge, no immediate cutoff).
// - autoRenew: bool  → just flips the auto-renew flag.
router.post("/cancel", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const sub = await getSubscription(userId);
  if (!sub) return res.status(404).json({ error: "No subscription" });

  if (req.body?.cancel === true) {
    await q(sql`UPDATE hostpanel_subscriptions SET auto_renew = false, updated_at = now() WHERE id = ${sub.id}`);
    try {
      await q(sql`
        INSERT INTO notifications (user_id, title, message, type, created_at)
        VALUES (${userId}, 'Auto-renew cancelled',
                ${'Your hosting will stay active until ' + (sub.expires_at ? new Date(sub.expires_at).toDateString() : 'expiry') + ', then stop. You can re-enable anytime.'},
                'info', now())`);
    } catch {}
    return res.json({ ok: true, autoRenew: false, activeUntil: sub.expires_at });
  }

  const on = !!req.body?.autoRenew;
  await q(sql`UPDATE hostpanel_subscriptions SET auto_renew = ${on}, updated_at = now() WHERE id = ${sub.id}`);
  res.json({ ok: true, autoRenew: on });
});

// Change plan (upgrade/downgrade). Charges only the positive price difference
// (prorated by the fraction of the cycle remaining), keeps the same expiry date.
// A downgrade costs nothing now; the lower price applies at the next renewal.
router.post("/change-plan", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const sub = await getSubscription(userId);
  if (!isActive(sub)) return res.status(402).json({ error: "No active subscription" });

  const target = String(req.body?.plan ?? "");
  const planRows = await q(sql`SELECT * FROM hostpanel_plans WHERE name = ${target} AND is_active = true LIMIT 1`);
  const newPlan = planRows[0];
  if (!newPlan) return res.status(400).json({ error: "Unknown plan" });
  if (Number(newPlan.id) === Number(sub.plan_id)) return res.status(400).json({ error: "Already on this plan" });

  // Downgrading below current usage isn't allowed (would strand existing sites).
  const used = await q(sql`SELECT count(*)::int n FROM hostpanel_accounts WHERE user_id=${userId} AND status<>'terminated'`);
  if (Number(used[0]?.n ?? 0) > Number(newPlan.max_sites))
    return res.status(400).json({ error: `You have ${used[0].n} sites; ${newPlan.display_name} allows only ${newPlan.max_sites}. Remove sites first.` });

  const oldPrice = Number(sub.price_usd);
  const newPrice = Number(newPlan.price_usd);
  const isUpgrade = newPrice > oldPrice;

  // Optional coupon on the upgrade charge.
  const coupon = req.body?.coupon ? await findCoupon(String(req.body.coupon)) : null;
  if (req.body?.coupon && !coupon) return res.status(400).json({ error: "Invalid or expired coupon" });

  let charged = 0, discount = 0, gross = 0;
  if (isUpgrade) {
    // prorate the price difference by remaining fraction of the 30-day cycle
    const msLeft = sub.expires_at ? Math.max(0, new Date(sub.expires_at).getTime() - Date.now()) : 0;
    const frac = Math.min(1, msLeft / (30 * 86400000));
    gross = Math.round((newPrice - oldPrice) * frac * 100) / 100;
    const dd = applyDiscount(gross, coupon);
    charged = dd.price; discount = dd.discount;
    if (charged > 0) {
      const deduct = await q(sql`
        UPDATE users SET balance = balance - ${charged}
        WHERE id = ${userId} AND balance >= ${charged} RETURNING id`);
      if (deduct.length === 0) {
        const cur = await q(sql`SELECT balance FROM users WHERE id=${userId}`);
        return res.status(402).json({ error: "Insufficient balance", needed: charged, current: Number(cur[0]?.balance ?? 0), code: "INSUFFICIENT_BALANCE" });
      }
    }
    if (coupon && discount > 0) await consumeCoupon(coupon.id);
  }

  await q(sql`UPDATE hostpanel_subscriptions SET plan_id = ${newPlan.id}, updated_at = now() WHERE id = ${sub.id}`);
  if (gross > 0) {
    try {
      await q(sql`
        INSERT INTO orders (user_id, plan, product_type, amount, discount, final_amount, currency, status, promo_code, paid_at, created_at)
        VALUES (${userId}, ${newPlan.name}, 'hostpanel', ${gross}, ${discount}, ${charged}, 'USD', 'paid', ${coupon?.code ?? null}, now(), now())`);
    } catch {}
  }
  try {
    await q(sql`
      INSERT INTO notifications (user_id, title, message, type, created_at)
      VALUES (${userId}, ${isUpgrade ? "Plan upgraded" : "Plan changed"},
              ${'You are now on ' + newPlan.display_name + (charged > 0 ? ` ($${charged} prorated charge).` : '. The new rate applies at your next renewal.')},
              'success', now())`);
  } catch {}
  const fresh = await getSubscription(userId);
  res.json({ ok: true, charged, upgrade: isUpgrade, subscription: fresh });
});

// Payment history for hosting (from the orders ledger).
router.get("/invoices", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const rows = await q(sql`
    SELECT id, plan, amount, discount, final_amount, currency, status, promo_code, paid_at, created_at
    FROM orders WHERE user_id = ${userId} AND product_type = 'hostpanel'
    ORDER BY created_at DESC LIMIT 100`);
  res.json({ invoices: rows });
});

// Validate a coupon and preview the discount on a plan (before paying).
// GET /coupon?code=XX&plan=pro
router.get("/coupon", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const coupon = await findCoupon(String(req.query?.code ?? ""));
  if (!coupon) return res.status(404).json({ ok: false, error: "Invalid or expired coupon" });
  const planName = String(req.query?.plan ?? "");
  let preview: any = null;
  if (planName) {
    const p = await q(sql`SELECT price_usd, display_name FROM hostpanel_plans WHERE name = ${planName} LIMIT 1`);
    if (p[0]) {
      const { price, discount } = applyDiscount(Number(p[0].price_usd), coupon);
      preview = { plan: p[0].display_name, original: Number(p[0].price_usd), discount, final: price };
    }
  }
  res.json({ ok: true, code: coupon.code, discount_pct: coupon.discount_pct, discount_amount: coupon.discount_amount, preview });
});

// ============================================================
// ADMIN — provision & oversee cPanels for clients (managed/enterprise)
// Gated on req.user.role in (admin, superadmin). Admins bypass the
// per-user subscription and self-service checks.
// ============================================================

// Every hostpanel account across all users, with owner info (admin view).
router.get("/admin/accounts", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = await q(sql`
    SELECT a.cpanel_user, a.domain, a.status, a.managed, a.created_at,
           a.user_id, u.email AS owner_email, u.name AS owner_name,
           p.name AS plan_name
    FROM hostpanel_accounts a
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN hostpanel_plans p ON p.id = a.plan_id
    WHERE a.status <> 'terminated'
    ORDER BY a.created_at DESC`);
  // Enrich with live suspended/ip (best-effort).
  let live: any[] = [];
  try { live = await whm.whmListAccounts(); } catch { /* offline */ }
  const byUser = new Map(live.map((l: any) => [l.user, l]));
  const accounts = rows.map((r: Row) => ({
    user: r.cpanel_user, domain: r.domain, status: r.status, managed: r.managed,
    ownerId: r.user_id, ownerEmail: r.owner_email, ownerName: r.owner_name,
    plan: r.plan_name, ip: byUser.get(r.cpanel_user)?.ip ?? SERVER_IP,
    suspended: byUser.get(r.cpanel_user)?.suspended ?? (r.status === "suspended"),
  }));
  res.json({ accounts });
});

// Admin creates a cPanel. `forUser` (email or id, optional) assigns it to that
// client; if omitted, it's owned by the admin. Domain is optional (auto subdomain).
router.post("/admin/create-cpanel", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const adminId = getUserId(req)!;

  // Resolve owner: the named client, or the admin themselves.
  let ownerId = adminId;
  const forUser = String(req.body?.forUser ?? "").trim();
  if (forUser) {
    const target = await resolveUser(forUser);
    if (!target) return res.status(404).json({ error: `No user found for "${forUser}"` });
    ownerId = target.id;
  }

  // Plan: use the owner's active hostpanel subscription plan if any, else null.
  const subRows = await q(sql`
    SELECT plan_id FROM hostpanel_subscriptions
    WHERE user_id = ${ownerId} AND status = 'active' LIMIT 1`);
  const planId = subRows[0]?.plan_id ?? null;

  try {
    const cp = await provisionCpanel({
      ownerUserId: ownerId, planId, rawDomain: String(req.body?.domain ?? ""),
      email: String(req.body?.contactemail ?? "").trim(),
      managed: ownerId !== adminId, // provisioned FOR a client = managed
    });
    res.json({ ok: true, cpanel: cp, ownerId });
    notifyAdmin(`🛠️ HostPanel admin #${adminId} created cPanel ${cp.user} (${cp.domain}) for user #${ownerId}.`);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin can act on ANY account (login/suspend/reset/terminate) by cpanel_user.
router.post("/admin/action", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const cu = String(req.body?.cpanelUser ?? "").replace(/[^a-z0-9_]/gi, "");
  const action = String(req.body?.action ?? "");
  const rows = await q(sql`SELECT * FROM hostpanel_accounts WHERE cpanel_user = ${cu} AND status <> 'terminated' LIMIT 1`);
  if (!rows[0]) return res.status(404).json({ error: "account not found" });
  try {
    switch (action) {
      case "login": {
        const url = await whm.whmLoginUrl(cu);
        return res.json({ ok: !!url, url });
      }
      case "reset": {
        const password = await whm.whmResetPassword(cu);
        return res.json({ ok: true, password });
      }
      case "suspend":
      case "resume": {
        const on = action === "suspend";
        await whm.whmSuspend(cu, on);
        await q(sql`UPDATE hostpanel_accounts SET status=${on ? "suspended" : "active"} WHERE cpanel_user=${cu}`);
        return res.json({ ok: true, suspended: on });
      }
      case "terminate": {
        await whm.whmTerminate(cu);
        await q(sql`UPDATE hostpanel_accounts SET status='terminated' WHERE cpanel_user=${cu}`);
        return res.json({ ok: true });
      }
      case "assign": {
        // reassign ownership to another client (email or id)
        const target = await resolveUser(String(req.body?.forUser ?? ""));
        if (!target) return res.status(404).json({ error: "target user not found" });
        await q(sql`UPDATE hostpanel_accounts SET user_id=${target.id}, managed=true WHERE cpanel_user=${cu}`);
        return res.json({ ok: true, ownerId: target.id });
      }
      default:
        return res.status(400).json({ error: "unknown action" });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ADMIN — coupons + reports
// ============================================================

// List all hostpanel-usable coupons.
router.get("/admin/coupons", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = await q(sql`
    SELECT id, code, discount_pct, discount_amount, max_uses, used_count, is_active, scope, expires_at, created_at
    FROM promo_codes WHERE scope IN ('all','hostpanel') OR scope IS NULL
    ORDER BY created_at DESC LIMIT 200`);
  res.json({ coupons: rows });
});

// Create a coupon. Body: { code, discount_pct?, discount_amount?, max_uses?, expires_at?, scope? }
router.post("/admin/coupons", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return res.status(400).json({ error: "Code must be 3-32 chars (A-Z, 0-9, -, _)" });
  const pct = Math.max(0, Math.min(100, Number(req.body?.discount_pct ?? 0)));
  const amt = Math.max(0, Number(req.body?.discount_amount ?? 0));
  if (pct === 0 && amt === 0) return res.status(400).json({ error: "Set a percent or amount discount" });
  const maxUses = req.body?.max_uses ? Math.max(1, Number(req.body.max_uses)) : 100;
  const scope = req.body?.scope === "all" ? "all" : "hostpanel";
  const expiresAt = req.body?.expires_at ? new Date(req.body.expires_at) : null;

  // reject duplicate code
  const dup = await q(sql`SELECT id FROM promo_codes WHERE upper(code) = ${code} LIMIT 1`);
  if (dup[0]) return res.status(400).json({ error: "A coupon with this code already exists" });

  const ins = await q(sql`
    INSERT INTO promo_codes (code, discount_pct, discount_amount, max_uses, used_count, is_active, scope, expires_at, created_at)
    VALUES (${code}, ${pct}, ${amt}, ${maxUses}, 0, true, ${scope}, ${expiresAt}, now())
    RETURNING id, code`);
  res.json({ ok: true, coupon: ins[0] });
});

// Activate/deactivate a coupon. Body: { id, active }
router.post("/admin/coupons/toggle", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.body?.id);
  const active = !!req.body?.active;
  if (!id) return res.status(400).json({ error: "need coupon id" });
  await q(sql`UPDATE promo_codes SET is_active = ${active} WHERE id = ${id}`);
  res.json({ ok: true, id, active });
});

// Admin report: subscriptions, revenue, accounts, plan mix.
router.get("/admin/report", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const subs = await q(sql`
    SELECT p.name AS plan, count(*)::int AS n,
           count(*) FILTER (WHERE s.status='active')::int AS active,
           count(*) FILTER (WHERE s.status='grace')::int AS grace,
           count(*) FILTER (WHERE s.status='expired')::int AS expired
    FROM hostpanel_subscriptions s JOIN hostpanel_plans p ON p.id = s.plan_id
    GROUP BY p.name ORDER BY p.name`);

  const accounts = await q(sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE status='active')::int AS active,
           count(*) FILTER (WHERE status='suspended')::int AS suspended,
           count(*) FILTER (WHERE managed=true)::int AS managed
    FROM hostpanel_accounts WHERE status <> 'terminated'`);

  const revenue = await q(sql`
    SELECT
      COALESCE(sum(final_amount),0)::numeric AS total,
      COALESCE(sum(final_amount) FILTER (WHERE created_at > now() - interval '30 days'),0)::numeric AS last30,
      COALESCE(sum(discount),0)::numeric AS discounts_given,
      count(*)::int AS orders
    FROM orders WHERE product_type='hostpanel' AND status='paid'`);

  const activeSubs = await q(sql`
    SELECT count(*)::int AS n FROM hostpanel_subscriptions
    WHERE status='active' AND (expires_at IS NULL OR expires_at > now())`);

  // Monthly recurring revenue estimate = sum of active subs' plan prices.
  const mrr = await q(sql`
    SELECT COALESCE(sum(p.price_usd),0)::numeric AS mrr
    FROM hostpanel_subscriptions s JOIN hostpanel_plans p ON p.id = s.plan_id
    WHERE s.status='active' AND (s.expires_at IS NULL OR s.expires_at > now())`);

  const topCoupons = await q(sql`
    SELECT code, used_count, discount_pct, discount_amount, is_active
    FROM promo_codes WHERE used_count > 0 ORDER BY used_count DESC LIMIT 10`);

  res.json({
    subscriptions: { byPlan: subs, activeTotal: Number(activeSubs[0]?.n ?? 0) },
    accounts: accounts[0] ?? {},
    revenue: {
      total: Number(revenue[0]?.total ?? 0),
      last30: Number(revenue[0]?.last30 ?? 0),
      discountsGiven: Number(revenue[0]?.discounts_given ?? 0),
      orders: Number(revenue[0]?.orders ?? 0),
      mrr: Number(mrr[0]?.mrr ?? 0),
    },
    topCoupons,
  });
});

// ============================================================
// ADMIN — custom plans (create / edit / toggle)
// ============================================================

// All plans, including inactive ones (admin view).
router.get("/admin/plans", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = await q(sql`
    SELECT id, name, display_name, price_usd, self_service, max_sites, max_domains, features, sort_order, is_active
    FROM hostpanel_plans ORDER BY sort_order, id`);
  res.json({ plans: rows });
});

// Create a new plan, or edit an existing one (pass id to edit).
// Body: { id?, name, display_name, price_usd, self_service?, max_sites?, max_domains?, sort_order? }
router.post("/admin/plans", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const b = req.body ?? {};
  const displayName = String(b.display_name ?? "").trim();
  const price = Math.max(0, Number(b.price_usd ?? 0));
  const selfService = b.self_service !== false;
  const maxSites = Math.max(1, Number(b.max_sites ?? 1));
  const maxDomains = Math.max(1, Number(b.max_domains ?? 1));
  const sortOrder = Number(b.sort_order ?? 0);
  const features = b.features && typeof b.features === "object" ? b.features : {};

  if (b.id) {
    // edit — name is immutable (it's the machine key), everything else updatable
    const upd = await q(sql`
      UPDATE hostpanel_plans SET
        display_name = ${displayName}, price_usd = ${price}, self_service = ${selfService},
        max_sites = ${maxSites}, max_domains = ${maxDomains}, sort_order = ${sortOrder},
        features = ${JSON.stringify(features)}::jsonb
      WHERE id = ${Number(b.id)} RETURNING id, name`);
    if (!upd[0]) return res.status(404).json({ error: "Plan not found" });
    return res.json({ ok: true, plan: upd[0], edited: true });
  }

  // create — needs a unique machine name
  const name = String(b.name ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!/^[a-z0-9_-]{2,50}$/.test(name)) return res.status(400).json({ error: "Name must be 2-50 chars (a-z, 0-9, -, _)" });
  if (!displayName) return res.status(400).json({ error: "Display name required" });
  const dup = await q(sql`SELECT id FROM hostpanel_plans WHERE name = ${name} LIMIT 1`);
  if (dup[0]) return res.status(400).json({ error: "A plan with this name already exists" });
  const ins = await q(sql`
    INSERT INTO hostpanel_plans (name, display_name, price_usd, self_service, max_sites, max_domains, features, sort_order, is_active)
    VALUES (${name}, ${displayName}, ${price}, ${selfService}, ${maxSites}, ${maxDomains}, ${JSON.stringify(features)}::jsonb, ${sortOrder}, true)
    RETURNING id, name`);
  res.json({ ok: true, plan: ins[0], edited: false });
});

// Show/hide a plan (soft-delete). Body: { id, active }
router.post("/admin/plans/toggle", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.body?.id);
  const active = !!req.body?.active;
  if (!id) return res.status(400).json({ error: "need plan id" });
  // guard: don't hide a plan that has active subscribers
  if (!active) {
    const subs = await q(sql`SELECT count(*)::int n FROM hostpanel_subscriptions WHERE plan_id = ${id} AND status = 'active'`);
    if (Number(subs[0]?.n ?? 0) > 0)
      return res.status(400).json({ error: `${subs[0].n} active subscriber(s) on this plan. Move them first.` });
  }
  await q(sql`UPDATE hostpanel_plans SET is_active = ${active} WHERE id = ${id}`);
  res.json({ ok: true, id, active });
});

// ADMIN — Cloudflare zones list (for admin dashboard overview).
router.get("/admin/cf-zones", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rawZones = await cf.cfListZones();
    // Fetch cPanel accounts for cpanelUser lookup
    const accounts = await q(sql`SELECT domain, cpanel_user FROM hostpanel_accounts WHERE managed = true`);
    const domainToUser: Record<string, string> = {};
    for (const a of accounts) domainToUser[(a as any).domain] = (a as any).cpanel_user;
    // Enrich zones: map name->domain, add ssl setting + cpanelUser; parallel with per-zone timeout
    const zones = await Promise.all(rawZones.map(async (z: any) => {
      let ssl = 'unknown';
      try {
        const sslSetting = await Promise.race([
          cf.cfCall(`/zones/${z.id}/settings/ssl`),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]) as any;
        ssl = (sslSetting as any)?.value ?? 'unknown';
      } catch { /* ignore */ }
      const cpanelUser = domainToUser[z.name] || '';
      return { ...z, domain: z.name, ssl, cpanelUser };
    }));
    res.json({ ok: true, zones });
  } catch (e: any) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ADMIN — All subscriptions with user info.
router.get("/admin/subscriptions", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = await q(sql`
    SELECT s.id, s.user_id, u.email AS user_email, u.name AS user_name,
           p.name AS plan_name, p.display_name, p.price_usd,
           s.status, s.auto_renew, s.started_at, s.expires_at, s.grace_until, s.updated_at
    FROM hostpanel_subscriptions s
    JOIN hostpanel_plans p ON p.id = s.plan_id
    JOIN users u ON u.id = s.user_id
    ORDER BY s.updated_at DESC`);
  res.json({ ok: true, subscriptions: rows });
});

// ============================================================
// ADMIN — export report as CSV
// ============================================================
router.get("/admin/export", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const kind = String(req.query?.kind ?? "orders");
  let rows: Row[] = [];
  let headers: string[] = [];
  if (kind === "subscriptions") {
    rows = await q(sql`
      SELECT s.id, u.email AS user_email, p.name AS plan, s.status, s.auto_renew,
             s.started_at, s.expires_at
      FROM hostpanel_subscriptions s
      JOIN hostpanel_plans p ON p.id = s.plan_id
      JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC`);
    headers = ["id", "user_email", "plan", "status", "auto_renew", "started_at", "expires_at"];
  } else {
    // orders (revenue ledger)
    rows = await q(sql`
      SELECT o.id, u.email AS user_email, o.plan, o.amount, o.discount, o.final_amount,
             o.currency, o.status, o.promo_code, o.paid_at
      FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.product_type = 'hostpanel'
      ORDER BY o.created_at DESC`);
    headers = ["id", "user_email", "plan", "amount", "discount", "final_amount", "currency", "status", "promo_code", "paid_at"];
  }
  // build CSV (escape quotes/commas)
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="hostpanel-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

export default router;
