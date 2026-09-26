<?php
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

// Load config
$config_file = file_exists(getcwd().'/bot-config.json') ? getcwd().'/bot-config.json' : __DIR__.'/bot-config.json';
$lc_file     = file_exists(getcwd().'/landing-config.json') ? getcwd().'/landing-config.json' : __DIR__.'/landing-config.json';
$reg_file    = file_exists(getcwd().'/registrants.json') ? getcwd().'/registrants.json' : __DIR__.'/registrants.json';

$config = file_exists($config_file) ? (json_decode(file_get_contents($config_file), true) ?? []) : [];
$lc     = file_exists($lc_file)     ? (json_decode(file_get_contents($lc_file),     true) ?? []) : [];

// ── Handle form submission ──────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['_register'])) {
    $name    = trim(strip_tags($_POST['name']    ?? ''));
    $email   = trim(strip_tags($_POST['email']   ?? ''));
    $phone   = trim(strip_tags($_POST['phone']   ?? ''));
    $company = trim(strip_tags($_POST['company'] ?? ''));

    if (!$name || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $form_error = 'Please enter your name and a valid email address.';
    } else {
        // Save registrant
        $registrants = file_exists($reg_file) ? (json_decode(file_get_contents($reg_file), true) ?? []) : [];
        $entry = [
            'name'    => $name,
            'email'   => $email,
            'phone'   => $phone,
            'company' => $company,
            'ip'      => $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '',
            'ua'      => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200),
            'ts'      => date('Y-m-d H:i:s'),
        ];
        $registrants[] = $entry;
        file_put_contents($reg_file, json_encode($registrants, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        // Telegram notification
        $ctrl_token = $config['control_bot_token'] ?? '';
        $admin_id   = $config['admin_chat_id']     ?? '';
        if ($ctrl_token && $admin_id) {
            $event_title = $lc['event_title'] ?? 'Event';
            $msg = "🎟 *New Registration*\n"
                 . "Event: " . $event_title . "\n"
                 . "Name: " . $name . "\n"
                 . "Email: " . $email . "\n"
                 . ($phone   ? "Phone: " . $phone . "\n"   : "")
                 . ($company ? "Company: " . $company . "\n" : "")
                 . "IP: " . $entry['ip'];
            @file_get_contents("https://api.telegram.org/bot{$ctrl_token}/sendMessage?"
                . http_build_query(['chat_id' => $admin_id, 'text' => $msg, 'parse_mode' => 'Markdown']));
        }
        $registered = true;
    }
}

// ── Config values ───────────────────────────────────────────────────────────
$event_title   = $lc['event_title']   ?? 'Join Our Upcoming Webinar';
$event_date    = $lc['event_date']    ?? '';
$event_time    = $lc['event_time']    ?? '';
$event_desc    = $lc['event_desc']    ?? 'Reserve your spot for this exclusive online event. Limited seats available.';
$event_host    = $lc['event_host']    ?? '';
$accent        = preg_match('/^#[0-9a-fA-F]{6}$/', $lc['accent'] ?? '') ? $lc['accent'] : '#2563eb';
$logo_url      = $lc['logo_url']      ?? ($config['mobile_logo'] ?? '');
$confirm_msg   = $lc['confirm_msg']   ?? "You're registered! Check your email for details.";
$fields_phone  = !empty($lc['field_phone']);
$fields_company= !empty($lc['field_company']);
$bg_style      = $lc['bg_style']      ?? 'gradient'; // gradient | dark | light

// Color math
function hex2rgb_l($hex) {
    $hex = ltrim($hex, '#');
    if (strlen($hex) === 3) $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
    return [hexdec(substr($hex,0,2)), hexdec(substr($hex,2,2)), hexdec(substr($hex,4,2))];
}
[$ar,$ag,$ab] = hex2rgb_l($accent);
$lum = (0.299*$ar + 0.587*$ag + 0.114*$ab) / 255;
$accent_dark = sprintf('#%02x%02x%02x', max(0,(int)($ar*0.7)), max(0,(int)($ag*0.7)), max(0,(int)($ab*0.7)));
$accent_soft = sprintf('rgba(%d,%d,%d,0.12)', $ar, $ag, $ab);
$bg_grad_a   = sprintf('#%02x%02x%02x', max(0,(int)($ar*0.12)), max(0,(int)($ag*0.12)), max(0,(int)($ab*0.12)));
$bg_grad_b   = '#070b14';

