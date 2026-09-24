<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>HostPanel</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#070b14;--bg2:#0d1220;
    --surface:rgba(255,255,255,0.035);--surface2:rgba(255,255,255,0.06);
    --line:rgba(255,255,255,0.07);--line2:rgba(255,255,255,0.12);
    --ink:#e2e8f0;--ink2:#94a3b8;--ink3:#64748b;
    --accent:#00d4ff;--accent-soft:rgba(0,212,255,0.08);
    --good:#00ff88;--good-soft:rgba(0,255,136,0.08);
    --warn:#fbbf24;--crit:#ff4466;--crit-soft:rgba(255,68,102,0.08);
    --mono:ui-monospace,"Cascadia Code","Roboto Mono",Menlo,Consolas,monospace;
    --sans:'Inter',system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    --glow-cy:0 0 20px rgba(0,212,255,0.4);--glow-gn:0 0 20px rgba(0,255,136,0.4);
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.55}
  .wrap{max-width:900px;margin:0 auto;padding:28px 20px 80px;position:relative;z-index:1}
  header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:16px;margin-bottom:22px;background:linear-gradient(135deg,rgba(0,212,255,0.03),transparent);border-radius:12px 12px 0 0}
  h1{font-size:22px;font-weight:900;margin:0;letter-spacing:-0.5px}
  h1 span{background:linear-gradient(135deg,var(--accent),#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .who{font-family:var(--mono);font-size:11px;color:var(--ink3)}
  .status{display:flex;gap:8px;font-family:var(--mono);font-size:11px;align-items:center}
  .dot{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;background:var(--surface2);border:1px solid var(--line);color:var(--ink3);font-size:11px;font-weight:600}
  .dot i{width:7px;height:7px;border-radius:50%;background:var(--ink3)}
  .dot.up i{background:var(--good);box-shadow:0 0 6px rgba(0,255,136,0.6);animation:dotblink 2s ease-in-out infinite}
  .dot.up{color:var(--good);border-color:rgba(0,255,136,0.25)}
  .dot.down i{background:var(--crit)}.dot.down{color:var(--crit);border-color:rgba(255,68,102,0.25)}
  @keyframes dotblink{0%,100%{opacity:1}50%{opacity:.4}}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px;margin-bottom:16px;transition:border-color .2s,box-shadow .2s;backdrop-filter:blur(8px)}
  .card:hover{border-color:var(--line2);box-shadow:0 4px 24px rgba(0,0,0,0.3)}
  .card h2{font-size:15px;margin:0 0 4px;font-weight:700}.card p.hint{color:var(--ink3);font-size:13px;margin:0 0 14px}
  label{display:block;font-size:11px;color:var(--ink2);margin:0 0 6px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.5px}
  input,select{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:var(--ink);padding:11px 14px;font-size:13px;font-family:var(--sans);transition:all .2s}
  input:focus,select:focus{outline:none;border-color:rgba(0,212,255,0.45);background:rgba(0,212,255,0.04);box-shadow:0 0 0 3px rgba(0,212,255,0.08)}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.row{grid-template-columns:1fr}}
  button{margin-top:14px;background:linear-gradient(135deg,var(--accent),#0070ff);color:#fff;border:0;border-radius:10px;padding:11px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--sans);transition:all .2s;box-shadow:0 4px 14px rgba(0,212,255,0.25)}
  button:hover{box-shadow:0 4px 20px rgba(0,212,255,0.45);transform:translateY(-1px)}
  button:disabled{opacity:.5;cursor:progress;transform:none;box-shadow:none}
  button.ghost{background:var(--surface2);color:var(--ink2);border:1px solid var(--line);box-shadow:none}
  button.ghost:hover{background:rgba(255,255,255,0.08);box-shadow:none;transform:none}
  button.sm{padding:6px 14px;font-size:12px;margin:0;border-radius:8px}
  button.danger{background:var(--crit-soft);color:var(--crit);border:1px solid rgba(255,68,102,0.3);box-shadow:none}
  button.danger:hover{background:rgba(255,68,102,0.15);box-shadow:none;transform:none}
  .log{font-family:var(--mono);font-size:12.5px;background:rgba(0,0,0,0.3);border:1px solid var(--line);border-radius:10px;padding:13px;margin-top:14px;white-space:pre-wrap;color:var(--ink2);max-height:300px;overflow:auto}
  .log .ok{color:var(--good)}.log .err{color:var(--crit)}.log .done{color:var(--accent);font-weight:600}.log .warn{color:var(--warn)}
  .result{background:var(--good-soft);border:1px solid rgba(0,255,136,0.25);border-radius:10px;padding:13px;margin-top:12px;font-family:var(--mono);font-size:12.5px}
  .result b{color:var(--ink)}.result .warn{color:var(--warn)}.result.fail{background:var(--crit-soft);border-color:rgba(255,68,102,0.3)}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:4px}
  th{color:var(--ink3);font-weight:700;text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);text-transform:uppercase;font-size:9px;letter-spacing:1px}
  td{padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.03)}
  tr:hover td{background:rgba(255,255,255,0.02)}
  td.mono{font-family:var(--mono);font-size:12px}
  .pill{font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700}
  .pill.on{background:rgba(0,255,136,0.1);color:var(--good);border:1px solid rgba(0,255,136,0.25)}
  .pill.off{background:rgba(255,68,102,0.1);color:var(--crit);border:1px solid rgba(255,68,102,0.2)}
  .pill.admin{background:rgba(0,212,255,0.1);color:var(--accent);border:1px solid rgba(0,212,255,0.25)}
  .pill.user{background:var(--surface2);color:var(--ink2)}
  .tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
  .tab{padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:var(--ink2);background:var(--surface2);border:1px solid var(--line);transition:all .2s}
  .tab:hover{color:var(--ink);border-color:var(--line2)}
  .tab.active{background:rgba(0,212,255,0.1);color:var(--accent);border-color:rgba(0,212,255,0.35);box-shadow:0 0 12px rgba(0,212,255,0.2)}
  .hidden{display:none}a{color:var(--accent)}
  /* cPanel cards grid */
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
  .site{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
  .site:hover{border-color:rgba(0,212,255,0.4);box-shadow:0 4px 20px rgba(0,0,0,0.3);transform:translateY(-2px)}
  .site .d{font-weight:700;font-size:14px;word-break:break-all;color:var(--ink)}
  .site .u{font-family:var(--mono);font-size:11px;color:var(--ink3);margin-top:4px}
  .site .s{margin-top:10px}
  .back{background:none;border:0;color:var(--accent);cursor:pointer;font-size:13px;padding:0;margin:0 0 14px;font-family:var(--sans);box-shadow:none;transform:none}
  .back:hover{box-shadow:none;transform:none;text-decoration:underline}
  /* toggle */
  .toggle-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line)}
  .toggle-row:last-child{border-bottom:0}
  .toggle-row .t{font-size:14px;font-weight:500}.toggle-row .d{font-size:12px;color:var(--ink3)}
  .sw{position:relative;width:44px;height:24px;flex:0 0 auto}
  .sw input{opacity:0;width:0;height:0}
  .sw span{position:absolute;inset:0;background:var(--surface2);border:1px solid var(--line);border-radius:20px;transition:.2s;cursor:pointer}
  .sw span:before{content:"";position:absolute;height:16px;width:16px;left:3px;top:3px;background:var(--ink3);border-radius:50%;transition:.2s}
  .sw input:checked+span{background:rgba(0,212,255,0.15);border-color:var(--accent)}
  .sw input:checked+span:before{transform:translateX(20px);background:var(--accent)}
  /* overview cards */
  .ov-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;transition:all .2s;position:relative;overflow:hidden}
  .ov-card:hover{border-color:var(--line2);box-shadow:0 4px 20px rgba(0,0,0,.3)}
  .ov-card .ov-domain{font-weight:700;font-size:13px;word-break:break-all;color:var(--ink);margin-bottom:3px}
  .ov-card .ov-user{font-family:var(--mono);font-size:10px;color:var(--ink3);margin-bottom:10px}
  .ov-card .ov-pills{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}
  .ov-card .ov-actions{display:flex;gap:6px;flex-wrap:wrap}
  .ov-card .ov-actions button{margin:0;padding:5px 10px;font-size:11px;border-radius:7px}
  .ov-disk{margin:0 0 10px}
  .ov-disk-label{display:flex;justify-content:space-between;font-size:10px;color:var(--ink3);margin-bottom:3px}
  .ov-disk-track{height:5px;background:var(--line);border-radius:3px;overflow:hidden}
  .ov-disk-fill{height:100%;border-radius:3px;transition:width .4s}
  .pill.bot-ver{background:rgba(88,166,255,.15);color:#58a6ff;border:1px solid rgba(88,166,255,.3);font-family:var(--mono)}
  #ov-search{background:var(--surface);border:1px solid var(--line);border-radius:8px;color:var(--ink);font-size:13px;outline:none}
  #ov-search:focus{border-color:var(--line2)}
  .pill.cf-active{background:rgba(0,255,136,.1);color:var(--good);border:1px solid rgba(0,255,136,.25)}
  .pill.cf-pending{background:rgba(251,191,36,.1);color:var(--warn);border:1px solid rgba(251,191,36,.25)}
  .pill.cf-unknown{background:var(--surface2);color:var(--ink3);border:1px solid var(--line)}
  .pill.bot-yes{background:rgba(0,212,255,.1);color:var(--accent);border:1px solid rgba(0,212,255,.25)}
  .pill.bot-no{background:var(--surface2);color:var(--ink3);border:1px solid var(--line)}
  /* login */
  .login-wrap{max-width:400px;margin:11vh auto 0;position:relative;z-index:1}
  .login-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:34px 30px;text-align:center;backdrop-filter:blur(16px)}
  .login-card h1{margin-bottom:6px}.login-card p{color:var(--ink3);font-size:13px;margin:0 0 20px}
  .login-card input{text-align:center;font-size:16px;letter-spacing:.05em;margin-bottom:12px}
  .login-note{margin-top:14px;font-size:12px;font-family:var(--mono);min-height:16px}
  .login-note.err{color:var(--crit)}.login-note.ok{color:var(--good)}
