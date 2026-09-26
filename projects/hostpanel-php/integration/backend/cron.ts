import { sendDailyReport } from "../routes/telegram.js";
import { db } from "@workspace/db";
import { serversTable, domainsTable, usersTable, notificationsTable } from "@workspace/db/schema";
import { eq, lte, and, sql } from "drizzle-orm";
import { sendTelegram } from "./telegram.js";
import { request as httpsRequest, Agent as HttpsAgent } from "node:https";
import { sendEmail, emailTemplate } from "./email.js";

export function startCronJobs(): void {
  // Daily report at 9:00 AM UTC
  scheduleDailyAt(9, 0, async () => {
    console.log("[CRON] Sending daily report...");
    await sendDailyReport();
    await checkExpiringServers();
    await checkExpiringDomains();
    try { await checkHostpanelSubscriptions(); } catch (e) { console.error("[CRON] hostpanel subs failed (non-fatal):", e); }
  });

  console.log("[CRON] Jobs scheduled: daily report + expiry checks + hostpanel renewals");
}

function scheduleDailyAt(hour: number, minute: number, fn: () => Promise<void>): void {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(hour, minute, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const delay = next.getTime() - now.getTime();
  setTimeout(async () => {
    await fn();
    setInterval(fn, 24 * 60 * 60 * 1000);
  }, delay);
}

async function checkExpiringServers(): Promise<void> {
  const in7days = new Date();
  in7days.setDate(in7days.getDate() + 7);
  const expiring = await db.select().from(serversTable).where(and(eq(serversTable.status, "running"), lte(serversTable.expires_at, in7days)));
  for (const server of expiring) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, server.user_id)).limit(1);
    if (!user) continue;
    const daysLeft = Math.ceil((new Date(server.expires_at!).getTime() - Date.now()) / 86400000);
    await db.insert(notificationsTable).values({ user_id: user.id, title: "Server Expiring Soon", message: `Server ${server.name} expires in ${daysLeft} days. Renew to avoid interruption.`, type: "warning" });
    if (user.telegram_id) {
      await sendTelegram(user.telegram_id, `⚠️ <b>Server Expiring in ${daysLeft} days!</b>\n\nServer: <b>${server.name}</b>\nIP: ${server.ip}\n\nRenew at: https://privatehash.online/dashboard/hosting`);
    }
  }
}

async function checkExpiringDomains(): Promise<void> {
  const in30days = new Date();
  in30days.setDate(in30days.getDate() + 30);
  const expiring = await db.select().from(domainsTable).where(and(eq(domainsTable.status, "active"), lte(domainsTable.expires_at, in30days)));
  for (const domain of expiring) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, domain.user_id)).limit(1);
    if (!user) continue;
    const daysLeft = Math.ceil((new Date(domain.expires_at!).getTime() - Date.now()) / 86400000);
    await db.insert(notificationsTable).values({ user_id: user.id, title: "Domain Expiring Soon", message: `Domain ${domain.name} expires in ${daysLeft} days.`, type: "warning" });
    if (user.telegram_id) {
      await sendTelegram(user.telegram_id, `⚠️ <b>Domain Expiring in ${daysLeft} days!</b>\n\nDomain: <b>${domain.name}</b>\n\nRenew at: https://privatehash.online/dashboard/domains`);
    }
  }
}

// ===== HostPanel subscription lifecycle (auto-renew + expiry warnings) =====
// Appended to services/cron.ts. Uses raw SQL because hostpanel_* tables live
// outside the Drizzle schema (same pattern as routes/hostpanel.ts).
// Run once a day from startCronJobs().
//
// Flow:
//  1) Warn: active subs expiring within 3 days → notify (once, tracked by renew_warned_at).
//  2) Renew: active sub past expires_at → try to debit the plan price from wallet.
//       success → extend 30 days, notify "renewed".
//       fail    → enter 3-day GRACE (service stays up), notify "top up".
//  3) Grace end: grace sub past grace_until → mark expired + SUSPEND all its cPanels + notify.

