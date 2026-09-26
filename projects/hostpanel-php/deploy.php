<?php
// One-off deployer: uploads HostPanel's PHP files into the target cPanel's
// public_html via WHM's cPanel proxy (Fileman::upload_files, multipart POST).
// Run locally:  php deploy.php
require_once __DIR__ . '/config.php';

$w  = $CONFIG['whm'];
$CU = getenv('CPANEL_USER') ?: 'panelcou1999';
$destDir = "/home/$CU/public_html";

$files = ['index.php', 'config.php', 'lib.php', 'api.php'];

function upload_file(array $w, string $CU, string $destDir, string $localPath, string $name): array {
    $url = "https://{$w['host']}:{$w['port']}/json-api/cpanel";
    $post = [
        'api.version'               => '1',
        'cpanel_jsonapi_user'       => $CU,
        'cpanel_jsonapi_apiversion' => '3',
        'cpanel_jsonapi_module'     => 'Fileman',
        'cpanel_jsonapi_func'       => 'upload_files',
        'dir'                       => $destDir,
        'file-1'                    => new CURLFile($localPath, 'text/plain', $name),
    ];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $post,
        CURLOPT_HTTPHEADER     => ["Authorization: whm {$w['user']}:{$w['token']}"],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_TIMEOUT        => 60,
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($raw === false) return ['ok' => false, 'error' => $err];
    $d = json_decode($raw, true);
    $r = $d['result'] ?? $d;
    $status = $r['status'] ?? ($d['result']['data']['succeeded'] ?? 0);
    return ['ok' => ($status == 1) || !empty($r['data']), 'raw' => substr($raw, 0, 300)];
}

foreach ($files as $f) {
    $local = __DIR__ . '/' . $f;
    if (!is_file($local)) { echo "SKIP (missing): $f\n"; continue; }
    $res = upload_file($w, $CU, $destDir, $local, $f);
    echo ($res['ok'] ? "OK   " : "FAIL ") . $f . "  " . ($res['raw'] ?? $res['error'] ?? '') . "\n";
}
echo "\nDone. Test: https://{$w['host']} (or the domain once nameservers propagate)\n";