</style>
</head>
<body>

<!-- LOGIN -->
<div id="login" class="login-wrap hidden">
  <div class="login-card">
    <h1>Host<span>Panel</span></h1>
    <p>Sign in with your Telegram chat ID</p>
    <div id="step1">
      <input id="in-chatid" placeholder="your Telegram chat ID" inputmode="numeric" autocomplete="off"/>
      <button id="btn-code" style="width:100%">Send login code</button>
    </div>
    <div id="step2" class="hidden">
      <input id="in-code" placeholder="6-digit code" inputmode="numeric" maxlength="6" autocomplete="off"/>
      <button id="btn-verify" style="width:100%">Verify &amp; sign in</button>
      <button id="btn-back" class="ghost" style="width:100%;margin-top:8px">← use another ID</button>
    </div>
    <div class="login-note" id="login-note"></div>
    <p style="margin-top:18px;font-size:11px">Press <b>Start</b> on <a href="https://t.me/FSantibot" target="_blank">@FSantibot</a> first.</p>
  </div>
</div>

<!-- APP -->
<div class="wrap hidden" id="app">
  <header>
    <div><h1>Host<span>Panel</span></h1><div class="who" id="who"></div></div>
    <div class="status">
      <span class="dot" id="s-whm"><i></i> WHM</span>
      <span class="dot" id="s-cf"><i></i> CF</span>
      <button class="ghost sm" id="logout">Logout</button>
    </div>
  </header>

  <div class="tabs" id="main-tabs">
    <div class="tab" data-tab="overview" id="tab-btn-overview">📊 Overview</div>
    <div class="tab active" data-tab="sites">My sites</div>
    <div class="tab hidden" data-tab="create" id="tab-btn-create">+ New cPanel</div>
    <div class="tab hidden" data-tab="users" id="tab-btn-users">Users</div>
  </div>

  <!-- OVERVIEW (all cPanels at a glance) -->
  <section id="tab-overview" class="hidden">
    <div class="card" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <div>
        <div style="font-weight:700;font-size:15px">All cPanels — live status</div>
        <div style="font-size:12px;color:var(--ink3)" id="ov-summary">Loading…</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="ov-refresh" class="sm ghost" style="margin:0">↺ Refresh</button>
        <button id="ov-deploy-all" class="sm" style="margin:0">🚀 Deploy to all</button>
        <button id="ov-update-all" class="sm ghost" style="margin:0">⬆ Update all bots</button>
      </div>
    </div>
    <div style="margin-bottom:12px">
      <input id="ov-search" placeholder="🔍 Search domain or user…" style="max-width:320px;padding:8px 12px;font-size:13px" oninput="ovFilter(this.value)">
    </div>
    <div id="ov-grid" class="grid"></div>
    <div id="ov-bulk-log" class="log hidden" style="margin-top:12px"></div>
  </section>

  <!-- MY SITES (list of cPanels) -->
  <section id="tab-sites">
    <div id="sites-empty" class="card hidden"><p class="hint" style="margin:0">No cPanel accounts yet. <span id="empty-hint"></span></p></div>
    <div class="grid" id="sites-grid"></div>
  </section>

  <!-- SINGLE SITE MANAGEMENT -->
  <section id="tab-site" class="hidden">
    <button class="back" id="site-back">← back to my sites</button>
    <div class="card" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div><div style="font-weight:600" id="site-domain"></div><div class="who" id="site-user"></div></div>
      <button id="site-open" class="sm">Open cPanel →</button>
    </div>
    <div class="tabs" id="site-tabs">
      <div class="tab active" data-stab="open">Open / Redirect</div>
      <div class="tab" data-stab="domains">Domains</div>
      <div class="tab" data-stab="protection">Protection</div>
      <div class="tab" data-stab="captcha">Captcha</div>
      <div class="tab" data-stab="manage">Manage</div>
      <div class="tab" data-stab="botcontrol">🤖 Bot Control</div>
    </div>

    <div id="stab-open" class="card">
      <h2>Open this cPanel</h2>
      <p class="hint">One click signs you straight into cPanel — no password needed.</p>
      <button id="btn-redirect">Open cPanel now →</button>
      <div id="open-note" class="log hidden"></div>
    </div>

    <div id="stab-domains" class="hidden">
      <div class="card"><p class="hint" id="domains-status" style="margin:0">…</p></div>
      <div class="card hidden" id="link-card">
        <h2>Link a domain to this cPanel</h2>
        <p class="hint">Add a domain you own. It's added to Cloudflare (you'll get nameservers), pointed at the server, attached here, and protected — automatically.</p>
        <div class="row">
          <div><label>Domain</label><input id="d-domain" placeholder="mynewdomain.com" autocomplete="off" spellcheck="false"/></div>
          <div><label>Contact email (DMARC)</label><input id="d-email" placeholder="you@example.com" autocomplete="off"/></div>
        </div>
        <button id="d-go">Link + protect</button>
        <div id="d-log" class="log hidden"></div><div id="d-result"></div>
      </div>
      <div class="card" id="change-card">
        <h2>Change this cPanel's main domain</h2>
        <p class="hint">Move this account to a different domain. Takes effect immediately.</p>
        <div><label>New main domain</label><input id="cd-domain" placeholder="newdomain.com" autocomplete="off" spellcheck="false"/></div>
        <button id="cd-go" class="ghost">Change main domain</button>
        <div id="cd-note" class="log hidden"></div>
      </div>
    </div>

    <div id="stab-protection" class="card hidden">
      <h2>Protection layers</h2>
      <p class="hint">Turn Cloudflare protection on/off for this site's domain.</p>
      <div id="prot-body"><p class="hint">Loading…</p></div>
    </div>

    <div id="stab-captcha" class="card hidden">
      <h2>Captcha (Cloudflare challenge)</h2>
      <p class="hint">Show a Cloudflare challenge to visitors before they reach the site. Good against bots; may add friction for real users.</p>
      <div class="toggle-row">
        <div><div class="t">Captcha / Under-Attack challenge</div><div class="d" id="cap-state">…</div></div>
        <label class="sw"><input type="checkbox" id="cap-toggle"><span></span></label>
      </div>
      <div id="cap-note" class="log hidden"></div>
    </div>

    <div id="stab-botcontrol" class="hidden">
      <div class="card">
        <h2>🤖 Bot Control</h2>
        <p class="hint">Deploy the download-redirect bot to this cPanel, configure Telegram tokens, and access the bot dashboard in one click — no second login needed.</p>

        <div style="margin-bottom:18px;padding:14px;background:rgba(0,212,255,0.04);border:1px solid rgba(0,212,255,0.15);border-radius:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-weight:700;font-size:14px">Bot Deployment Status</div>
              <div id="bc-status-text" style="font-size:12px;color:var(--ink3);margin-top:3px">Checking…</div>
            </div>
            <span id="bc-status-pill" class="pill" style="font-size:11px">…</span>
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
          <button id="bc-deploy" class="sm" style="margin:0">🚀 Deploy bot files</button>
          <button id="bc-deploy-bridge" class="sm" style="margin:0;background:linear-gradient(135deg,#7c3aed,#4f46e5)">🌉 Deploy Bridge</button>
          <button id="bc-dashboard" class="sm ghost" style="margin:0">📊 Open Dashboard →</button>
        </div>

        <div style="border-top:1px solid var(--line);padding-top:16px;margin-top:4px">
          <div style="font-weight:700;font-size:13px;margin-bottom:12px">Telegram Bot Tokens</div>
          <div class="row">
            <div><label>Control Bot Token</label><input id="bc-ctrl-token" placeholder="bot token…" autocomplete="off" spellcheck="false"/></div>
            <div><label>Visits Bot Token</label><input id="bc-vis-token" placeholder="bot token…" autocomplete="off" spellcheck="false"/></div>
          </div>
          <button id="bc-save-tokens" class="sm" style="margin-top:10px">💾 Save Tokens</button>
        </div>

        <div id="bc-note" class="log hidden" style="margin-top:14px"></div>
      </div>
    </div>

    <div id="stab-manage" class="card hidden">
      <h2>Manage this cPanel</h2>
      <p class="hint">Reset the password, suspend/resume, share with another user, transfer ownership, or delete.</p>

      <div class="toggle-row">
        <div><div class="t">Reset cPanel password</div><div class="d">Generate a new password and show it once.</div></div>
        <button class="sm" id="mg-reset">Reset password</button>
      </div>
      <div class="toggle-row">
        <div><div class="t">Fix file permissions</div><div class="d">Repairs locked folders/files (0555) that cause "Permission denied" when editing or uploading. Sets folders to 755, files to 644.</div></div>
        <button class="sm" id="mg-fixperms">Fix permissions</button>
      </div>
      <div class="toggle-row">
        <div><div class="t">Suspend / resume</div><div class="d">Temporarily disable the account without deleting it.</div></div>
        <label class="sw"><input type="checkbox" id="mg-suspend"><span></span></label>
      </div>

      <div style="margin-top:16px"><label>Transfer ownership to (chat ID)</label>
        <div style="display:flex;gap:8px"><input id="mg-transfer-id" placeholder="123456789" inputmode="numeric"/><button class="sm ghost" id="mg-transfer" style="white-space:nowrap">Transfer</button></div>
        <p class="hint" style="margin-top:6px">Moves the account to another user. You'll lose access (unless admin).</p>
      </div>

      <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px">
        <label>Share access (Telegram chat ID)</label>
        <p class="hint" style="margin-bottom:8px">Add a user to co-manage this cPanel's bot dashboard. They'll be auto-added to the system and notified via Telegram. Enter their name (optional) for the user list.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="mg-share-id" placeholder="123456789" inputmode="numeric" style="flex:1;min-width:140px"/>
          <input id="mg-share-name" placeholder="Name (optional)" style="flex:1;min-width:130px"/>
          <button class="sm ghost" id="mg-share-add" style="white-space:nowrap">➕ Share</button>
        </div>
        <div id="mg-shares-list" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px"></div>
      </div>

      <div style="margin-top:20px;border-top:1px solid var(--crit);padding-top:14px">
        <label style="color:var(--crit)">Danger zone</label>
        <div class="toggle-row" style="border:0;padding-top:6px">
          <div><div class="t">Delete this cPanel</div><div class="d">Permanent. Removes the account, its files, and databases. Admin only.</div></div>
          <button class="sm danger" id="mg-delete">Delete</button>
        </div>
      </div>
      <div id="mg-note" class="log hidden"></div>
    </div>
  </section>

  <!-- CREATE CPANEL (admin) -->
  <section id="tab-create" class="hidden">
    <div class="card">
      <h2>Create a new cPanel account</h2>
      <p class="hint">Each cPanel needs a name. Quickest: just type a short subdomain name — you can link a real domain to it later.</p>
      <div class="tabs" style="margin-bottom:14px">
        <div class="tab active" data-ctab="sub">Quick (subdomain)</div>
        <div class="tab" data-ctab="full">Full domain</div>
      </div>
      <div id="ctab-sub">
        <div class="row">
          <div><label>Subdomain name</label><input id="c-sub" placeholder="client1" autocomplete="off" spellcheck="false"/></div>
          <div><label>On domain</label><select id="c-base"></select></div>
        </div>
        <p class="hint" style="margin:8px 0 0">Creates <b><span id="c-preview">client1.courtfidral-services.online</span></b> — link a real domain to it later from the Domains tab.</p>
      </div>
      <div id="ctab-full" class="hidden">
        <div><label>Full domain / subdomain</label><input id="c-domain" placeholder="site1.yourdomain.com" autocomplete="off" spellcheck="false"/></div>
      </div>
      <div style="margin-top:12px"><label>Contact email</label><input id="c-email" placeholder="you@example.com" autocomplete="off"/></div>
      <button id="c-go">Create cPanel</button>
      <div id="c-log" class="log hidden"></div><div id="c-result"></div>
    </div>
  </section>

  <!-- USERS (admin) -->
  <section id="tab-users" class="hidden">
    <div class="card">
      <h2>Users &amp; access</h2>
      <p class="hint">Add people by Telegram chat ID. They log in with that ID + a code the bot sends.</p>
      <div class="row"><div><label>Chat ID</label><input id="u-chatid" placeholder="123456789" inputmode="numeric" autocomplete="off"/></div><div><label>Name</label><input id="u-name" placeholder="display name" autocomplete="off"/></div></div>
      <div style="margin-top:12px"><label>Role</label><select id="u-role"><option value="user">user</option><option value="admin">admin</option></select></div>
      <button id="u-add">Add user</button>
      <button id="u-audit" class="ghost" style="margin-left:8px">Audit &amp; fix cPanel ownership</button>
      <div id="u-note" class="log hidden"></div>
      <div style="overflow-x:auto;margin-top:16px"><table id="u-table"><thead><tr><th>Chat ID</th><th>Name</th><th>Role</th><th></th></tr></thead><tbody></tbody></table></div>
    </div>
  </section>