export async function checkHostpanelSubscriptions(): Promise<void> {
  const rows = (await db.execute(sql`
    SELECT s.id, s.user_id, s.plan_id, s.status, s.expires_at, s.grace_until, s.renew_warned_at,
           p.name AS plan_name, p.display_name, p.price_usd,
           u.balance, u.telegram_id
    FROM hostpanel_subscriptions s
    JOIN hostpanel_plans p ON p.id = s.plan_id
    JOIN users u ON u.id = s.user_id
    WHERE s.status IN ('active','grace')`) as any).rows as any[];

  const now = Date.now();
  const site = "https://privatehash.online/dashboard/hosting-panel";

  for (const s of rows) {
    const price = Number(s.price_usd);
    const expires = s.expires_at ? new Date(s.expires_at).getTime() : 0;
    const graceUntil = s.grace_until ? new Date(s.grace_until).getTime() : 0;

    // ---- 1) upcoming-expiry warning (active, 3 days out, not yet warned this cycle) ----
    if (s.status === "active" && expires > now) {
      const daysLeft = Math.ceil((expires - now) / 86400000);
      const warnedAt = s.renew_warned_at ? new Date(s.renew_warned_at).getTime() : 0;
      const warnedThisCycle = warnedAt > expires - 4 * 86400000; // warned within this cycle's window
      if (daysLeft <= 3 && !warnedThisCycle) {
        const enough = Number(s.balance) >= price;
        const msg = enough
          ? `Your ${s.display_name} hosting renews in ${daysLeft} day(s). $${price} will be taken from your wallet automatically.`
          : `Your ${s.display_name} hosting renews in ${daysLeft} day(s) but your balance ($${Number(s.balance).toFixed(2)}) is below the $${price} needed. Top up to avoid interruption.`;
        await notifyUser(s.user_id, s.telegram_id, "Hosting renews soon", msg, enough ? "info" : "warning", site);
        await db.execute(sql`UPDATE hostpanel_subscriptions SET renew_warned_at = now() WHERE id = ${s.id}`);
      }
      continue; // not due yet
    }

    // ---- 2) due for renewal (active and past expiry) → try to auto-renew ----
    if (s.status === "active" && expires <= now) {
      // atomic debit
      const deduct = (await db.execute(sql`
        UPDATE users SET balance = balance - ${price}
        WHERE id = ${s.user_id} AND balance >= ${price}
        RETURNING id`) as any).rows;
      if (deduct.length > 0) {
        await db.execute(sql`
          UPDATE hostpanel_subscriptions
          SET expires_at = expires_at + interval '30 days', renew_warned_at = NULL, status = 'active', grace_until = NULL, updated_at = now()
          WHERE id = ${s.id}`);
        await db.execute(sql`
          INSERT INTO orders (user_id, plan, product_type, amount, final_amount, currency, status, paid_at, created_at)
          VALUES (${s.user_id}, ${s.plan_name}, 'hostpanel', ${price}, ${price}, 'USD', 'paid', now(), now())`);
        await notifyUser(s.user_id, s.telegram_id, "Hosting renewed",
          `Your ${s.display_name} hosting was renewed for 30 days ($${price} charged).`, "success", site);
      } else {
        // not enough balance → enter 3-day grace
        await db.execute(sql`
          UPDATE hostpanel_subscriptions
          SET status = 'grace', grace_until = now() + interval '3 days', updated_at = now()
          WHERE id = ${s.id}`);
        await notifyUser(s.user_id, s.telegram_id, "Hosting payment failed",
          `We couldn't renew your ${s.display_name} hosting — balance $${Number(s.balance).toFixed(2)}, needed $${price}. Your sites stay up for 3 more days. Top up to keep them running.`,
          "warning", site);
      }
      continue;
    }

    // ---- 3) in grace: retry, else expire + suspend after grace_until ----
    if (s.status === "grace") {
      // retry the debit each day of grace
      const deduct = (await db.execute(sql`
        UPDATE users SET balance = balance - ${price}
        WHERE id = ${s.user_id} AND balance >= ${price}
        RETURNING id`) as any).rows;
      if (deduct.length > 0) {
        await db.execute(sql`
          UPDATE hostpanel_subscriptions
          SET status='active', expires_at = now() + interval '30 days', grace_until = NULL, renew_warned_at = NULL, updated_at = now()
          WHERE id = ${s.id}`);
        await db.execute(sql`
          INSERT INTO orders (user_id, plan, product_type, amount, final_amount, currency, status, paid_at, created_at)
          VALUES (${s.user_id}, ${s.plan_name}, 'hostpanel', ${price}, ${price}, 'USD', 'paid', now(), now())`);
        await notifyUser(s.user_id, s.telegram_id, "Hosting renewed",
          `Thanks — your ${s.display_name} hosting is renewed for 30 days ($${price} charged).`, "success", site);
      } else if (graceUntil && graceUntil <= now) {
        // grace expired → mark expired + suspend all their cPanels
        await db.execute(sql`UPDATE hostpanel_subscriptions SET status='expired', updated_at=now() WHERE id = ${s.id}`);
        const accts = (await db.execute(sql`
          SELECT cpanel_user FROM hostpanel_accounts WHERE user_id = ${s.user_id} AND status = 'active'`) as any).rows as any[];
        let suspended = 0;
        for (const a of accts) {
          try { await whmSuspendForCron(a.cpanel_user, true); suspended++;
            await db.execute(sql`UPDATE hostpanel_accounts SET status='suspended' WHERE cpanel_user = ${a.cpanel_user}`);
          } catch { /* best-effort */ }
        }
        await notifyUser(s.user_id, s.telegram_id, "Hosting suspended",
          `Your ${s.display_name} hosting was suspended after the 3-day grace period (unpaid). Top up and resubscribe to restore ${suspended} site(s).`,
          "danger", site);
      }
      // else: still within grace, sites stay up (already warned)
    }
  }
}

