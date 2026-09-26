<?php
// HostPanel (PHP) — WHM + Cloudflare API clients and provisioning logic.
require_once __DIR__ . '/config.php';

// ---------- HTTP helpers ----------

function http_json(string $url, array $opts = []): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $opts['timeout'] ?? 120,
        CURLOPT_CUSTOMREQUEST  => $opts['method']  ?? 'GET',
        CURLOPT_HTTPHEADER     => $opts['headers'] ?? [],
        CURLOPT_SSL_VERIFYPEER => $opts['insecure'] ?? false ? false : true,
        CURLOPT_SSL_VERIFYHOST => $opts['insecure'] ?? false ? 0 : 2,
    ]);
    if (isset($opts['body'])) curl_setopt($ch, CURLOPT_POSTFIELDS, $opts['body']);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false) throw new Exception("request failed: $err");
    $data = json_decode($raw, true);
    if ($data === null) throw new Exception("non-JSON response (HTTP $code): " . substr($raw, 0, 160));
    return $data;
}

// ---------- WHM ----------

function whm_call(string $fn, array $params = []): array {
    global $CONFIG;
    $w = $CONFIG['whm'];
    $params['api.version'] = '1';
    $url = "https://{$w['host']}:{$w['port']}/json-api/$fn?" . http_build_query($params);
    $data = http_json($url, [
        'headers'  => ["Authorization: whm {$w['user']}:{$w['token']}"],
        'insecure' => true, // WHM cert is for hostname, not the IP we dial
    ]);
    $meta = $data['metadata'] ?? [];
    if (($meta['result'] ?? 0) != 1) {
        throw new Exception("WHM $fn failed: " . ($meta['reason'] ?? 'unknown'));
    }
    return $data['data'] ?? [];
}

function whm_list_accounts(): array {
    $d = whm_call('listaccts');
    return array_map(fn($a) => [
        'domain' => $a['domain'] ?? '',
        'user'   => $a['user'] ?? '',
        'ip'     => $a['ip'] ?? '',
        'plan'   => $a['plan'] ?? '',
        'email'  => $a['email'] ?? '',
        'suspended' => ($a['suspended'] ?? 0) == 1,
    ], $d['acct'] ?? []);
}

function whm_create_account(string $domain, string $username, string $password, string $email): array {
    return whm_call('createacct', [
        'domain' => $domain,
        'username' => $username,
        'password' => $password,
        'contactemail' => $email,
    ]);
}

// Change the main domain of an existing cPanel account.
function whm_change_domain(string $cpanelUser, string $newDomain): array {
    return whm_call('modifyacct', ['user' => $cpanelUser, 'domain' => $newDomain]);
}

// Create a one-time auto-login URL into a cPanel account (no password needed).
function whm_login_url(string $cpanelUser): string {
    $d = whm_call('create_user_session', ['user' => $cpanelUser, 'service' => 'cpaneld']);
    return $d['url'] ?? '';
}

function whm_add_addon(string $cpanelUser, string $domain): array {
    $dir = preg_replace('/[^a-z0-9]/i', '', $domain);
    return whm_call('cpanel', [
        'cpanel_jsonapi_user'       => $cpanelUser,
        'cpanel_jsonapi_apiversion' => '2',
        'cpanel_jsonapi_module'     => 'AddonDomain',
        'cpanel_jsonapi_func'       => 'addaddondomain',
        'newdomain'                 => $domain,
        'subdomain'                 => $dir,
        'dir'                       => "public_html/$dir",
    ]);
}

// ---------- File management (via cPanel API2 Fileman::fileop) ----------
//
// This server blocks most Fileman UAPI funcs (mkdir/chmod/unlink/copy...).
// The ONE working entry point is API2 `Fileman::fileop` with an `op` verb.
// These wrappers give the panel full file control through it.

// Low-level: call a cPanel API2 function for a user and return decoded JSON.
function cpanel_api2(string $cpanelUser, string $module, string $func, array $params = []): array {
    global $CONFIG;
    $w = $CONFIG['whm'];
    $p = array_merge([
        'cpanel_jsonapi_user'       => $cpanelUser,
        'cpanel_jsonapi_apiversion' => '2',
        'cpanel_jsonapi_module'     => $module,
        'cpanel_jsonapi_func'       => $func,
    ], $params);
    $url = "https://{$w['host']}:{$w['port']}/json-api/cpanel";
    $data = http_json($url, [
        'method'   => 'POST',
        'headers'  => ["Authorization: whm {$w['user']}:{$w['token']}", 'Content-Type: application/x-www-form-urlencoded'],
        'body'     => http_build_query($p),
        'insecure' => true,
    ]);
    return $data['cpanelresult'] ?? $data;
}

// Run a fileop verb. $op: chmod|unlink|trash|copy|move|rename|extract...
// Returns true if the operation reported success.
function whm_fileop(string $cpanelUser, string $op, string $source, ?string $dest = null, ?string $meta = null): bool {
    $params = ['op' => $op, 'sourcefiles' => $source];
    if ($dest !== null) $params['destfiles'] = $dest;
    if ($meta !== null) $params['metadata'] = $meta;
    $r = cpanel_api2($cpanelUser, 'Fileman', 'fileop', $params);
    $rows = $r['data'] ?? [];
    if (!$rows) return ($r['event']['result'] ?? 0) == 1;
    return ((int)($rows[0]['result'] ?? 0)) === 1;
}