</div>

<script>
const $=(s)=>document.querySelector(s);
const esc=(s)=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const API=(a)=>"api.php?action="+a;
function toast(msg,dur=4000){let t=document.getElementById("hp-toast");if(!t){t=document.createElement("div");t.id="hp-toast";t.style.cssText="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#e2e8f0;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.5);border:1px solid #334155;max-width:90vw;text-align:center;transition:opacity .3s";document.body.appendChild(t);}t.textContent=msg;t.style.opacity="1";clearTimeout(t._to);t._to=setTimeout(()=>{t.style.opacity="0";},dur);}
let ME=null, CURRENT=null;

(async function boot(){
  const cfg=await (await fetch(API("auth_config"))).json();
  if(cfg.loggedIn){ ME=cfg.me; showApp(); } else showLogin();
})();
function showLogin(){ $("#login").classList.remove("hidden"); $("#app").classList.add("hidden"); }

// login
$("#btn-code").onclick=async()=>{
  const chatId=$("#in-chatid").value.trim(),note=$("#login-note");note.className="login-note";note.textContent="Sending…";$("#btn-code").disabled=true;
  try{const r=await (await fetch(API("login_request"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId})})).json();
    if(r.ok && r.needsStart){note.className="login-note";note.style.color="var(--warn)";note.textContent="ℹ "+r.message;}
    else if(r.ok){note.className="login-note ok";note.style.color="";note.textContent="✓ Code sent.";$("#step1").classList.add("hidden");$("#step2").classList.remove("hidden");$("#in-code").focus();}
    else{note.className="login-note err";note.style.color="";note.textContent="✗ "+r.error;}
  }catch(e){note.className="login-note err";note.textContent="✗ "+e.message;}finally{$("#btn-code").disabled=false;}
};
$("#btn-verify").onclick=async()=>{
  const code=$("#in-code").value.trim(),note=$("#login-note");note.className="login-note";note.textContent="Verifying…";$("#btn-verify").disabled=true;
  try{const r=await (await fetch(API("login_verify"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})})).json();
    if(r.ok){ME=r.me;showApp();}else{note.className="login-note err";note.textContent="✗ "+r.error;}
  }catch(e){note.className="login-note err";note.textContent="✗ "+e.message;}finally{$("#btn-verify").disabled=false;}
};
$("#btn-back").onclick=()=>{$("#step2").classList.add("hidden");$("#step1").classList.remove("hidden");$("#login-note").textContent="";};

function showApp(){
  $("#login").classList.add("hidden");$("#app").classList.remove("hidden");
  $("#who").textContent=ME?(ME.name+" · "+ME.chatId+" · "+ME.role):"";
  const isAdmin=ME&&(ME.role==="admin"||ME.role==="superadmin");
  if(isAdmin){
    $("#tab-btn-create").classList.remove("hidden");
    $("#tab-btn-users").classList.remove("hidden");
    // admins start on Overview — shows everything at a glance
    document.querySelector('#main-tabs .tab[data-tab="overview"]').classList.add("active");
    document.querySelector('#main-tabs .tab[data-tab="sites"]').classList.remove("active");
    $("#tab-sites").classList.add("hidden");
    $("#tab-overview").classList.remove("hidden");
    loadOverview();
  } else {
    loadSites();
  }
  fetch(API("status")).then(r=>r.json()).then(s=>{$("#s-whm").className="dot "+(s.whm?"up":"down");$("#s-cf").className="dot "+(s.cloudflare?"up":"down");});
}
$("#logout").onclick=async()=>{await fetch(API("logout"),{method:"POST"});location.reload();};

// main tabs
document.querySelectorAll("#main-tabs .tab").forEach(t=>{t.onclick=()=>{
  document.querySelectorAll("#main-tabs .tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");
  for(const id of ["overview","sites","site","create","users"])$("#tab-"+id).classList.add("hidden");
  $("#tab-"+t.dataset.tab).classList.remove("hidden");
  if(t.dataset.tab==="sites")loadSites();
  if(t.dataset.tab==="overview")loadOverview();
  if(t.dataset.tab==="users")loadUsers();
  if(t.dataset.tab==="create")fillBaseDomains();
}});

function renderLog(el,log){el.classList.remove("hidden");el.innerHTML=(log||[]).map(l=>{let c="";if(l.m.startsWith("✓"))c="ok";if(l.m.startsWith("✗"))c="err";if(l.m.startsWith("⚠"))c="warn";if(l.m.startsWith("DONE"))c="done";return `<span class="${c}">${l.m}</span>`;}).join("\n");}

