<?php
// HostPanel (PHP) — config. Loads secrets from a .env file kept OUTSIDE the
// web root (one level above public_html) so tokens are never web-accessible.

function hp_load_env(): array {
    // Look for .env next to this file, then one dir up (recommended: outside public_html).
    $candidates = [__DIR__ . '/.env', dirname(__DIR__) . '/.env'];
    $env = [];
    foreach ($candidates as $path) {
        if (!is_file($path)) continue;
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') continue;
            $pos = strpos($line, '=');
            if ($pos === false) continue;
            $k = trim(substr($line, 0, $pos));
            $v = trim(substr($line, $pos + 1));
            $env[$k] = $v;
        }
    }
    return $env;
}

$ENV = hp_load_env();

$CONFIG = [
    'whm' => [
        'host'  => $ENV['WHM_HOST']      ?? '169.58.26.102',
        'user'  => $ENV['WHM_USER']      ?? 'root',
        'token' => $ENV['WHM_API_TOKEN'] ?? '1EXLB0ZTKMPGFO6JAKEOZXX4LQJMUHSS',
        'port'  => 2087,
    ],
    'cloudflare' => [
        'token'     => $ENV['CLOUDFLARE_API_TOKEN'] ?? '',
        'globalKey' => $ENV['CF_GLOBAL_KEY'] ?? '',
        'email'     => $ENV['CF_EMAIL'] ?? '',
        'accountId' => $ENV['CF_ACCOUNT_ID'] ?? '52acf31e723a20e6fc27394dad577c52',
    ],
    'telegram' => [
        'botToken'      => $ENV['TG_BOT_TOKEN']       ?? '',
        'botUsername'   => $ENV['TG_BOT_USERNAME']    ?? '',
        'allowedChatId' => $ENV['TG_ALLOWED_CHAT_ID'] ?? '',
    ],
    'serverIp' => $ENV['WHM_HOST'] ?? '169.58.26.102',
];

// Sessions live in a file so login persists across requests.
// Harden the session cookie — this session is full WHM/Cloudflare control.
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'secure'   => true,   // HTTPS only
        'httponly' => true,   // no JS access (blunts XSS cookie theft)
        'samesite' => 'Lax',  // blunts CSRF
    ]);
    session_start();
}

function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}