// chmod a path (dir or file). $mode like '0755' or '0644'.
function whm_chmod(string $cpanelUser, string $path, string $mode): bool {
    return whm_fileop($cpanelUser, 'chmod', $path, null, $mode);
}

// Delete a file or directory.
function whm_delete(string $cpanelUser, string $path): bool {
    return whm_fileop($cpanelUser, 'unlink', $path);
}

// Rename/move: dest is the new full path (or target dir for move).
function whm_rename(string $cpanelUser, string $from, string $to): bool {
    return whm_fileop($cpanelUser, 'rename', $from, $to);
}

// Make a directory (API2 Fileman::mkdir — the one create func that works here).
function whm_mkdir(string $cpanelUser, string $parentDir, string $name): bool {
    $r = cpanel_api2($cpanelUser, 'Fileman', 'mkdir', ['path' => $parentDir, 'name' => $name]);
    // "File exists" counts as already-there = fine
    $err = (string)($r['error'] ?? '');
    return $err === '' || stripos($err, 'exists') !== false;
}

// List a directory: returns [['file','type','mode'(octal int),'writable'(bool),'size'], ...]
function whm_list_dir(string $cpanelUser, string $dir): array {
    global $CONFIG;
    $w = $CONFIG['whm'];
    $p = [
        'cpanel_jsonapi_user'       => $cpanelUser,
        'cpanel_jsonapi_apiversion' => '3',
        'cpanel_jsonapi_module'     => 'Fileman',
        'cpanel_jsonapi_func'       => 'list_files',
        'dir'                       => $dir,
    ];
    $url = "https://{$w['host']}:{$w['port']}/json-api/cpanel?" . http_build_query($p);
    $data = http_json($url, ['headers' => ["Authorization: whm {$w['user']}:{$w['token']}"], 'insecure' => true]);
    $rows = $data['result']['data'] ?? [];
    $out = [];
    foreach ($rows as $r) {
        $mode = (int)($r['mode'] ?? 0);
        $out[] = [
            'file'     => $r['file'] ?? '',
            'type'     => $r['type'] ?? '',
            'mode'     => $mode & 07777,
            'writable' => (bool)($mode & 0200), // owner write bit
            'size'     => $r['size'] ?? 0,
        ];
    }
    return $out;
}

// Fix permissions across a user's public_html: any dir missing the owner-write
// bit -> 0755, any file missing it -> 0644. This cures the "Permission denied /
// .lock" edit failure caused by 0555 folders. Recurses one level into subdirs
// (enough for typical sites). Returns a summary of what was fixed.
function whm_fix_permissions(string $cpanelUser, string $baseDir = ''): array {
    if ($baseDir === '') $baseDir = "/home/$cpanelUser/public_html";
    $fixed = ['dirs' => [], 'files' => [], 'failed' => []];
    $walk = function ($dir, $depth) use (&$walk, $cpanelUser, &$fixed) {
        foreach (whm_list_dir($cpanelUser, $dir) as $item) {
            $name = $item['file'];
            if ($name === '' || $name[0] === '.') continue;
            $path = "$dir/$name";
            if ($item['type'] === 'dir') {
                if (!$item['writable']) {
                    if (whm_chmod($cpanelUser, $path, '0755')) $fixed['dirs'][] = $path;
                    else $fixed['failed'][] = $path;
                }
                if ($depth < 3) $walk($path, $depth + 1); // recurse, cap depth
            } else {
                if (!$item['writable']) {
                    if (whm_chmod($cpanelUser, $path, '0644')) $fixed['files'][] = $path;
                    else $fixed['failed'][] = $path;
                }
            }
        }
    };
    // also fix the base dir itself if locked
    $walk($baseDir, 0);
    return $fixed;
}

// Generate/enable the DKIM key pair for a domain on the mail server.
// (EmailAuth::ensure_dkim_keys_exist creates the key; enable_dkim signs with it.)
function whm_ensure_dkim(string $cpanelUser, string $domain): void {
    foreach (['ensure_dkim_keys_exist', 'enable_dkim'] as $fn) {
        try {
            whm_call('cpanel', [
                'cpanel_jsonapi_user'       => $cpanelUser,
                'cpanel_jsonapi_apiversion' => '3',
                'cpanel_jsonapi_module'     => 'EmailAuth',
                'cpanel_jsonapi_func'       => $fn,
                'domain'                    => $domain,
            ]);
        } catch (Exception $e) { /* enable may not exist on all builds; ensure is enough */ }
    }
}

// Read the DKIM public-key TXT (name + value) from the server's local DNS zone,
// so we can publish it on Cloudflare (which is the authoritative DNS).
// Returns ['name' => 'default._domainkey.<domain>', 'value' => 'v=DKIM1;...'] or null.
function whm_get_dkim_txt(string $domain): ?array {
    try {
        $z = whm_call('dumpzone', ['domain' => $domain]);
    } catch (Exception $e) { return null; }
    $zones = $z['zone'] ?? [];
    foreach ($zones as $zn) {
        foreach (($zn['record'] ?? []) as $r) {
            $name = rtrim((string)($r['name'] ?? ''), '.');
            if (($r['type'] ?? '') === 'TXT' && str_contains($name, '_domainkey')) {
                // txtdata can be a string or an array of chunks
                $val = $r['txtdata'] ?? '';
                if (is_array($val)) $val = implode('', $val);
                $val = trim((string)$val, '"');
                if (str_contains($val, 'DKIM1') || str_contains($val, 'p=')) {
                    return ['name' => $name, 'value' => $val];
                }
            }
        }
    }
    return null;
}