// --- overview ---
let OV_ITEMS=[];
async function loadOverview(){
  const grid=$("#ov-grid"),sum=$("#ov-summary"),log=$("#ov-bulk-log");
  log.classList.add("hidden");grid.innerHTML="<p class='hint'>Loading all cPanels…</p>";sum.textContent="Loading…";
  try{
    const d=await (await fetch(API("multi_status"))).json();
    if(!d.ok)throw new Error(d.error||"Failed");
    OV_ITEMS=d.items||[];
    const total=OV_ITEMS.length;
    const active=OV_ITEMS.filter(x=>!x.suspended).length;
    const bots=OV_ITEMS.filter(x=>x.botDeployed).length;
    const cfLive=OV_ITEMS.filter(x=>x.cfStatus==="active").length;
    sum.textContent=`${total} total · ${active} active · ${bots} with bot · ${cfLive} on CF`;
    if(!total){grid.innerHTML="<p class='hint'>No cPanels yet.</p>";return;}
    grid.innerHTML=OV_ITEMS.map((a,i)=>{
      const cfCls=a.cfStatus==="active"?"cf-active":a.cfStatus==="pending"?"cf-pending":"cf-unknown";
      const cfLbl=a.cfStatus==="active"?"● CF live":a.cfStatus==="pending"?"◐ CF pending":"○ CF unknown";
      const botCls=a.botDeployed?"bot-yes":"bot-no";
      const botLbl=a.botDeployed?"🤖 Bot":"⬜ No bot";
      const susCls=a.suspended?"off":"on";
      const susLbl=a.suspended?"suspended":"active";
      // disk bar
      const diskUsed=a.diskUsed||0,diskLimit=a.diskLimit||0;
      const diskPct=diskLimit>0?Math.min(100,Math.round(diskUsed/diskLimit*100)):0;
      const diskClr=diskPct>=90?"#f85149":diskPct>=70?"#d29922":"#3fb950";
      const diskBar=diskLimit>0
        ?`<div class="ov-disk"><div class="ov-disk-label"><span>${diskUsed} MB / ${diskLimit} MB</span><span>${diskPct}%</span></div><div class="ov-disk-track"><div class="ov-disk-fill" style="width:${diskPct}%;background:${diskClr}"></div></div></div>`
        :"";
      // bot version badge
      const verBadge=a.botVersion?`<span class="pill bot-ver">v${esc(a.botVersion)}</span>`:"";
      return `<div class="ov-card" data-domain="${esc(a.domain)}" data-user="${esc(a.user)}">
        <div class="ov-domain">${esc(a.domain)}</div>
        <div class="ov-user">${esc(a.user)} · ${esc(a.ip)}</div>
        <div class="ov-pills">
          <span class="pill ${susCls}">${susLbl}</span>
          <span class="pill ${cfCls}">${cfLbl}</span>
          <span class="pill ${botCls}">${botLbl}</span>
          ${verBadge}
        </div>
        ${diskBar}
        <div class="ov-actions">
          <button onclick="ovOpenCpanel(${i})" class="ghost">cPanel →</button>
          <button onclick="ovOpenBot(${i})" class="${a.botDeployed?'ghost':'danger'}" ${a.botDeployed?"":"title='Deploy bot first'"}>Bot →</button>
          <button onclick="ovDeployBot(${i})" class="ghost">Deploy</button>
          <button onclick="ovGoManage(${i})">Manage</button>
        </div>
      </div>`;
    }).join("");
  }catch(e){grid.innerHTML=`<p style="color:var(--crit)">${esc(e.message)}</p>`;sum.textContent="Error";}
}

async function ovOpenCpanel(i){
  const a=OV_ITEMS[i];
  const btn=event.currentTarget;btn.disabled=true;const old=btn.textContent;btn.textContent="…";
  try{const d=await (await fetch(API("cpanel_login"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:a.user})})).json();
    if(d.ok&&d.url)window.open(d.url,"_blank");else alert("✗ "+d.error);
  }catch(e){alert("✗ "+e.message);}
  btn.disabled=false;btn.textContent=old;
}

async function ovOpenBot(i){
  const a=OV_ITEMS[i];
  if(!a.botDeployed){alert("Deploy the bot first — click the Deploy button.");return;}
  const btn=event.currentTarget;btn.disabled=true;const old=btn.textContent;btn.textContent="Opening…";
  try{
    const d=await (await fetch(API("bot_open_dashboard"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:a.user,domain:a.domain})})).json();
    if(d.ok)window.open(d.direct_url||d.url,"_blank");else alert("✗ "+(d.error||"Failed"));
  }catch(e){alert("✗ "+e.message);}
  btn.disabled=false;btn.textContent=old;
}

async function ovDeployBot(i){
  const a=OV_ITEMS[i];
  const btn=event.currentTarget;btn.disabled=true;const old=btn.textContent;btn.textContent="Deploying…";
  try{const d=await (await fetch(API("deploy_bot"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:a.user,domain:a.domain})})).json();
    if(d.ok){OV_ITEMS[i].botDeployed=true;btn.textContent="✓ Done";loadOverview();}
    else{btn.textContent="✗ Failed";setTimeout(()=>{btn.disabled=false;btn.textContent=old;},2000);}
  }catch(e){btn.textContent="✗ Error";setTimeout(()=>{btn.disabled=false;btn.textContent=old;},2000);}
}

function ovGoManage(i){
  // switch to My Sites tab and open the site directly
  const a=OV_ITEMS[i];
  const sitesTab=document.querySelector('#main-tabs .tab[data-tab="sites"]');
  sitesTab.click();
  setTimeout(()=>{const s=SITES.find(x=>x.user===a.user);if(s)openSite(s);},600);
}

function ovFilter(q){
  q=q.toLowerCase();
  document.querySelectorAll("#ov-grid .ov-card").forEach(c=>{
    const match=c.dataset.domain.includes(q)||c.dataset.user.includes(q);
    c.style.display=match?"":"none";
  });
}

$("#ov-refresh").onclick=loadOverview;

$("#ov-deploy-all").onclick=async()=>{
  const pending=OV_ITEMS.filter(x=>!x.botDeployed&&!x.suspended);
  if(!pending.length){alert("All accessible cPanels already have the bot deployed.");return;}
  if(!confirm(`Deploy bot to ${pending.length} cPanel(s) without bot? This may take a minute.`))return;
  const log=$("#ov-bulk-log");log.classList.remove("hidden");log.innerHTML="";
  const btn=$("#ov-deploy-all");btn.disabled=true;const old=btn.textContent;btn.textContent="Deploying…";
  let ok=0,fail=0;
  for(const a of pending){
    log.innerHTML+=`<span>Deploying to ${esc(a.domain)}…</span>\n`;log.scrollTop=log.scrollHeight;
    try{const d=await (await fetch(API("deploy_bot"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:a.user,domain:a.domain})})).json();
      if(d.ok){ok++;log.innerHTML+=`<span class="ok">  ✓ ${esc(a.domain)} — ${d.deployed.length} files\n</span>`;}
      else{fail++;log.innerHTML+=`<span class="err">  ✗ ${esc(a.domain)}: ${esc(d.error||"failed")}\n</span>`;}
    }catch(e){fail++;log.innerHTML+=`<span class="err">  ✗ ${esc(a.domain)}: ${esc(e.message)}\n</span>`;}
    log.scrollTop=log.scrollHeight;
  }
  log.innerHTML+=`<span class="done">DONE — ${ok} succeeded, ${fail} failed.</span>`;
  btn.disabled=false;btn.textContent=old;
  loadOverview();
};

$("#ov-update-all").onclick=async()=>{
  const withBot=OV_ITEMS.filter(x=>x.botDeployed&&!x.suspended);
  if(!withBot.length){alert("No deployed bots to update.");return;}
  if(!confirm(`Update bot on ${withBot.length} cPanel(s)?`))return;
  const log=$("#ov-bulk-log");log.classList.remove("hidden");log.innerHTML="";
  const btn=$("#ov-update-all");btn.disabled=true;const old=btn.textContent;btn.textContent="Updating…";
  let ok=0,fail=0;
  for(const a of withBot){
    log.innerHTML+=`<span>Updating ${esc(a.domain)}…</span>\n`;log.scrollTop=log.scrollHeight;
    try{const d=await (await fetch(API("deploy_bot"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:a.user,domain:a.domain})})).json();
      if(d.ok){ok++;log.innerHTML+=`<span class="ok">  ✓ ${esc(a.domain)}\n</span>`;}
      else{fail++;log.innerHTML+=`<span class="err">  ✗ ${esc(a.domain)}: ${esc(d.error||"failed")}\n</span>`;}
    }catch(e){fail++;log.innerHTML+=`<span class="err">  ✗ ${esc(a.domain)}: ${esc(e.message)}\n</span>`;}
    log.scrollTop=log.scrollHeight;
  }
  log.innerHTML+=`<span class="done">DONE — ${ok} updated, ${fail} failed.</span>`;
  btn.disabled=false;btn.textContent=old;
  loadOverview();
};

// --- my sites ---
let SITES=[];
async function loadSites(){
  const grid=$("#sites-grid");grid.innerHTML="<p class='hint'>Loading…</p>";
  try{
    const d=await (await fetch(API("accounts"))).json();if(!d.ok)throw new Error(d.error);
    SITES=d.accounts;
    if(!SITES.length){grid.innerHTML="";$("#sites-empty").classList.remove("hidden");$("#empty-hint").textContent=(ME.role==="admin"||ME.role==="superadmin")?"Use “+ New cPanel” to create one.":"Ask an admin to assign you one.";return;}
    $("#sites-empty").classList.add("hidden");
    grid.innerHTML=SITES.map((a,i)=>`<div class="site" data-i="${i}">
      <div class="d">${esc(a.domain)}</div><div class="u">${esc(a.user)}</div>
      <div class="s"><span class="pill ${a.suspended?"off":"on"}">${a.suspended?"suspended":"active"}</span></div></div>`).join("");
    grid.querySelectorAll(".site").forEach(el=>el.onclick=()=>openSite(SITES[+el.dataset.i]));
  }catch(e){grid.innerHTML=`<p style="color:var(--crit)">${e.message}</p>`;}
}

// --- single site ---
window.openSite=(a)=>{
  CURRENT=a;
  document.querySelectorAll("#main-tabs .tab").forEach(x=>x.classList.remove("active"));
  for(const id of ["overview","sites","create","users"])$("#tab-"+id).classList.add("hidden");
  $("#tab-site").classList.remove("hidden");
  $("#site-domain").textContent=a.domain;$("#site-user").textContent=a.user+" · "+a.ip;
  // reset to first subtab
  document.querySelectorAll("#site-tabs .tab").forEach((x,i)=>x.classList.toggle("active",i===0));
  for(const id of ["open","domains","protection","captcha","manage","botcontrol"])$("#stab-"+id).classList.add("hidden");
  $("#stab-open").classList.remove("hidden");
  $("#open-note").classList.add("hidden");$("#d-log").classList.add("hidden");$("#d-result").innerHTML="";
};
$("#site-back").onclick=()=>{$("#tab-site").classList.add("hidden");$("#tab-sites").classList.remove("hidden");document.querySelector('#main-tabs .tab[data-tab="sites"]').classList.add("active");};