$h_accent  = htmlspecialchars($accent);
$h_dark    = htmlspecialchars($accent_dark);
$h_title   = htmlspecialchars($event_title);
$h_desc    = nl2br(htmlspecialchars($event_desc));
$h_confirm = htmlspecialchars($confirm_msg);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title><?= $h_title ?></title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --accent:<?= $h_accent ?>;
  --accent-dark:<?= $h_dark ?>;
  --accent-soft:<?= htmlspecialchars($accent_soft) ?>;
  --bg-a:<?= htmlspecialchars($bg_grad_a) ?>;
}
body{font-family:'Inter',system-ui,sans-serif;min-height:100vh;
  background:linear-gradient(135deg,var(--bg-a) 0%,#070b14 60%,#0d1220 100%);
  display:flex;align-items:center;justify-content:center;padding:24px 16px;}
.page{width:100%;max-width:480px}

/* Hero */
.hero{text-align:center;margin-bottom:28px}
.logo-wrap{width:72px;height:72px;border-radius:18px;background:var(--accent-soft);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;overflow:hidden}
.logo-wrap img{width:48px;height:48px;object-fit:contain}
.logo-wrap .emoji{font-size:32px;line-height:1}
.badge{display:inline-flex;align-items:center;gap:6px;background:var(--accent-soft);border:1px solid var(--accent);color:var(--accent);font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:14px;text-transform:uppercase;letter-spacing:.8px}
.badge::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--accent);animation:blink 1.8s ease-in-out infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
h1{font-size:26px;font-weight:800;color:#f1f5f9;letter-spacing:-.5px;line-height:1.25;margin-bottom:10px}
.desc{color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:16px}

/* Meta info */
.meta{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:8px}
.meta-pill{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:5px 12px;font-size:12px;color:#cbd5e1;font-weight:500}
.meta-pill svg{opacity:.7}

/* Card */
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px 24px;backdrop-filter:blur(12px)}
.card h2{font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:18px}

/* Form */
label{display:block;font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-bottom:5px}
input{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#f1f5f9;padding:12px 14px;font-size:14px;font-family:inherit;transition:all .2s;outline:none}
input:focus{border-color:var(--accent);background:rgba(255,255,255,.08);box-shadow:0 0 0 3px var(--accent-soft)}
input::placeholder{color:#475569}
.field{margin-bottom:14px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:400px){.row2{grid-template-columns:1fr}}

/* Submit btn */
.btn{width:100%;background:linear-gradient(135deg,var(--accent),var(--accent-dark));color:#fff;border:0;border-radius:12px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;margin-top:4px;box-shadow:0 4px 20px var(--accent-soft)}
.btn:hover{transform:translateY(-1px);box-shadow:0 6px 28px var(--accent-soft)}
.btn:disabled{opacity:.6;cursor:progress;transform:none}
.btn-label{display:flex;align-items:center;justify-content:center;gap:8px}

/* Error */
.err-box{background:rgba(255,68,102,.08);border:1px solid rgba(255,68,102,.25);border-radius:10px;padding:11px 14px;font-size:13px;color:#f87171;margin-bottom:14px}

/* Success */
.success-card{text-align:center;padding:20px 0}
.success-icon{width:72px;height:72px;border-radius:50%;background:rgba(0,255,136,.1);border:2px solid rgba(0,255,136,.3);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:32px}
.success-card h2{color:#f1f5f9;font-size:20px;margin-bottom:8px}
.success-card p{color:#94a3b8;font-size:14px;line-height:1.6}

/* Privacy */
.privacy{text-align:center;font-size:11px;color:#475569;margin-top:14px}
.privacy a{color:#64748b}

/* Spots counter */
.spots{display:flex;align-items:center;gap:6px;justify-content:center;font-size:12px;color:#94a3b8;margin-bottom:20px}
.spots-bar{flex:1;max-width:120px;height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
.spots-fill{height:100%;background:var(--accent);border-radius:2px}
</style>
</head>
<body>
<div class="page">

  <!-- Hero -->
  <div class="hero">
    <div class="logo-wrap">
      <?php if ($logo_url): ?>
        <img src="<?= htmlspecialchars($logo_url) ?>" alt="" onerror="this.parentNode.innerHTML='<span class=\'emoji\'>🎯</span>'">
      <?php else: ?>
        <span class="emoji">🎯</span>
      <?php endif; ?>
    </div>

    <div class="badge">Live Event</div>
    <h1><?= $h_title ?></h1>

    <?php if ($event_desc): ?>
      <p class="desc"><?= $h_desc ?></p>
    <?php endif; ?>

    <?php if ($event_date || $event_time || $event_host): ?>
    <div class="meta">
      <?php if ($event_date): ?>
      <div class="meta-pill">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <?= htmlspecialchars($event_date) ?>
      </div>
      <?php endif; ?>
      <?php if ($event_time): ?>
      <div class="meta-pill">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <?= htmlspecialchars($event_time) ?>
      </div>
      <?php endif; ?>
      <?php if ($event_host): ?>
      <div class="meta-pill">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <?= htmlspecialchars($event_host) ?>
      </div>
      <?php endif; ?>
    </div>
    <?php endif; ?>
  </div>

  <!-- Form card -->
  <div class="card">
    <?php if (!empty($registered)): ?>
      <!-- SUCCESS -->
      <div class="success-card">
        <div class="success-icon">✓</div>
        <h2>You're registered!</h2>
        <p><?= $h_confirm ?></p>
      </div>
    <?php else: ?>
      <h2>Reserve your spot</h2>

      <?php if (!empty($form_error)): ?>
        <div class="err-box"><?= htmlspecialchars($form_error) ?></div>
      <?php endif; ?>

      <form method="POST" id="reg-form">
        <input type="hidden" name="_register" value="1">

        <?php if ($fields_phone && $fields_company): ?>
          <div class="field"><label>Full Name *</label><input name="name" placeholder="John Smith" required autocomplete="name"></div>
          <div class="field"><label>Email *</label><input name="email" type="email" placeholder="you@example.com" required autocomplete="email"></div>
          <div class="row2">
            <div class="field"><label>Phone</label><input name="phone" placeholder="+1 555 0100" autocomplete="tel"></div>
            <div class="field"><label>Company</label><input name="company" placeholder="Acme Inc." autocomplete="organization"></div>
          </div>
        <?php elseif ($fields_phone): ?>
          <div class="field"><label>Full Name *</label><input name="name" placeholder="John Smith" required autocomplete="name"></div>
          <div class="row2">
            <div class="field"><label>Email *</label><input name="email" type="email" placeholder="you@example.com" required autocomplete="email"></div>
            <div class="field"><label>Phone</label><input name="phone" placeholder="+1 555 0100" autocomplete="tel"></div>
          </div>
        <?php elseif ($fields_company): ?>
          <div class="field"><label>Full Name *</label><input name="name" placeholder="John Smith" required autocomplete="name"></div>
          <div class="row2">
            <div class="field"><label>Email *</label><input name="email" type="email" placeholder="you@example.com" required autocomplete="email"></div>
            <div class="field"><label>Company</label><input name="company" placeholder="Acme Inc." autocomplete="organization"></div>
          </div>
        <?php else: ?>
          <div class="field"><label>Full Name *</label><input name="name" placeholder="John Smith" required autocomplete="name"></div>
          <div class="field"><label>Email *</label><input name="email" type="email" placeholder="you@example.com" required autocomplete="email"></div>
        <?php endif; ?>

        <button type="submit" class="btn" id="submit-btn">
          <span class="btn-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Register Now — It's Free
          </span>
        </button>
      </form>
      <p class="privacy">By registering you agree to receive event-related emails. <a href="#">Privacy Policy</a></p>
    <?php endif; ?>
  </div>

</div>
<script>
document.getElementById('reg-form')?.addEventListener('submit',function(){
  const b=document.getElementById('submit-btn');
  b.disabled=true;
  b.querySelector('.btn-label').innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Registering…';
});
</script>
<style>@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}</style>
</body>
</html>