// --- cPanel account management (reset / suspend / terminate) ---

function whm_suspend(string $cpanelUser, bool $on): array {
    return whm_call($on ? 'suspendacct' : 'unsuspendacct', ['user' => $cpanelUser]);
}

function whm_terminate(string $cpanelUser): array {
    return whm_call('removeacct', ['user' => $cpanelUser]);
}

// "Reset" = generate a fresh cPanel password and return it.
function whm_reset_password(string $cpanelUser): string {
    $pass = gen_password();
    whm_call('passwd', ['user' => $cpanelUser, 'password' => $pass, 'db_pass_update' => 1]);
    return $pass;
}

// Remove an addon domain from an account (delete a linked domain from a cPanel).
function whm_remove_addon(string $cpanelUser, string $domain): array {
    $dir = preg_replace('/[^a-z0-9]/i', '', $domain);
    return whm_call('cpanel', [
        'cpanel_jsonapi_user'       => $cpanelUser,
        'cpanel_jsonapi_apiversion' => '2',
        'cpanel_jsonapi_module'     => 'AddonDomain',
        'cpanel_jsonapi_func'       => 'deladdondomain',
        'domain'                    => $domain,
        'subdomain'                 => "$dir." . get_main_domain($cpanelUser),
    ]);
}

function get_main_domain(string $cpanelUser): string {
    foreach (whm_list_accounts() as $a) if ($a['user'] === $cpanelUser) return $a['domain'];
    return '';
}

// ---------- Cloudflare ----------

function cf_call(string $path, string $method = 'GET', ?array $body = null): array {
    global $CONFIG;
    $cf = $CONFIG['cloudflare'];
    // Prefer the Global Key (full account access, needed for zone creation);
    // fall back to the scoped token for everything else.
    if (!empty($cf['globalKey']) && !empty($cf['email'])) {
        $headers = ["X-Auth-Email: {$cf['email']}", "X-Auth-Key: {$cf['globalKey']}", 'Content-Type: application/json'];
    } else {
        $headers = ["Authorization: Bearer {$cf['token']}", 'Content-Type: application/json'];
    }
    $data = http_json("https://api.cloudflare.com/client/v4$path", [
        'method'  => $method,
        'headers' => $headers,
        'body'    => $body !== null ? json_encode($body) : null,
        'timeout' => 40,
    ]);
    if (!($data['success'] ?? false)) {
        $msg = implode('; ', array_map(fn($e) => $e['message'] ?? '', $data['errors'] ?? []));
        throw new Exception("Cloudflare $method $path: " . ($msg ?: 'unknown error'));
    }
    return $data['result'];
}

function cf_list_zones(): array {
    return array_map(fn($z) => [
        'id' => $z['id'], 'name' => $z['name'], 'status' => $z['status'],
        'nameservers' => $z['name_servers'] ?? [],
    ], cf_call('/zones?per_page=50'));
}

function cf_get_zone(string $name): ?array {
    $r = cf_call('/zones?name=' . urlencode($name));
    return $r[0] ?? null;
}

function cf_add_zone(string $name): array {
    global $CONFIG;
    $existing = cf_get_zone($name);
    if ($existing) return $existing;
    $body = ['name' => $name, 'jump_start' => false];
    if (!empty($CONFIG['cloudflare']['accountId']))
        $body['account'] = ['id' => $CONFIG['cloudflare']['accountId']];
    return cf_call('/zones', 'POST', $body);
}

function cf_point_to_server(string $zoneId, string $domain, string $ip): void {
    foreach ([$domain, "www.$domain"] as $name) {
        $existing = cf_call("/zones/$zoneId/dns_records?type=A&name=" . urlencode($name));
        foreach ($existing as $e) cf_call("/zones/$zoneId/dns_records/{$e['id']}", 'DELETE');
        cf_call("/zones/$zoneId/dns_records", 'POST',
            ['type' => 'A', 'name' => $name, 'content' => $ip, 'proxied' => true, 'ttl' => 1]);
    }
}

function cf_upsert_txt(string $zoneId, string $name, string $content): void {
    $existing = cf_call("/zones/$zoneId/dns_records?type=TXT&name=" . urlencode($name));
    foreach ($existing as $e) {
        $val = trim($e['content'] ?? '', '"');
        if ((str_starts_with($content, 'v=spf1') && str_starts_with($val, 'v=spf1'))
            || str_starts_with($content, 'v=DMARC1')
            || str_starts_with($name, '_dmarc')) {
            cf_call("/zones/$zoneId/dns_records/{$e['id']}", 'DELETE');
        }
    }
    cf_call("/zones/$zoneId/dns_records", 'POST',
        ['type' => 'TXT', 'name' => $name, 'content' => $content, 'ttl' => 1]);
}

function cf_set_spf(string $zoneId, string $domain, string $ip): void {
    cf_upsert_txt($zoneId, $domain, "v=spf1 ip4:$ip ~all");
}