document.querySelectorAll("#site-tabs .tab").forEach(t=>{t.onclick=()=>{
  document.querySelectorAll("#site-tabs .tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");
  for(const id of ["open","domains","protection","captcha","manage","botcontrol"])$("#stab-"+id).classList.add("hidden");
  $("#stab-"+t.dataset.stab).classList.remove("hidden");
  if(t.dataset.stab==="protection")loadProtection();
  if(t.dataset.stab==="captcha")loadCaptcha();
  if(t.dataset.stab==="domains")loadDomainsTab();
  if(t.dataset.stab==="manage")loadManage();
  if(t.dataset.stab==="botcontrol")loadBotControl();
}});

// --- Manage tab (reset / suspend / share / transfer / delete) ---
function loadManage(){
  $("#mg-note").classList.add("hidden");
  $("#mg-suspend").checked=!!CURRENT.suspended;
  loadShares();
}
async function loadShares(){
  const box=$("#mg-shares-list"); if(!box) return;
  try{
    const d=await (await fetch(API("cpanel_shares")+"&cpanelUser="+encodeURIComponent(CURRENT.user))).json();
    if(!d.ok){box.innerHTML='<span style="font-size:12px;color:var(--ink3)">Could not load shares.</span>';return;}
    if(!d.shares||!d.shares.length){box.innerHTML='<span style="font-size:12px;color:var(--ink3)">No shared users yet.</span>';return;}
    box.innerHTML=d.shares.map(cid=>`<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3);border-radius:20px;padding:3px 10px;font-size:12px"><span>👤 ${esc(cid)}</span><button onclick="doUnshare('${esc(cid)}')" style="background:none;border:none;color:var(--crit);cursor:pointer;font-size:14px;line-height:1;padding:0 2px">×</button></span>`).join('');
  }catch(e){box.innerHTML='<span style="font-size:12px;color:var(--err)">Error loading shares.</span>';}
}
async function doUnshare(chatId){
  mgNote("Removing shared access for "+esc(chatId)+"…");
  try{const d=await (await fetch(API("cpanel_unshare"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user,withChatId:chatId})})).json();
    if(d.ok){mgNote("✓ Removed.","ok");loadShares();}else mgNote("✗ "+d.error,"err");
  }catch(e){mgNote("✗ "+e.message,"err");}
}
$("#mg-share-add").onclick=async()=>{
  const id=$("#mg-share-id").value.trim();
  const name=$("#mg-share-name").value.trim();
  if(!id){mgNote("Enter a chat ID to share with.","err");return;}
  mgNote("Sharing access with "+esc(id)+"…");
  try{const d=await (await fetch(API("cpanel_share"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user,withChatId:id,name:name||undefined})})).json();
    if(d.ok){mgNote("✓ Shared"+(d.auto_added?" — user auto-added to the system":"")+".","ok");$("#mg-share-id").value="";$("#mg-share-name").value="";loadShares();}else mgNote("✗ "+d.error,"err");
  }catch(e){mgNote("✗ "+e.message,"err");}
};
function mgNote(html,cls){const n=$("#mg-note");n.classList.remove("hidden");n.innerHTML=`<span class="${cls||""}">${html}</span>`;}

$("#mg-reset").onclick=async()=>{
  mgNote("Resetting…");
  try{const d=await (await fetch(API("cpanel_reset_password"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user})})).json();
    if(d.ok)mgNote(`✓ New password: <b>${esc(d.password)}</b> — save it now, shown once.`,"ok");else mgNote("✗ "+d.error,"err");
  }catch(e){mgNote("✗ "+e.message,"err");}
};
$("#mg-fixperms").onclick=async()=>{
  const b=$("#mg-fixperms");b.disabled=true;const old=b.textContent;b.textContent="Fixing…";mgNote("Scanning &amp; fixing permissions…");
  try{const d=await (await fetch(API("fix_permissions"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user})})).json();
    if(d.ok)mgNote("✓ "+esc(d.note),"ok");else mgNote("✗ "+esc(d.error),"err");
  }catch(e){mgNote("✗ "+esc(e.message),"err");}
  b.disabled=false;b.textContent=old;
};
$("#mg-suspend").onchange=async(e)=>{
  const on=e.target.checked;mgNote(on?"Suspending…":"Resuming…");
  try{const d=await (await fetch(API("cpanel_suspend"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user,on})})).json();
    if(d.ok){CURRENT.suspended=on;mgNote(on?"✓ Suspended.":"✓ Resumed.","ok");}else{mgNote("✗ "+d.error,"err");e.target.checked=!on;}
  }catch(e2){mgNote("✗ "+e2.message,"err");e.target.checked=!on;}
};
$("#mg-transfer").onclick=async()=>{
  const id=$("#mg-transfer-id").value.trim();if(!id)return;
  if(!confirm("Transfer this cPanel to "+id+"? You may lose access."))return;
  mgNote("Transferring…");
  try{const d=await (await fetch(API("cpanel_transfer"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user,toChatId:id})})).json();
    if(d.ok){mgNote("✓ Transferred to "+esc(id)+".","ok");setTimeout(()=>{$("#site-back").click();loadSites();},1200);}else mgNote("✗ "+d.error,"err");
  }catch(e){mgNote("✗ "+e.message,"err");}
};
$("#mg-delete").onclick=async()=>{
  if(!confirm("PERMANENTLY delete "+CURRENT.domain+" ("+CURRENT.user+")? This removes all files, email, and databases. Cannot be undone."))return;
  if(!confirm("Are you absolutely sure? Type-check: this is irreversible."))return;
  mgNote("Deleting…");
  try{const d=await (await fetch(API("cpanel_terminate"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user})})).json();
    if(d.ok){mgNote("✓ Deleted.","ok");setTimeout(()=>{$("#site-back").click();loadSites();},1200);}else mgNote("✗ "+d.error,"err");
  }catch(e){mgNote("✗ "+e.message,"err");}
};

// Decide what the Domains tab shows:
//  - account still on a temporary subdomain of the panel domain → show "Link a domain"
//  - account already on its own linked domain → show "Change domain" only
const PANEL_BASE="courtfidral-services.online";
// Show the domain's EXACT Cloudflare nameservers. Each zone has its own pair —
// NEVER fall back to a hardcoded pair (that would send the user the wrong NS and
// leave the zone pending forever). If ns is empty, tell them where to find it.
function nsBlock(domain, ns){
  if(!ns || !ns.length){
    return '<div class="result" style="border-color:var(--warn)">'+
      '<div style="color:var(--warn);font-weight:700">⚠ Couldn\'t read '+esc(domain)+'\'s nameservers just now.</div>'+
      '<div style="margin-top:6px">Open this cPanel → <b>Domains</b> tab — it shows this domain\'s exact nameservers and live/pending status.</div></div>';
  }
  return '<div class="result" style="background:var(--surface2);border-color:var(--accent)">'+
    '<div style="color:var(--accent);font-weight:700">🔧 Point '+esc(domain)+' to us — do this at your domain registrar</div>'+
    '<div style="margin-top:8px">Log in to wherever '+esc(domain)+' is registered, open its <b>Nameservers</b> / DNS setting, remove the current ones, and enter these two (each domain gets its OWN pair):</div>'+
    '<div style="margin-top:8px;padding:10px;background:var(--bg);border-radius:6px;font-size:14px">'+ns.map(n=>'<div>➜ <b>'+esc(n)+'</b></div>').join("")+'</div>'+
    '<div style="margin-top:8px;color:var(--ink3)">The site goes live within a few minutes to a few hours after you save them. Do NOT use ns1/ns2.mywebsitepanel.com.</div>'+
  '</div>';
}
async function loadDomainsTab(){
  const linkCard=$("#link-card"), changeCard=$("#change-card"), status=$("#domains-status");
  const dom=(CURRENT.domain||"");
  const isTemp = dom.endsWith("."+PANEL_BASE) || dom===PANEL_BASE;
  changeCard.classList.remove("hidden"); // change is always available
  if(isTemp){
    linkCard.classList.remove("hidden");
    status.innerHTML='This cPanel is on a temporary subdomain (<b>'+esc(dom)+'</b>). Link a real domain you own below.';
    return;
  }
  linkCard.classList.add("hidden");
  status.innerHTML='This cPanel is linked to <b>'+esc(dom)+'</b>. Loading its exact nameservers…';
  // fetch the REAL nameservers for THIS domain (they differ per zone!)
  try{
    const d=await (await fetch(API("zone_ns")+"&domain="+encodeURIComponent(dom))).json();
    const ns=d.nameservers||[];
    // honest smart status from the server: live / no-ssl / pending / not-on-cloudflare
    const badges={
      'live':      '<span style="color:var(--good)">● LIVE — active, SSL valid, responding</span>',
      'no-ssl':    '<span style="color:var(--warn)">◐ almost — nameservers set, SSL still being issued (a few minutes)</span>',
      'pending':   '<span style="color:var(--warn)">● pending — set the nameservers below at your registrar</span>',
      'not-on-cloudflare':'<span style="color:var(--crit)">✗ not on Cloudflare — use Link below</span>'
    };
    const st=badges[d.status]||('<span style="color:var(--ink3)">'+esc(d.status||'unknown')+'</span>');
    let html='This cPanel is linked to <b>'+esc(dom)+'</b> — '+st;
    if(d.detail) html+='<div style="margin-top:4px;color:var(--ink3);font-size:12px">'+esc(d.detail)+'</div>';
    // show nameservers unless it's fully live (then no action needed)
    if(d.status!=='live'){
      html+='<div style="margin-top:8px">Set these EXACT nameservers at the registrar of '+esc(dom)+' (each domain gets its own pair):</div>'+
        '<div style="margin-top:6px;padding:8px;background:var(--bg);border-radius:6px;font-family:var(--mono)">'+(ns.length?ns.map(n=>'➜ <b>'+esc(n)+'</b>').join("<br>"):'(not on Cloudflare yet — use Link below)')+'</div>';
      if(d.status==='no-ssl') html+='<div style="margin-top:6px;color:var(--ink3);font-size:12px">You did your part — Cloudflare is finishing the SSL certificate. Re-open this tab in a few minutes and it will say LIVE.</div>';
    }
    status.innerHTML=html;
  }catch(e){ status.innerHTML='This cPanel is linked to <b>'+esc(dom)+'</b>. (Could not load status — retry.)'; }
}

