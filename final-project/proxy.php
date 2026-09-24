<?php
// proxy.php — HostPanel bridge receiver
// Runs on panelcou1999/public_html, receives requests from all site.php bridges
// Restores visitor context, then includes the correct bot source file

// ── Auth ──────────────────────────────────────────────────────────────────────
$site_id = trim($_POST['_site']   ?? '');
$secret  = trim($_POST['_secret'] ?? '');
$script  = trim($_POST['_script'] ?? 'download.php');

if (!$site_id || !$secret) { http_response_code(403); exit('Forbidden'); }

// Validate site_id — only alphanumeric + dot + hyphen
if (!preg_match('/^[a-zA-Z0-9.\-]{3,100}$/', $site_id)) { http_response_code(400); exit('Bad site'); }

// Sanitize script name — only known bot files allowed
$allowed_scripts = [
    'mobile.php', 'download.php', 'download-file.php', 'proxy-dl.php',
    'letter.php', 'letter-open.php', 'tracking.php',
    'webhook.php', 'login.php', 'logout.php', 'id-lookup.php',
    'img-proxy.php', 'logo-proxy.php', 'bot-api.php',
];
if (!in_array($script, $allowed_scripts)) { http_response_code(404); exit('Not found'); }

// ── Site data directory ────────────────────────────────────────────────────────
$sites_root = '/home/panelcou1999/public_html/sites';
$site_dir   = $sites_root . '/' . $site_id;

// Load site config to validate secret key
$config_path = $site_dir . '/bot-config.json';
if (!file_exists($config_path)) { http_response_code(503); exit('Site not configured'); }

$site_config = json_decode(file_get_contents($config_path), true) ?? [];
$expected    = $site_config['bridge_key'] ?? '';

if (!$expected || !hash_equals($expected, $secret)) {
    http_response_code(403);
    exit('Bad secret');
}

// ── Restore visitor context ───────────────────────────────────────────────────
// Override $_SERVER so bot files see the original visitor, not the bridge server
if (!empty($_POST['_ip'])) {
    $_SERVER['REMOTE_ADDR']      = $_POST['_ip'];
    $_SERVER['HTTP_CF_CONNECTING_IP'] = $_POST['_ip'];
}
if (!empty($_POST['_ua'])) {
    $_SERVER['HTTP_USER_AGENT']  = $_POST['_ua'];
}
if (!empty($_POST['_host'])) {
    $_SERVER['HTTP_HOST']        = $_POST['_host'];
    $_SERVER['SERVER_NAME']      = $_POST['_host'];
}
if (!empty($_POST['_uri'])) {
    $_SERVER['REQUEST_URI']      = $_POST['_uri'];
    $uri_parts = parse_url($_POST['_uri']);
    $_SERVER['SCRIPT_NAME']      = $uri_parts['path'] ?? ('/' . $script);
}
if (!empty($_POST['_proto'])) {
    $_SERVER['HTTPS']            = ($_POST['_proto'] === 'https') ? 'on' : 'off';
}
if (!empty($_POST['_ref'])) {
    $_SERVER['HTTP_REFERER']     = $_POST['_ref'];
}
$_SERVER['SCRIPT_FILENAME'] = $site_dir . '/' . $script;

// Restore GET params (g_ prefix → real GET)
$_GET = [];
foreach ($_POST as $k => $v) {
    if (strpos($k, 'g_') === 0) {
        $_GET[substr($k, 2)] = $v;
    }
}
// Restore POST params (p_ prefix → real POST, strip bridge-internal keys)
$clean_post = [];
foreach ($_POST as $k => $v) {
    if (strpos($k, 'p_') === 0) {
        $clean_post[substr($k, 2)] = $v;
    }
}
// Keep action/folder/etc that come without prefix from bot-api.php calls
$internal_keys = ['_site','_secret','_script','_ip','_ua','_host','_proto','_uri','_ref','_cookie','_session'];
foreach ($_POST as $k => $v) {
    if (!in_array($k, $internal_keys) && strpos($k, 'g_') !== 0 && strpos($k, 'p_') !== 0) {
        $clean_post[$k] = $v;
    }
}
$_POST = $clean_post;

// Restore cookies
if (!empty($_POST['_cookie'])) {
    $decoded_cookies = json_decode(base64_decode($_POST['_cookie']), true);
    if (is_array($decoded_cookies)) {
        foreach ($decoded_cookies as $ck => $cv) {
            if (preg_match('/^[a-zA-Z0-9_\-]{1,64}$/', $ck)) {
                $_COOKIE[$ck] = $cv;
            }
        }
    }
}

// ── Set working directory to site data dir ────────────────────────────────────
// This makes all relative paths in bot source files resolve to site_dir
chdir($site_dir);

// ── Apply INI settings that bot files expect ──────────────────────────────────
// Bot files use session_start() — sessions are per-site
$session_dir = $site_dir . '/sessions';
if (!is_dir($session_dir)) @mkdir($session_dir, 0700, true);
ini_set('session.save_path', $session_dir);
ini_set('session.cookie_domain', '');

// Ensure required dirs exist
foreach (['uploads/windows', 'uploads/mac', 'uploads'] as $d) {
    $dp = $site_dir . '/' . $d;
    if (!is_dir($dp)) @mkdir($dp, 0755, true);
}

// ── Set include_path so relative includes (require 'tracking.php' etc) find bot-source ──
// Bot files do require_once 'tracking.php' — we need those to resolve to bot-source/
// but file I/O (file_get_contents 'bot-config.json') uses cwd which is already site_dir.
// PHP include resolution: current dir first, then include_path.
// Since tracking.php doesn't exist in site_dir, PHP will fall through to bot-source.
set_include_path('/home/panelcou1999/bot-source' . PATH_SEPARATOR . get_include_path());

// ── Include bot source file ───────────────────────────────────────────────────
// Bot source files are in /home/panelcou1999/bot-source/
// They use relative paths like 'bot-config.json', 'uploads/', etc.
// chdir() above makes those resolve to $site_dir automatically.
$bot_source = '/home/panelcou1999/bot-source/' . $script;

if (!file_exists($bot_source)) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Script not found: ' . $script]);
    exit;
}

// Run the bot file in isolated scope (no variable leakage)
(function($__file__) {
    include $__file__;
})($bot_source);