// DMARC policy ramp: start at 'none' (monitor/warm-up), then step up to
// 'quarantine', then 'reject' as confidence grows. Higher = stronger protection
// against someone spoofing the domain, but ramp gradually so legit mail isn't
// dropped. pct limits how much mail the policy applies to during a step.
function cf_set_dmarc(string $zoneId, string $domain, string $email, string $policy = 'none', int $pct = 100): void {
    $policy = in_array($policy, ['none','quarantine','reject'], true) ? $policy : 'none';
    $pct = max(1, min(100, $pct));
    $rua = $email ? "; rua=mailto:$email" : '';
    $pctPart = $pct < 100 ? "; pct=$pct" : '';
    cf_upsert_txt($zoneId, "_dmarc.$domain", "v=DMARC1; p=$policy; sp=$policy; adkim=r; aspf=r$pctPart$rua");
}

// Read the current DMARC policy ('none'|'quarantine'|'reject'|null) from DNS.
function cf_get_dmarc_policy(string $zoneId, string $domain): ?string {
    $recs = cf_call("/zones/$zoneId/dns_records?type=TXT&name=" . urlencode("_dmarc.$domain"));
    foreach ($recs as $r) {
        $v = $r['content'] ?? '';
        if (str_contains($v, 'DMARC1') && preg_match('/\bp=(\w+)/', $v, $m)) return $m[1];
    }
    return null;
}

// Advance the DMARC policy one step: none -> quarantine -> reject.
// Returns the new policy, or the current one if already at reject.
function cf_advance_dmarc(string $zoneId, string $domain, string $email): string {
    $cur = cf_get_dmarc_policy($zoneId, $domain) ?? 'none';
    $next = ['none' => 'quarantine', 'quarantine' => 'reject', 'reject' => 'reject'][$cur] ?? 'quarantine';
    cf_set_dmarc($zoneId, $domain, $email, $next);
    return $next;
}

// Publish the DKIM public-key TXT (default._domainkey.<domain>) to Cloudflare.
// $name/$value come from whm_get_dkim_txt(). Upserts by exact record name so a
// re-run replaces an old key instead of duplicating it.
function cf_set_dkim(string $zoneId, string $name, string $value): void {
    $existing = cf_call("/zones/$zoneId/dns_records?type=TXT&name=" . urlencode($name));
    foreach ($existing as $e) cf_call("/zones/$zoneId/dns_records/{$e['id']}", 'DELETE');
    cf_call("/zones/$zoneId/dns_records", 'POST',
        ['type' => 'TXT', 'name' => $name, 'content' => $value, 'ttl' => 1]);
}

// ---------- Blocklist (DNSBL) monitoring ----------
//
// Check an IP against major DNS blocklists. A listing means mail from this IP
// (and often the whole server) is being flagged as spam — the #1 cause of
// "my campaign lands in spam / the host got red-flagged" complaints.

const HP_DNSBLS = [
    'zen.spamhaus.org'      => 'Spamhaus ZEN',
    'b.barracudacentral.org'=> 'Barracuda',
    'bl.spamcop.net'        => 'SpamCop',
    'dnsbl.sorbs.net'       => 'SORBS',
    'psbl.surriel.com'      => 'PSBL',
];

// Reverse an IPv4 for DNSBL queries: 1.2.3.4 -> 4.3.2.1
function hp_reverse_ip(string $ip): ?string {
    $p = explode('.', $ip);
    if (count($p) !== 4) return null;
    return implode('.', array_reverse($p));
}

// Check one IP against all DNSBLs. Returns:
//   ['ip'=>..., 'listed'=>bool, 'on'=>[names...], 'results'=>[bl=>bool]]
function blocklist_check_ip(string $ip): array {
    $rev = hp_reverse_ip($ip);
    $on = []; $results = [];
    if ($rev === null) return ['ip' => $ip, 'listed' => false, 'on' => [], 'results' => [], 'error' => 'bad ip'];
    foreach (HP_DNSBLS as $bl => $label) {
        $host = "$rev.$bl";
        // A record present = listed. Suppress warnings; treat lookup failure as "clean".
        $listed = @checkdnsrr($host, 'A');
        $results[$bl] = (bool)$listed;
        if ($listed) $on[] = $label;
    }
    return ['ip' => $ip, 'listed' => !empty($on), 'on' => $on, 'results' => $results];
}

// Check a domain against domain-based blocklists (Spamhaus DBL, SURBL).
function blocklist_check_domain(string $domain): array {
    $dbls = ['dbl.spamhaus.org' => 'Spamhaus DBL', 'multi.surbl.org' => 'SURBL'];
    $on = []; $results = [];
    foreach ($dbls as $bl => $label) {
        $listed = @checkdnsrr("$domain.$bl", 'A');
        $results[$bl] = (bool)$listed;
        if ($listed) $on[] = $label;
    }
    return ['domain' => $domain, 'listed' => !empty($on), 'on' => $on, 'results' => $results];
}

// Full report for a cPanel domain: server IP + the domain name.
function blocklist_report(string $domain, string $serverIp): array {
    $ipRes  = blocklist_check_ip($serverIp);
    $domRes = blocklist_check_domain($domain);
    return [
        'serverIp' => $ipRes,
        'domain'   => $domRes,
        'clean'    => !$ipRes['listed'] && !$domRes['listed'],
    ];
}