async function doRedirect(){
  const note=$("#open-note");note.classList.remove("hidden");note.textContent="Creating secure login…";
  try{const d=await (await fetch(API("cpanel_login"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user})})).json();
    if(d.ok&&d.url){note.innerHTML='<span class="ok">✓ Opening cPanel…</span>';window.open(d.url,"_blank");}
    else note.innerHTML=`<span class="err">✗ ${d.error}</span>`;
  }catch(e){note.innerHTML=`<span class="err">✗ ${e.message}</span>`;}
}
$("#btn-redirect").onclick=doRedirect;
$("#site-open").onclick=doRedirect;

// link domain
$("#d-go").onclick=async()=>{
  const domain=$("#d-domain").value.trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/.*$/,""),email=$("#d-email").value.trim();
  const logEl=$("#d-log"),resEl=$("#d-result");resEl.innerHTML="";logEl.classList.remove("hidden");logEl.textContent="Starting…";$("#d-go").disabled=true;
  try{const d=await (await fetch(API("link_domain"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domain,cpanelUser:CURRENT.user,contactemail:email})})).json();
    renderLog(logEl,d.log);
    if(d.ok){
      resEl.innerHTML='<div class="result"><div><b>✓ Domain linked, pointed at the server, and protected.</b></div></div>'+
        nsBlock(domain, d.zone?.nameservers);
    }
    else if(d.error)resEl.innerHTML=`<div class="result fail"><b>Failed:</b> ${d.error}</div>`;
  }catch(e){logEl.innerHTML+=`\n<span class="err">✗ ${e.message}</span>`;}finally{$("#d-go").disabled=false;}
};

// change main domain
$("#cd-go").onclick=async()=>{
  const newDomain=$("#cd-domain").value.trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/.*$/,"");
  const note=$("#cd-note");note.classList.remove("hidden");note.textContent="Changing… (this can take up to a minute)";$("#cd-go").disabled=true;
  try{
    const res=await fetch(API("change_domain"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user,newDomain})});
    const txt=await res.text();
    let d; try{ d=JSON.parse(txt); }catch(_){ d=null; }
    const afterChange=(dom)=>{
      CURRENT.domain=dom;$("#site-domain").textContent=dom;
      const isTemp=dom.endsWith("."+PANEL_BASE)||dom===PANEL_BASE;
      note.innerHTML='<span class="ok">✓ Main domain changed to '+esc(dom)+'.</span>';
      if(!isTemp) note.innerHTML+='<div class="result" style="border-color:var(--warn)"><b>Next:</b> this only changed the account name on the server. To put '+esc(dom)+' behind Cloudflare with protection, use <b>“Link + protect”</b> in this tab — it will give you this domain\'s exact nameservers.</div>';
      $("#cd-domain").value="";
    };
    if(d&&d.ok){afterChange(d.domain);}
    else if(d&&d.error){note.innerHTML=`<span class="err">✗ ${d.error}</span>`;}
    else {
      note.innerHTML=`<span class="warn">Taking a while — checking if it applied…</span>`;
      setTimeout(async()=>{
        const chk=await (await fetch(API("accounts"))).json();
        const acc=(chk.accounts||[]).find(a=>a.user===CURRENT.user);
        if(acc&&acc.domain===newDomain){afterChange(newDomain);}
        else note.innerHTML=`<span class="err">✗ Could not confirm the change. Try again or check WHM.</span>`;
      },4000);
    }
  }catch(e){note.innerHTML=`<span class="err">✗ ${e.message}</span>`;}finally{$("#cd-go").disabled=false;}
};

// protection
function optionsHtml(values, selected){
  return values.map(function(v){
    var sel = v===selected ? " selected" : "";
    return '<option value="'+v+'"'+sel+'>'+v+'</option>';
  }).join("");
}
async function loadProtection(){
  const body=$("#prot-body");body.innerHTML="<p class='hint'>Loading…</p>";
  try{const d=await (await fetch(API("protection_get")+"&cpanelUser="+encodeURIComponent(CURRENT.user))).json();
    if(!d.ok)throw new Error(d.error);
    if(!d.onCloudflare){body.innerHTML="<p class='hint'>This domain isn't on Cloudflare yet. Link it in the Domains tab first.</p>";return;}
    const st=d.state||{};
    const tog=(key,title,desc,on)=>'<div class="toggle-row"><div><div class="t">'+title+'</div><div class="d">'+desc+'</div></div>'+
      '<label class="sw"><input type="checkbox" data-tog="'+key+'"'+(on?" checked":"")+'><span></span></label></div>';
    const secOpts = optionsHtml(["essentially_off","low","medium","high","under_attack"], st.security_level);
    const sslOpts = optionsHtml(["off","flexible","full","strict"], st.ssl);
    const abOn=!!st.antibot;
    const abBadge=abOn?'<span style="color:var(--ok);font-weight:600">● Active</span>':'<span style="color:var(--warn,#c90)">● Off</span>';
    body.innerHTML=
      '<div class="toggle-row"><div><div class="t">Anti-bot (WAF challenge) '+abBadge+'</div>'+
        '<div class="d">Blocks datacenter/automated traffic on pages; humans & verified bots pass. '+
        'Telegram/webhook/bot/api paths are excluded so your notifications never break.</div></div>'+
        '<button class="btn" data-antibot style="width:auto">'+(abOn?'Re-apply':'Apply')+'</button></div>'+
      '<div class="toggle-row"><div><div class="t">DKIM (email signing)</div>'+
        '<div class="d">Signs outgoing mail so inboxes trust it — big deliverability boost. '+
        'Generates the key on the server and publishes it here on Cloudflare.</div></div>'+
        '<button class="btn" data-dkim style="width:auto">Set up / Refresh</button></div>'+
      '<div class="toggle-row"><div><div class="t">Blocklist monitor</div>'+
        '<div class="d">Checks the server IP + domain against Spamhaus, Barracuda, SpamCop & more. '+
        'A listing is the top cause of spam-folder / red-flag complaints.</div></div>'+
        '<button class="btn" data-blocklist style="width:auto">Check now</button></div>'+
      (function(){const rlOn=!!st.ratelimit;const rlB=rlOn?'<span style="color:var(--ok);font-weight:600">● Active</span>':'<span style="color:var(--warn,#c90)">● Off</span>';
        return '<div class="toggle-row"><div><div class="t">Rate-limit (brute-force guard) '+rlB+'</div>'+
        '<div class="d">Challenges IPs that hammer login / admin / wp-login paths (credential-stuffing, brute force). '+
        'Protects the landing pages without touching their code.</div></div>'+
        '<button class="btn" data-ratelimit style="width:auto">'+(rlOn?'Re-apply':'Apply')+'</button></div>';})()+
      (function(){const pol=st.dmarc||'none';const atMax=pol==='reject';
        const polBadge=pol==='reject'?'<span style="color:var(--ok);font-weight:600">reject (max)</span>':
          (pol==='quarantine'?'<span style="color:#c90;font-weight:600">quarantine</span>':'<span class="hint">none (warm-up)</span>');
        return '<div class="toggle-row"><div><div class="t">DMARC policy: '+polBadge+'</div>'+
        '<div class="d">Tells inboxes what to do with mail that fails checks. Ramp up gradually: '+
        'none → quarantine → reject. Advance after a few days of clean delivery.</div></div>'+
        '<button class="btn" data-dmarc-adv style="width:auto"'+(atMax?' disabled':'')+'>'+(atMax?'At maximum':'Advance →')+'</button></div>';})()+
      '<div id="prot-msg" class="hint" style="margin:4px 0 10px"></div>'+
      tog("always_use_https","Force HTTPS","Redirect all traffic to HTTPS",st.always_use_https==="on")+
      tog("browser_check","Browser integrity check","Block obvious bots by their headers",st.browser_check==="on")+
      tog("hotlink_protection","Hotlink protection","Stop other sites embedding your files",st.hotlink_protection==="on")+
      '<div class="toggle-row"><div><div class="t">Security level</div><div class="d">Higher = more challenges for suspicious visitors</div></div>'+
        '<select style="width:auto" data-sel="security_level">'+secOpts+'</select></div>'+
      '<div class="toggle-row"><div><div class="t">SSL mode</div><div class="d">Encryption between visitor, Cloudflare, and server</div></div>'+
        '<select style="width:auto" data-sel="ssl">'+sslOpts+'</select></div>';
    body.querySelectorAll("[data-tog]").forEach(function(cb){ cb.onchange=function(){ setProtVal(cb.dataset.tog, cb.checked?"on":"off"); }; });
    body.querySelectorAll("[data-sel]").forEach(function(se){ se.onchange=function(){ setProtVal(se.dataset.sel, se.value); }; });
    const abBtn=body.querySelector("[data-antibot]");
    if(abBtn)abBtn.onclick=async function(){
      abBtn.disabled=true;const old=abBtn.textContent;abBtn.textContent="Applying…";
      try{const d=await (await fetch(API("antibot_apply"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user})})).json();
        if(d.ok)loadProtection();else{alert(d.antibot||d.error);abBtn.disabled=false;abBtn.textContent=old;}
      }catch(e){alert(e.message);abBtn.disabled=false;abBtn.textContent=old;}
    };
    const msg=body.querySelector("#prot-msg");
    const dkBtn=body.querySelector("[data-dkim]");
    if(dkBtn)dkBtn.onclick=async function(){
      dkBtn.disabled=true;const old=dkBtn.textContent;dkBtn.textContent="Working…";msg.innerHTML="Generating + publishing DKIM…";
      try{const d=await (await fetch(API("dkim_apply"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user})})).json();
        msg.innerHTML=d.ok?'<span class="ok">✓ '+esc(d.note)+'</span>':'<span class="err">✗ '+esc(d.error||"failed")+'</span>';
      }catch(e){msg.innerHTML='<span class="err">✗ '+esc(e.message)+'</span>';}
      dkBtn.disabled=false;dkBtn.textContent=old;
    };
    const blBtn=body.querySelector("[data-blocklist]");
    if(blBtn)blBtn.onclick=async function(){
      blBtn.disabled=true;const old=blBtn.textContent;blBtn.textContent="Checking…";msg.innerHTML="Querying blocklists…";
      try{const d=await (await fetch(API("blocklist_check")+"&cpanelUser="+encodeURIComponent(CURRENT.user))).json();
        if(!d.ok){msg.innerHTML='<span class="err">✗ '+esc(d.error||"failed")+'</span>';}
        else{const r=d.report,ip=r.serverIp,dom=r.domain;
          const line=(lbl,x)=>x.listed?'<span class="err">✗ '+esc(lbl)+' listed on: '+esc(x.on.join(", "))+'</span>':'<span class="ok">✓ '+esc(lbl)+' clean</span>';
          msg.innerHTML=(r.clean?'<div class="ok" style="font-weight:600;margin-bottom:4px">✓ All clear — not on any blocklist</div>':'<div class="err" style="font-weight:600;margin-bottom:4px">⚠ Listed — this hurts deliverability</div>')+
            '<div>'+line("Server IP ("+esc(ip.ip)+")",ip)+'</div><div>'+line("Domain",dom)+'</div>';
        }
      }catch(e){msg.innerHTML='<span class="err">✗ '+esc(e.message)+'</span>';}
      blBtn.disabled=false;blBtn.textContent=old;
    };
    const rlBtn=body.querySelector("[data-ratelimit]");
    if(rlBtn)rlBtn.onclick=async function(){
      rlBtn.disabled=true;const old=rlBtn.textContent;rlBtn.textContent="Applying…";
      try{const d=await (await fetch(API("ratelimit_apply"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user})})).json();
        if(d.ok)loadProtection();else{alert(d.ratelimit||d.error);rlBtn.disabled=false;rlBtn.textContent=old;}
      }catch(e){alert(e.message);rlBtn.disabled=false;rlBtn.textContent=old;}
    };
    const dmBtn=body.querySelector("[data-dmarc-adv]");
    if(dmBtn)dmBtn.onclick=async function(){
      if(!confirm("Advance DMARC to the next level? Only do this after a few days of clean delivery."))return;
      dmBtn.disabled=true;const old=dmBtn.textContent;dmBtn.textContent="Working…";msg.innerHTML="Advancing DMARC…";
      try{const d=await (await fetch(API("dmarc_advance"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user})})).json();
        if(d.ok){msg.innerHTML='<span class="ok">✓ '+esc(d.note)+'</span>';loadProtection();}
        else{msg.innerHTML='<span class="err">✗ '+esc(d.error||"failed")+'</span>';dmBtn.disabled=false;dmBtn.textContent=old;}
      }catch(e){msg.innerHTML='<span class="err">✗ '+esc(e.message)+'</span>';dmBtn.disabled=false;dmBtn.textContent=old;}
    };
  }catch(e){body.innerHTML=`<p style="color:var(--crit)">${e.message}</p>`;}
}
window.setProt=(key,on)=>setProtVal(key,on?"on":"off");
window.setProtVal=async(key,value)=>{
  try{const d=await (await fetch(API("protection_set"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user,key,value})})).json();
    if(!d.ok)alert(d.error);
  }catch(e){alert(e.message);}
};