// Notify helper: a notifications row + optional Telegram DM.
async function notifyUser(userId: number, telegramId: string | null, title: string, message: string, type: string, link: string): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO notifications (user_id, title, message, type, created_at)
      VALUES (${userId}, ${title}, ${message}, ${type}::notif_type, now())`);
  } catch { /* type enum mismatch → non-fatal */ }
  if (telegramId) {
    const emoji = type === "success" ? "✅" : type === "danger" ? "🛑" : "⚠️";
    try { await sendTelegram(telegramId, `${emoji} <b>${title}</b>\n\n${message}\n\n${link}`); } catch { /* best-effort */ }
  }
  // Email the user too (best-effort).
  try {
    const rows: any = await db.execute(sql`SELECT email FROM users WHERE id = ${userId} LIMIT 1`);
    const email = (rows.rows ?? rows)[0]?.email;
    if (email) {
      const body = `<p>${message}</p><a class="btn" href="${link}">Open Hosting Panel</a>`;
      await sendEmail(email, title, emailTemplate(title, body));
    }
  } catch { /* best-effort */ }
}

// Suspend a cPanel from the cron context (mirrors whmSuspend in the hostpanel service).
async function whmSuspendForCron(cpanelUser: string, on: boolean): Promise<void> {
  const host = process.env.WHM_HOST || "54.38.221.66";
  const user = process.env.WHM_USER || "streamfl";
  const token = process.env.WHM_API_TOKEN || "";
  const fn = on ? "suspendacct" : "unsuspendacct";
  const url = `https://${host}:2087/json-api/${fn}?api.version=1&user=${encodeURIComponent(cpanelUser)}`;
  await new Promise<void>((resolve, reject) => {
    const req = httpsRequest(
      { hostname: host, port: 2087, path: url.split(":2087")[1], method: "GET",
        headers: { Authorization: `whm ${user}:${token}` },
        agent: new HttpsAgent({ rejectUnauthorized: false }), timeout: 60000 },
      (res) => { res.on("data", () => {}); res.on("end", () => resolve()); }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(new Error("timeout")); });
    req.end();
  });
}