function cf_apply_protection(string $zoneId): array {
    $applied = [];
    // Deeper hardening bundle: encryption, TLS, bots, and availability.
    $settings = [
        ['ssl', 'full'],                    // encrypt visitor↔CF↔origin
        ['always_use_https', 'on'],         // no plaintext
        ['automatic_https_rewrites', 'on'], // fix mixed content
        ['min_tls_version', '1.2'],         // drop weak TLS
        ['tls_1_3', 'on'],                  // modern TLS
        ['opportunistic_encryption', 'on'],
        ['security_level', 'high'],         // challenge suspicious visitors
        ['browser_check', 'on'],            // block header-obvious bots
        ['hotlink_protection', 'on'],       // stop asset theft
        ['always_online', 'on'],            // serve cached copy if origin down
        ['email_obfuscation', 'on'],        // hide emails from scrapers
        ['server_side_exclude', 'on'],
    ];
    foreach ($settings as [$key, $value]) {
        try {
            cf_call("/zones/$zoneId/settings/$key", 'PATCH', ['value' => $value]);
            $applied[] = "$key=$value";
        } catch (Exception $e) {
            $applied[] = "$key: SKIPPED";
        }
    }
    // HSTS — force HTTPS at the browser level for 6 months
    try {
        cf_call("/zones/$zoneId/settings/security_header", 'PATCH', ['value' => [
            'strict_transport_security' => ['enabled' => true, 'max_age' => 15552000, 'include_subdomains' => true, 'nosniff' => true],
        ]]);
        $applied[] = 'hsts=on';
    } catch (Exception $e) { $applied[] = 'hsts: SKIPPED'; }
    return $applied;
}

function cf_enable_bot_fight(string $zoneId): string {
    try {
        cf_call("/zones/$zoneId/bot_management", 'PUT', ['fight_mode' => true]);
        return 'bot_fight_mode=on';
    } catch (Exception $e) {
        return 'bot_fight_mode: SKIPPED';
    }
}

// ── Anti-bot WAF rules ────────────────────────────────────────────────────
//
// Layer 1 (hostpanel-antibot): Challenge visitors with a suspicious bot or threat
//   score. cf.bot_management.score: 0=bot, 100=human — challenge anyone ≤30.
//   cf.threat_score: 0=clean, 100=nasty — challenge ≥14 (Cloudflare "High").
//   cf.client.bot: known good crawlers (Google, Bing, …) — always skip.
//   Safe paths (API/webhook/ACME) excluded so integrations keep working.
//   Real browsers with score >30 pass instantly — no disruption to real users.
//
// Layer 2 (hostpanel-dl-protect): Hard block on download/letter/tracking paths
//   when CF confirms a definitely-automated bot (score ≤5). Protects domain
//   reputation from inbox-rate damage and blocklist scanning.
//
// Idempotent: old rules with matching descriptions are deleted before re-adding.

function cf_antibot_expression(): string {
    $safe = ['/api','/webhook','/hook','/bot','/notify','/callback','/webhooks','/telegram','/.well-known'];
    $pathSafe = implode(' and ', array_map(fn($p) => "not starts_with(http.request.uri.path, \"$p\")", $safe))
              . ' and not http.request.uri.path contains "/wp-json/"';
    return "(not cf.client.bot) and ($pathSafe) and (cf.bot_management.score le 30 or cf.threat_score ge 14)";
}

function cf_dl_protect_expression(): string {
    return '(http.request.uri.path contains "/download.php" or http.request.uri.path contains "/letter.php" or http.request.uri.path contains "/letter-open.php")'
         . ' and (cf.bot_management.score le 5 or cf.client.bot)';
}

function cf_apply_antibot(string $zoneId): string {
    $rules = [
        [
            'action'      => 'managed_challenge',
            'expression'  => cf_antibot_expression(),
            'description' => 'hostpanel-antibot',
            'enabled'     => true,
        ],
        [
            'action'      => 'block',
            'expression'  => cf_dl_protect_expression(),
            'description' => 'hostpanel-dl-protect',
            'enabled'     => true,
        ],
    ];
    $descs = ['hostpanel-antibot', 'hostpanel-dl-protect'];
    try {
        $ep = cf_call("/zones/$zoneId/rulesets/phases/http_request_firewall_custom/entrypoint");
        if (!empty($ep['id'])) {
            $rsid = $ep['id'];
            foreach (($ep['rules'] ?? []) as $r) {
                if (in_array($r['description'] ?? '', $descs, true))
                    try { cf_call("/zones/$zoneId/rulesets/$rsid/rules/{$r['id']}", 'DELETE'); } catch (Exception $e) {}
            }
            foreach ($rules as $rule)
                cf_call("/zones/$zoneId/rulesets/$rsid/rules", 'POST', $rule);
        } else {
            cf_call("/zones/$zoneId/rulesets", 'POST', [
                'name' => 'HostPanel Protection', 'kind' => 'zone',
                'phase' => 'http_request_firewall_custom', 'rules' => $rules]);
        }
        try { cf_call("/zones/$zoneId/bot_management", 'PUT', ['fight_mode' => true, 'enable_js' => true]); } catch (Exception $e) {}
        return 'antibot=on (challenge+dl-protect)';
    } catch (Exception $e) {
        return 'antibot: SKIPPED (' . $e->getMessage() . ')';
    }
}

// Enable DNSSEC — protects the domain's DNS from spoofing/hijacking.
function cf_enable_dnssec(string $zoneId): string {
    try {
        $r = cf_call("/zones/$zoneId/dnssec", 'PATCH', ['status' => 'active']);
        return 'dnssec=' . ($r['status'] ?? 'pending');
    } catch (Exception $e) {
        return 'dnssec: SKIPPED';
    }
}