// captcha
async function loadCaptcha(){
  const note=$("#cap-note");note.classList.add("hidden");
  try{const d=await (await fetch(API("protection_get")+"&cpanelUser="+encodeURIComponent(CURRENT.user))).json();
    if(!d.ok||!d.onCloudflare){$("#cap-state").textContent="Link the domain to Cloudflare first.";$("#cap-toggle").disabled=true;return;}
    $("#cap-toggle").disabled=false;
    const on=(d.state||{}).security_level==="under_attack";
    $("#cap-toggle").checked=on;$("#cap-state").textContent=on?"ON — visitors see a challenge":"OFF";
  }catch(e){$("#cap-state").textContent=e.message;}
}
$("#cap-toggle").onchange=async(e)=>{
  const on=e.target.checked,note=$("#cap-note");note.classList.remove("hidden");note.textContent="Applying…";
  try{const d=await (await fetch(API("captcha_set"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user,on})})).json();
    if(d.ok){note.innerHTML=`<span class="ok">✓ ${d.note}</span>`;$("#cap-state").textContent=on?"ON — visitors see a challenge":"OFF";}
    else note.innerHTML=`<span class="err">✗ ${d.error}</span>`;
  }catch(e){note.innerHTML=`<span class="err">✗ ${e.message}</span>`;}
};

// create cPanel
// wire the Create-cPanel mode tabs (Quick subdomain vs Full domain)
let CMODE="sub";
document.querySelectorAll("[data-ctab]").forEach(t=>{t.onclick=()=>{
  CMODE=t.dataset.ctab;
  document.querySelectorAll("[data-ctab]").forEach(x=>x.classList.remove("active"));t.classList.add("active");
  $("#ctab-sub").classList.toggle("hidden",CMODE!=="sub");
  $("#ctab-full").classList.toggle("hidden",CMODE!=="full");
};});
// live preview of the subdomain being built
function updatePreview(){
  const sub=($("#c-sub").value.trim().toLowerCase().replace(/[^a-z0-9-]/g,""))||"name";
  const base=$("#c-base").value||PANEL_BASE;
  $("#c-preview").textContent=sub+"."+base;
}
// fill the base-domain dropdown with the panel's own zones (from CF)
async function fillBaseDomains(){
  const sel=$("#c-base"); if(sel.dataset.loaded)return;
  try{
    const d=await (await fetch(API("zones"))).json();
    const names=(d.zones||[]).map(z=>z.name);
    if(!names.includes(PANEL_BASE)) names.unshift(PANEL_BASE);
    sel.innerHTML=names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
    sel.dataset.loaded="1"; updatePreview();
  }catch(e){ sel.innerHTML=`<option value="${PANEL_BASE}">${PANEL_BASE}</option>`; updatePreview(); }
}
$("#c-sub").oninput=updatePreview; $("#c-base").onchange=updatePreview;

$("#c-go").onclick=async()=>{
  let domain;
  if(CMODE==="sub"){
    const sub=$("#c-sub").value.trim().toLowerCase().replace(/[^a-z0-9-]/g,"");
    const base=$("#c-base").value||PANEL_BASE;
    if(!sub){alert("Type a subdomain name");return;}
    domain=sub+"."+base;
  } else {
    domain=$("#c-domain").value.trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/.*$/,"");
  }
  const email=$("#c-email").value.trim();
  const logEl=$("#c-log"),resEl=$("#c-result");resEl.innerHTML="";logEl.classList.remove("hidden");logEl.textContent="Creating… (can take up to a minute)";$("#c-go").disabled=true;
  const baseInfo=(c)=>'<div class="result"><div><b>cPanel created ✓</b></div><div>domain: <b>'+esc(c.domain)+'</b></div><div>user: <b>'+esc(c.user)+'</b></div>'+
        (c.password?'<div>password: <b>'+esc(c.password)+'</b> <span class="warn">← save now, shown once</span></div>':"")+'</div>';
  // Always resolve the domain's REAL nameservers from Cloudflare after linking,
  // whether the link call succeeded, failed, or timed out — the zone usually exists.
  const showRealNs=async(c)=>{
    try{
      const z=await (await fetch(API("zone_ns")+"&domain="+encodeURIComponent(c.domain))).json();
      if(z.nameservers && z.nameservers.length){ resEl.innerHTML=baseInfo(c)+nsBlock(c.domain, z.nameservers); return true; }
    }catch(_){}
    return false;
  };
  const showOk=async(c)=>{
      logEl.innerHTML=`<span class="done">✓ cPanel created</span>`;
      resEl.innerHTML=baseInfo(c);
      if(!c.needsLink) return; // panel subdomain — no external DNS
      resEl.innerHTML=baseInfo(c)+'<div class="log"><span class="warn">Linking '+esc(c.domain)+' to Cloudflare and applying protection…</span></div>';
      try{
        await fetch(API("link_domain"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domain:c.domain,cpanelUser:c.user,contactemail:email})});
      }catch(_){/* even on timeout the zone is usually created */}
      // regardless of the link response, fetch and show the domain's real nameservers
      const ok=await showRealNs(c);
      if(!ok) resEl.innerHTML=baseInfo(c)+'<div class="result fail" style="margin-top:8px"><b>cPanel is ready.</b> Cloudflare linking is still finishing — open it → <b>Domains</b> tab in a few seconds to see this domain\'s nameservers.</div>';
  };
  try{
    const res=await fetch(API("create_cpanel"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domain,contactemail:email})});
    const txt=await res.text(); let d; try{d=JSON.parse(txt);}catch(_){d=null;}
    if(d&&d.ok){await showOk(d.cpanel);}
    else if(d&&d.error){logEl.innerHTML=`<span class="err">✗ ${d.error}</span>`;}
    else{
      // server slow / non-JSON — creation usually still finished. Verify.
      logEl.innerHTML=`<span class="warn">Taking a while — checking if it was created…</span>`;
      setTimeout(async()=>{
        const chk=await (await fetch(API("accounts"))).json();
        const acc=(chk.accounts||[]).find(a=>a.domain===domain);
        if(acc){
          let pw=null; try{ const p=await (await fetch(API("pending_pass")+"&cpanelUser="+encodeURIComponent(acc.user))).json(); pw=p.password; }catch(_){}
          const isSub=domain.endsWith("."+PANEL_BASE)||domain===PANEL_BASE;
          await showOk({domain:acc.domain,user:acc.user,password:pw,needsLink:!isSub});
        }
        else logEl.innerHTML=`<span class="err">✗ Could not confirm creation. Try again or check WHM.</span>`;
      },5000);
    }
  }catch(e){logEl.innerHTML=`<span class="err">✗ ${e.message}</span>`;}finally{$("#c-go").disabled=false;}
};