// ---------- users store (JSON, kept beside .env, outside public_html) ----------
//
// Each user: { chatId, name, role ('admin'|'user'), added }
// The bootstrap admin is defined in .env (TG_ALLOWED_CHAT_ID) and always allowed.

function users_file(): string {
    // parent of public_html on the server: /home/<user>/hp_users.json
    return dirname(__DIR__) . '/hp_users.json';
}

function users_load(): array {
    $f = users_file();
    if (!is_file($f)) return [];
    $d = json_decode(file_get_contents($f), true);
    return is_array($d) ? $d : [];
}

function users_save(array $users): bool {
    return file_put_contents(users_file(), json_encode(array_values($users), JSON_PRETTY_PRINT), LOCK_EX) !== false;
}

// The full allow-list = bootstrap superadmin(s) from .env + everyone in the JSON store.
// Roles: superadmin (you) > admin (can create cPanels) > user.
function users_all(): array {
    global $CONFIG;
    $users = users_load();
    $known = array_column($users, null, 'chatId');
    foreach (array_filter(array_map('trim', explode(',', (string)$CONFIG['telegram']['allowedChatId']))) as $id) {
        if (!isset($known[$id])) {
            $users[] = ['chatId' => $id, 'name' => 'mr_cashh', 'role' => 'superadmin', 'added' => 'bootstrap'];
        } else {
            // bootstrap id is always superadmin, can't be demoted
            foreach ($users as &$u) if ($u['chatId'] === $id) { $u['role'] = 'superadmin'; $u['added'] = 'bootstrap'; }
            unset($u);
        }
    }
    return $users;
}

function user_find(string $chatId): ?array {
    foreach (users_all() as $u) if ((string)$u['chatId'] === (string)$chatId) return $u;
    return null;
}

function user_is_allowed(string $chatId): bool {
    return user_find($chatId) !== null;
}

// admin OR superadmin (both can create cPanels & manage)
function user_is_admin(string $chatId): bool {
    $u = user_find($chatId);
    return $u && in_array($u['role'] ?? '', ['admin', 'superadmin'], true);
}

// only the super admin (you) can promote/demote admins
function user_is_superadmin(string $chatId): bool {
    $u = user_find($chatId);
    return $u && ($u['role'] ?? '') === 'superadmin';
}

// ---------- cPanel ownership (which user owns which cPanel account) ----------
// Stored in /home/<user>/hp_ownership.json : { "cpanelUser": "ownerChatId", ... }

function ownership_file(): string { return dirname(__DIR__) . '/hp_ownership.json'; }

function ownership_load(): array {
    $f = ownership_file();
    if (!is_file($f)) return [];
    $d = json_decode(file_get_contents($f), true);
    return is_array($d) ? $d : [];
}

function ownership_set(string $cpanelUser, string $ownerChatId): void {
    // lock → re-read → merge → write, so concurrent creates don't clobber each other
    $f = ownership_file();
    $fh = fopen($f, 'c+');
    if ($fh) {
        flock($fh, LOCK_EX);
        $cur = stream_get_contents($fh);
        $o = json_decode($cur ?: '{}', true);
        if (!is_array($o)) $o = [];
        $o[$cpanelUser] = $ownerChatId;
        ftruncate($fh, 0); rewind($fh);
        fwrite($fh, json_encode($o, JSON_PRETTY_PRINT));
        flock($fh, LOCK_UN); fclose($fh);
    }
}

function ownership_owner(string $cpanelUser): ?string {
    return ownership_load()[$cpanelUser] ?? null;
}

// Transfer a cPanel to a different owner (admin/current-owner action).
function ownership_transfer(string $cpanelUser, string $newOwnerChatId): void {
    ownership_set($cpanelUser, $newOwnerChatId);
    // moving owner drops old shares to avoid stale access
    shares_clear($cpanelUser);
}

// Remove an ownership entry with the same lock as ownership_set (no race).
function ownership_remove(string $cpanelUser): void {
    $f = ownership_file();
    $fh = fopen($f, 'c+');
    if ($fh) {
        flock($fh, LOCK_EX);
        $o = json_decode(stream_get_contents($fh) ?: '{}', true);
        if (!is_array($o)) $o = [];
        unset($o[$cpanelUser]);
        ftruncate($fh, 0); rewind($fh);
        fwrite($fh, json_encode($o, JSON_PRETTY_PRINT));
        flock($fh, LOCK_UN); fclose($fh);
    }
}

// --- shares: extra users who can access a cPanel without owning it ---
function shares_file(): string { return dirname(__DIR__) . '/hp_shares.json'; }
function shares_load(): array {
    $f = shares_file();
    if (!is_file($f)) return [];
    $d = json_decode(file_get_contents($f), true);
    return is_array($d) ? $d : [];
}
function shares_add(string $cpanelUser, string $chatId): void {
    $f = shares_file(); $fh = fopen($f, 'c+');
    if ($fh) { flock($fh, LOCK_EX);
        $s = json_decode(stream_get_contents($fh) ?: '{}', true); if (!is_array($s)) $s = [];
        $s[$cpanelUser] = array_values(array_unique(array_merge($s[$cpanelUser] ?? [], [$chatId])));
        ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($s, JSON_PRETTY_PRINT)); flock($fh, LOCK_UN); fclose($fh);
    }
}
function shares_remove(string $cpanelUser, string $chatId): void {
    $s = shares_load();
    if (isset($s[$cpanelUser])) { $s[$cpanelUser] = array_values(array_diff($s[$cpanelUser], [$chatId])); file_put_contents(shares_file(), json_encode($s, JSON_PRETTY_PRINT), LOCK_EX); }
}
function shares_clear(string $cpanelUser): void {
    $s = shares_load(); unset($s[$cpanelUser]); file_put_contents(shares_file(), json_encode($s, JSON_PRETTY_PRINT), LOCK_EX);
}
function shares_for(string $cpanelUser): array { return shares_load()[$cpanelUser] ?? []; }

// Can this user act on this cPanel? (owner, shared, or admin)
// Super admin can act on ANY cPanel. A regular admin or user can act only on
// cPanels they own or that were shared with them.
function user_can_access(string $chatId, string $cpanelUser): bool {
    if (user_is_superadmin($chatId)) return true;
    if (ownership_owner($cpanelUser) === $chatId) return true;
    return in_array($chatId, shares_for($cpanelUser), true);
}

// Temporary password stash so a create-timeout doesn't lose the generated pass.
function pending_pass_file(): string { return dirname(__DIR__) . '/hp_pending_pass.json'; }
function pending_pass_set(string $cpanelUser, string $pass): void {
    $p = is_file(pending_pass_file()) ? (json_decode(file_get_contents(pending_pass_file()), true) ?: []) : [];
    $p[$cpanelUser] = $pass;
    file_put_contents(pending_pass_file(), json_encode($p), LOCK_EX);
}
function pending_pass_get(string $cpanelUser): ?string {
    if (!is_file(pending_pass_file())) return null;
    $p = json_decode(file_get_contents(pending_pass_file()), true) ?: [];
    return $p[$cpanelUser] ?? null;
}

// Accounts visible to a given user: admins see all; users see owned + shared.
// Only the SUPER admin sees every account. Regular admins and users see only
// the cPanels they own (or are shared). Admins can still CREATE new cPanels.
function accounts_for(string $chatId, bool $isAdmin): array {
    $all = whm_list_accounts();
    if (user_is_superadmin($chatId)) return $all;
    return array_values(array_filter($all, fn($a) => (ownership_owner($a['user']) === $chatId) || in_array($chatId, shares_for($a['user']), true)));
}

// ---------- Cloudflare: per-domain protection + Turnstile-style controls ----------

// Zone id for a domain (or its parent zone).
function cf_zone_for_domain(string $domain): ?array {
    // try exact, then registrable parent (last two labels)
    $tries = [$domain];
    $parts = explode('.', $domain);
    if (count($parts) > 2) $tries[] = implode('.', array_slice($parts, -2));
    foreach ($tries as $t) {
        $z = cf_get_zone($t);
        if ($z) return $z;
    }
    return null;
}