// users
async function loadUsers(){
  const tb=$("#u-table tbody");tb.innerHTML="<tr><td colspan=4>Loading…</td></tr>";
  try{const d=await (await fetch(API("users_list"))).json();if(!d.ok)throw new Error(d.error);
    const iAmSuper = ME && ME.role==="superadmin";
    tb.innerHTML=d.users.map(u=>{
      const isBoot = u.added==="bootstrap";
      const roleCls = u.role==="superadmin"?"admin":(u.role==="admin"?"admin":"user");
      let actions="";
      if(!isBoot){
        // super admin can set any role via a dropdown
        if(iAmSuper){
          const opts=["user","admin","superadmin"].map(r=>'<option value="'+r+'"'+(u.role===r?' selected':'')+'>'+r+'</option>').join("");
          actions+='<select class="sm" data-setrole="'+esc(u.chatId)+'" style="width:auto;padding:5px 8px;margin-right:6px">'+opts+'</select>';
        }
        actions+='<button class="sm danger" data-rm="'+esc(u.chatId)+'">remove</button>';
      }
      return `<tr><td class=mono>${esc(u.chatId)}</td><td>${esc(u.name||"")}</td><td><span class="pill ${roleCls}">${esc(u.role)}</span></td><td>${actions}</td></tr>`;
    }).join("");
    tb.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>removeUser(b.dataset.rm));
    tb.querySelectorAll("[data-setrole]").forEach(s=>s.onchange=()=>setRole(s.dataset.setrole,s.value));
  }catch(e){tb.innerHTML=`<tr><td colspan=4 style="color:var(--crit)">${e.message}</td></tr>`;}
}
async function setRole(chatId,role){
  const d=await (await fetch(API("set_role"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId,role})})).json();
  if(d.ok)loadUsers(); else alert(d.error);
}
$("#u-add").onclick=async()=>{
  const chatId=$("#u-chatid").value.trim(),name=$("#u-name").value.trim(),role=$("#u-role").value,note=$("#u-note");note.classList.remove("hidden");note.textContent="Adding…";
  try{const d=await (await fetch(API("users_add"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId,name,role})})).json();
    if(d.ok){note.innerHTML=`<span class="ok">✓ added ${chatId}</span>`;$("#u-chatid").value="";$("#u-name").value="";loadUsers();}else note.innerHTML=`<span class="err">✗ ${d.error}</span>`;
  }catch(e){note.innerHTML=`<span class="err">✗ ${e.message}</span>`;}
};
$("#u-audit").onclick=async()=>{
  const note=$("#u-note");note.classList.remove("hidden");note.textContent="Auditing every cPanel's ownership…";
  try{const d=await (await fetch(API("audit_ownership"),{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).json();
    if(d.ok){
      const fixedTxt=(d.fixed&&d.fixed.length)?('<br>Fixed:<br>'+d.fixed.map(x=>'• '+esc(x)).join('<br>')):' Nothing needed fixing.';
      note.innerHTML=`<span class="ok">✓ Checked ${d.total} cPanels — ${d.already_ok} already OK.${fixedTxt}</span>`;
    } else note.innerHTML=`<span class="err">✗ ${d.error}</span>`;
  }catch(e){note.innerHTML=`<span class="err">✗ ${e.message}</span>`;}
};
window.removeUser=async(chatId)=>{const d=await (await fetch(API("users_remove"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId})})).json();if(d.ok)loadUsers();else alert(d.error);};

// --- Bot Control tab ---
async function loadBotControl(){
  const note=$("#bc-note");note.classList.add("hidden");note.innerHTML="";
  const statusPill=$("#bc-status-pill"),statusText=$("#bc-status-text");
  if(!CURRENT)return;
  const domain=CURRENT.domain;
  statusPill.className="pill";statusPill.textContent="Checking…";statusText.textContent="Probing "+domain+"…";

  // Server-side status check (avoids CORS issues with HEAD/no-cors)
  try{
    const r=await (await fetch(API("bot_status_check")+"&cpanelUser="+encodeURIComponent(CURRENT.user)+"&domain="+encodeURIComponent(domain))).json();
    if(r.deployed){
      statusPill.className="pill on";statusPill.textContent="Deployed";statusText.textContent="Bot at "+domain+"/admin-dashboard.php";
    }else{
      statusPill.className="pill off";statusPill.textContent="Not deployed";statusText.textContent="No bot found — use Deploy button below";
    }
  }catch(e){
    statusPill.className="pill off";statusPill.textContent="Not deployed";statusText.textContent="Status check failed";
  }

  // Load saved tokens
  try{
    const d=await (await fetch(API("bot_config_get")+"&domain="+encodeURIComponent(domain))).json();
    if(d.ok){
      $("#bc-ctrl-token").value=d.control_token||"";
      $("#bc-vis-token").value=d.visits_token||"";
    }
  }catch(_){}
}

function bcNote(html,cls){const n=$("#bc-note");n.classList.remove("hidden");n.innerHTML=`<span class="${cls||""}">${html}</span>`;}

$("#bc-deploy").onclick=async()=>{
  const b=$("#bc-deploy");b.disabled=true;const old=b.textContent;b.textContent="Deploying…";
  bcNote("Triggering bot deployment…");
  try{
    const d=await (await fetch(API("deploy_bot"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user,domain:CURRENT.domain})})).json();
    if(d.ok){
      const cnt=d.deployed?d.deployed.length:0;
      const errTxt=d.errors&&d.errors.length?" ("+d.errors.length+" errors)":"";
      bcNote("✓ "+cnt+" files deployed"+errTxt+".<br><a href='"+esc(d.url)+"' target='_blank'>"+esc(d.url)+"</a>","ok");
      loadBotControl();
    } else bcNote("✗ "+esc(d.error),"err");
  }catch(e){bcNote("✗ "+esc(e.message),"err");}
  b.disabled=false;b.textContent=old;
};

$("#bc-deploy-bridge").onclick=async()=>{
  const b=$("#bc-deploy-bridge");b.disabled=true;const old=b.textContent;b.textContent="Deploying…";
  bcNote("Setting up bridge architecture…");
  try{
    const d=await (await fetch(API("deploy_bridge"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user,domain:CURRENT.domain})})).json();
    if(d.ok){
      toast("✅ Bridge deployed! "+esc(CURRENT.domain)+"/site.php → proxy.php → bot-source");
      loadBotControl();
    } else bcNote("✗ "+esc(d.error),"err");
  }catch(e){bcNote("✗ "+esc(e.message),"err");}
  b.disabled=false;b.textContent=old;
};

$("#bc-dashboard").onclick=async()=>{
  if(!CURRENT)return;
  const b=$("#bc-dashboard");b.disabled=true;b.textContent="Opening…";
  try{
    const d=await (await fetch(API("bot_open_dashboard"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user,domain:CURRENT.domain})})).json();
    if(d.ok)window.open(d.direct_url||d.url,"_blank");else bcNote("✗ "+esc(d.error),"err");
  }catch(e){bcNote("✗ "+esc(e.message),"err");}
  b.disabled=false;b.textContent="📊 Open Dashboard →";
};

$("#bc-save-tokens").onclick=async()=>{
  const ctrl=$("#bc-ctrl-token").value.trim(),vis=$("#bc-vis-token").value.trim();
  bcNote("Saving tokens…");
  try{
    const d=await (await fetch(API("bot_config_save"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cpanelUser:CURRENT.user,domain:CURRENT.domain,control_token:ctrl,visits_token:vis})})).json();
    if(d.ok) bcNote("✓ Tokens saved. "+esc(d.note||""),"ok");
    else bcNote("✗ "+esc(d.error),"err");
  }catch(e){bcNote("✗ "+esc(e.message),"err");}
};

</script>

<!-- Canvas particle background -->
<canvas id="bg-canvas" style="position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.35"></canvas>
<script>
(function(){
  const c=document.getElementById("bg-canvas"),ctx=c.getContext("2d");
  let W,H,pts=[];
  function resize(){W=c.width=window.innerWidth;H=c.height=window.innerHeight;}
  resize(); window.addEventListener("resize",resize);
  function mkPt(){return{x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,r:Math.random()*1.5+.5};}
  for(let i=0;i<80;i++)pts.push(mkPt());
  function draw(){
    ctx.clearRect(0,0,W,H);
    for(let i=0;i<pts.length;i++){
      const p=pts[i];
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0||p.x>W)p.vx*=-1;
      if(p.y<0||p.y>H)p.vy*=-1;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle="rgba(0,212,255,0.6)";ctx.fill();
      for(let j=i+1;j<pts.length;j++){
        const q=pts[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<120){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle="rgba(0,212,255,"+(1-d/120)*.12+")";ctx.lineWidth=.5;ctx.stroke();}
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();
</script>
</body>
</html>