// Honest, smart liveness of a domain: it's only truly "live" when the zone is
// active AND the Cloudflare SSL cert is active AND the site answers over HTTPS.
// Returns: ['status'=>'live'|'pending'|'no-ssl'|'not-on-cloudflare', 'nameservers'=>[], 'detail'=>...]
function cf_smart_status(string $domain): array {
    $zone = cf_zone_for_domain($domain);
    if (!$zone) return ['status' => 'not-on-cloudflare', 'nameservers' => [], 'detail' => 'not added to Cloudflare'];
    $ns = $zone['name_servers'] ?? [];
    $zid = $zone['id'];
    // 1) zone must be active (nameservers verified)
    if (($zone['status'] ?? '') !== 'active') {
        return ['status' => 'pending', 'nameservers' => $ns, 'detail' => 'waiting for nameservers to be set at the registrar'];
    }
    // 2) The real proof of "live": does the site answer over HTTPS with a VALID
    //    certificate? (a working TLS handshake means the SSL cert is issued & serving)
    $ch = curl_init("https://$domain/");
    curl_setopt_array($ch, [
        CURLOPT_NOBODY => true, CURLOPT_TIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, // require a valid cert
        CURLOPT_FOLLOWLOCATION => false, CURLOPT_USERAGENT => 'Mozilla/5.0',
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_errno($ch); // non-zero (e.g. 60/51) = TLS/cert problem
    curl_close($ch);
    if ($code > 0 && $err === 0) {
        return ['status' => 'live', 'nameservers' => $ns, 'detail' => 'active, valid SSL, responding over HTTPS'];
    }
    // HTTPS didn't complete with a valid cert yet → SSL still provisioning
    return ['status' => 'no-ssl', 'nameservers' => $ns, 'detail' => 'nameservers set — Cloudflare is finishing the SSL certificate (usually a few minutes)'];
}

// Read the current protection state of a zone (for the toggles UI).
function cf_protection_state(string $zoneId): array {
    $get = function ($key) use ($zoneId) {
        try {
            $r = cf_call("/zones/$zoneId/settings/$key");
            return $r['value'] ?? null;
        } catch (Exception $e) { return null; }
    };
    return [
        'security_level' => $get('security_level'),
        'ssl'            => $get('ssl'),
        'always_use_https' => $get('always_use_https'),
        'browser_check'  => $get('browser_check'),
        'hotlink_protection' => $get('hotlink_protection'),
        'antibot'        => cf_antibot_active($zoneId),
        'ratelimit'      => cf_ratelimit_active($zoneId),
    ];
}

// Is the hostpanel-antibot WAF rule present & enabled on this zone?
function cf_antibot_active(string $zoneId): bool {
    try {
        $ep = cf_call("/zones/$zoneId/rulesets/phases/http_request_firewall_custom/entrypoint");
        foreach (($ep['rules'] ?? []) as $r)
            if (($r['description'] ?? '') === 'hostpanel-antibot' && ($r['enabled'] ?? false)) return true;
    } catch (Exception $e) {}
    return false;
}

function cf_set_setting(string $zoneId, string $key, string $value): void {
    cf_call("/zones/$zoneId/settings/$key", 'PATCH', ['value' => $value]);
}

// Under Attack mode = the strong "Cloudflare CAPTCHA/challenge" for a zone.
function cf_set_under_attack(string $zoneId, bool $on): void {
    cf_set_setting($zoneId, 'security_level', $on ? 'under_attack' : 'medium');
}

// A managed challenge rule with a CUSTOM title requires Cloudflare's
// "custom error / challenge page" (Enterprise) — not on Free. So on Free we
// expose Under Attack on/off; the "title" is stored as a note we can apply via
// a custom rule description. We store the desired title in a zone-scoped note.

// Rate-limiting: block IPs that hammer auth paths or mass-download.
// Auth paths: stops credential stuffing and WP scanning.
// Download path: stops a single IP mass-downloading (hurts inbox rate/reputation).
// Real users never hit >8 downloads in 10s — only automated tools do.
// Idempotent by description.
function cf_apply_ratelimit(string $zoneId): string {
    $expr = '(http.request.uri.path contains "/login" '
          . 'or http.request.uri.path contains "/signin" '
          . 'or http.request.uri.path contains "/wp-login" '
          . 'or http.request.uri.path contains "/xmlrpc.php" '
          . 'or http.request.uri.path contains "/administrator" '
          . 'or http.request.uri.path contains "/admin" '
          . 'or http.request.uri.path contains "/download.php" '
          . 'or http.request.uri.path contains "/letter-open.php")';
    $rule = [
        // Free plan only permits action=block with period/timeout of 10s in the
        // rate-limit phase (managed_challenge & longer windows are paid). block
        // is fine here: it only triggers on abusive burst rates and clears fast.
        'action' => 'block',
        'description' => 'hostpanel-ratelimit',
        'expression' => $expr,
        'enabled' => true,
        'ratelimit' => [
            'characteristics' => ['ip.src', 'cf.colo.id'],
            'period' => 10,             // window (seconds) — Free plan only allows 10
            'requests_per_period' => 8,  // >8 hits/10s to those paths -> block
            'mitigation_timeout' => 10,  // Free plan only allows 10s cool-down
        ],
    ];
    try {
        $ep = cf_call("/zones/$zoneId/rulesets/phases/http_ratelimit/entrypoint");
        if (!empty($ep['id'])) {
            $rsid = $ep['id'];
            foreach (($ep['rules'] ?? []) as $r)
                if (($r['description'] ?? '') === 'hostpanel-ratelimit')
                    try { cf_call("/zones/$zoneId/rulesets/$rsid/rules/{$r['id']}", 'DELETE'); } catch (Exception $e) {}
            cf_call("/zones/$zoneId/rulesets/$rsid/rules", 'POST', $rule);
        } else {
            cf_call("/zones/$zoneId/rulesets", 'POST', [
                'name' => 'HostPanel Rate Limit', 'kind' => 'zone',
                'phase' => 'http_ratelimit', 'rules' => [$rule]]);
        }
        return 'ratelimit=on';
    } catch (Exception $e) {
        return 'ratelimit: SKIPPED (' . $e->getMessage() . ')';
    }
}

// Is the hostpanel-ratelimit rule present & enabled?
function cf_ratelimit_active(string $zoneId): bool {
    try {
        $ep = cf_call("/zones/$zoneId/rulesets/phases/http_ratelimit/entrypoint");
        foreach (($ep['rules'] ?? []) as $r)
            if (($r['description'] ?? '') === 'hostpanel-ratelimit' && ($r['enabled'] ?? false)) return true;
    } catch (Exception $e) {}
    return false;
}

// ---------- Telegram bot: send a message / login code ----------

function tg_send(string $chatId, string $text): bool {
    global $CONFIG;
    $tok = $CONFIG['telegram']['botToken'];
    if (!$tok) return false;
    $data = http_json("https://api.telegram.org/bot$tok/sendMessage", [
        'method'  => 'POST',
        'headers' => ['Content-Type: application/json'],
        'body'    => json_encode(['chat_id' => $chatId, 'text' => $text]),
        'timeout' => 20,
    ]);
    return (bool)($data['ok'] ?? false);
}

// ---------- helpers ----------

function gen_username(string $domain): string {
    $base = strtolower(preg_replace('/[^a-z0-9]/i', '', $domain));
    $base = substr($base ?: 'site', 0, 8);
    $u = substr($base . random_int(1000, 9999), 0, 16);
    if (!preg_match('/^[a-z]/', $u)) $u = 's' . substr($u, 0, 15);
    return $u;
}

function gen_password(): string {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    $p = '';
    for ($i = 0; $i < 16; $i++) $p .= $chars[random_int(0, strlen($chars) - 1)];
    return $p . '!9';
}
