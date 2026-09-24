<?php
// HostPanel (PHP) — API entry point. Routed as /api.php?action=...
// Login: user enters their Telegram chat ID -> bot sends a code -> user enters
// the code -> session created. Admins can add/remove users by chat ID.
require_once __DIR__ . '/lib.php';

$action = $_GET['action'] ?? '';
$input  = json_decode(file_get_contents('php://input'), true) ?: [];

// ---------- auth guards ----------

function current_user(): ?array {
    if (empty($_SESSION['hp_admin'])) return null;
    // Always resolve the CURRENT role from the store, so promotions/demotions
    // take effect immediately without requiring the user to log out and back in.
    $s = $_SESSION['hp_admin'];
    $fresh = user_find((string)$s['chatId']);
    if ($fresh) { $s['role'] = $fresh['role']; $s['name'] = $fresh['name'] ?? $s['name']; }
    return $s;
}

function require_auth(): void {
    if (empty($_SESSION['hp_admin'])) json_out(['ok' => false, 'error' => 'not authenticated'], 401);
}

function require_admin(): void {
    require_auth();
    if (!user_is_admin((string)$_SESSION['hp_admin']['chatId']))
        json_out(['ok' => false, 'error' => 'admin only'], 403);
}

function gen_code(): string {
    return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

// ---------- WHM UAPI proxy helper ----------

function whm_cpanel_uapi(string $cpanelUser, string $module, string $func, array $params = []): array {
    global $CONFIG;
    $w = $CONFIG['whm'];
    $base = "https://{$w['host']}:2087";
    $body = http_build_query(array_merge([
        'api.version'               => '1',
        'cpanel_jsonapi_user'       => $cpanelUser,
        'cpanel_jsonapi_apiversion' => '3',
        'cpanel_jsonapi_module'     => $module,
        'cpanel_jsonapi_func'       => $func,
    ], $params));

    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => "Authorization: whm {$w['user']}:{$w['token']}\r\nContent-Type: application/x-www-form-urlencoded\r\n",
        'content' => $body,
        'timeout' => 15,
    ], 'ssl' => ['verify_peer' => false, 'verify_peer_name' => false]]);
    $raw = @file_get_contents("$base/json-api/cpanel", false, $ctx);
    if ($raw === false) return ['status' => 0, 'errors' => ['Request failed']];
    $resp = json_decode($raw, true);
    return $resp['result'] ?? ['status' => 0, 'errors' => ['Bad response']];
}

function whm_api1(string $func, array $params = []): array {
    global $CONFIG;
    $w = $CONFIG['whm'];
    $base = "https://{$w['host']}:2087";
    $qs = http_build_query(array_merge(['api.version' => '1'], $params));
    $ctx = stream_context_create(['http' => [
        'method'  => 'GET',
        'header'  => "Authorization: whm {$w['user']}:{$w['token']}\r\n",
        'timeout' => 5,
    ], 'ssl' => ['verify_peer' => false, 'verify_peer_name' => false]]);
    $raw = @file_get_contents("$base/json-api/$func?$qs", false, $ctx);
    if ($raw === false) throw new Exception("WHM API1 $func failed");
    return json_decode($raw, true) ?? [];
}

// ---------- routes ----------

try {
    switch ($action) {

        case 'auth_config':
            json_out([
                'telegramEnabled' => (bool)$CONFIG['telegram']['botToken'],
                'loggedIn' => !empty($_SESSION['hp_admin']),
                'me' => current_user(),  // resolves the live role
            ]);

        // Step 1: user submits chat ID -> we send a code via the bot
        case 'login_request':
            $chatId = preg_replace('/[^0-9]/', '', (string)($input['chatId'] ?? ''));
            if ($chatId === '') json_out(['ok' => false, 'error' => 'Enter your Telegram numeric chat ID'], 400);
            if (!user_is_allowed($chatId))
                json_out(['ok' => false, 'error' => 'Code sent to your Telegram if this ID is registered.'], 200);
            $code = gen_code();
            $_SESSION['login_code'] = $code;
            $_SESSION['login_chat'] = $chatId;
            $_SESSION['login_exp']  = time() + 300; // 5 min
            $sent = tg_send($chatId, "HostPanel login code: $code\n(valid 5 minutes)");
            if (!$sent) {
                // You're on the list, but the bot can't DM you until you start it.
                // This is a friendly heads-up, not an error.
                $bot = $CONFIG['telegram']['botUsername'] ?: 'the bot';
                json_out(['ok' => true, 'needsStart' => true,
                    'message' => "You're added ✓ — but open @$bot on Telegram and press Start first, then tap “Send login code” again so it can message you the code."]);
            }
            json_out(['ok' => true, 'message' => 'Code sent to your Telegram.']);

        // Step 2: user submits the code -> create session
        case 'login_verify':
            $code = preg_replace('/[^0-9]/', '', (string)($input['code'] ?? ''));
            if (empty($_SESSION['login_code']) || time() > ($_SESSION['login_exp'] ?? 0))
                json_out(['ok' => false, 'error' => 'Code expired. Request a new one.'], 400);
            // brute-force guard: max 5 tries, and burn the code on any wrong guess
            $_SESSION['login_tries'] = ($_SESSION['login_tries'] ?? 0) + 1;
            if ($_SESSION['login_tries'] > 5) {
                unset($_SESSION['login_code'], $_SESSION['login_chat'], $_SESSION['login_exp'], $_SESSION['login_tries']);
                json_out(['ok' => false, 'error' => 'Too many attempts. Request a new code.'], 429);
            }
            if (!hash_equals($_SESSION['login_code'], $code)) {
                unset($_SESSION['login_code']); // force a fresh code request
                json_out(['ok' => false, 'error' => 'Wrong code. Request a new one.'], 401);
            }
            $chatId = $_SESSION['login_chat'];
            $u = user_find($chatId);
            session_regenerate_id(true); // prevent session fixation
            $_SESSION['hp_admin'] = ['chatId' => $chatId, 'name' => $u['name'] ?? $chatId, 'role' => $u['role'] ?? 'user'];
            unset($_SESSION['login_code'], $_SESSION['login_chat'], $_SESSION['login_exp'], $_SESSION['login_tries']);
            json_out(['ok' => true, 'me' => $_SESSION['hp_admin']]);

        case 'logout':
            $_SESSION = [];
            session_destroy();
            json_out(['ok' => true]);

        // ---------- user management (admin only) ----------

        case 'users_list':
            require_admin();
            json_out(['ok' => true, 'users' => users_all(), 'me' => current_user()]);

        case 'users_add':
            require_admin();
            $me = current_user();
            $chatId = preg_replace('/[^0-9]/', '', (string)($input['chatId'] ?? ''));
            $name = trim((string)($input['name'] ?? '')) ?: $chatId;
            $wantRole = (string)($input['role'] ?? 'user');
            // only the super admin can create admins; a normal admin can only add plain users
            $role = ($wantRole === 'admin' && user_is_superadmin((string)$me['chatId'])) ? 'admin' : 'user';
            if ($chatId === '') json_out(['ok' => false, 'error' => 'Enter a numeric chat ID'], 400);
            $users = users_load();
            foreach ($users as $u) if ($u['chatId'] === $chatId) json_out(['ok' => false, 'error' => 'User already exists'], 400);
            $users[] = ['chatId' => $chatId, 'name' => $name, 'role' => $role, 'added' => date('Y-m-d')];
            users_save($users);
            tg_send($chatId, "You've been added to HostPanel ($role). Open the panel and log in with this chat ID.");
            json_out(['ok' => true, 'users' => users_all()]);

        // Promote/demote a user's role — super admin only.
        case 'set_role':
            require_auth();
            $me = current_user();
            if (!user_is_superadmin((string)$me['chatId'])) json_out(['ok' => false, 'error' => 'super admin only'], 403);
            $chatId = preg_replace('/[^0-9]/', '', (string)($input['chatId'] ?? ''));
            $role = in_array(($input['role'] ?? ''), ['admin', 'user', 'superadmin'], true) ? $input['role'] : null;
            if (!$chatId || !$role) json_out(['ok' => false, 'error' => 'need chatId + role (superadmin|admin|user)'], 400);
            $boot = array_filter(array_map('trim', explode(',', (string)$CONFIG['telegram']['allowedChatId'])));
            if (in_array($chatId, $boot, true)) json_out(['ok' => false, 'error' => 'cannot change the super admin'], 400);
            $users = users_load(); $found = false;
            foreach ($users as &$u) if ($u['chatId'] === $chatId) { $u['role'] = $role; $found = true; }
            unset($u);
            if (!$found) json_out(['ok' => false, 'error' => 'user not found'], 404);
            users_save($users);
            tg_send($chatId, "Your HostPanel role is now: $role.");
            json_out(['ok' => true, 'users' => users_all()]);

        case 'users_remove':
            require_admin();
            $chatId = preg_replace('/[^0-9]/', '', (string)($input['chatId'] ?? ''));
            // never remove a bootstrap admin from .env
            $boot = array_filter(array_map('trim', explode(',', (string)$CONFIG['telegram']['allowedChatId'])));
            if (in_array($chatId, $boot, true)) json_out(['ok' => false, 'error' => 'Cannot remove the bootstrap admin'], 400);
            $users = array_filter(users_load(), fn($u) => $u['chatId'] !== $chatId);
            users_save($users);
            json_out(['ok' => true, 'users' => users_all()]);

        // Admin assigns an existing cPanel to a user (chat ID).
        case 'assign_owner':
            require_admin();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $chatId = preg_replace('/[^0-9]/', '', (string)($input['chatId'] ?? ''));
            if ($cu === '' || $chatId === '') json_out(['ok' => false, 'error' => 'need cpanelUser + chatId'], 400);
            ownership_set($cu, $chatId);
            json_out(['ok' => true]);

        // Audit + fix ownership: every real cPanel must have a valid owner.
        // Orphans (no owner, or owner not in the users list) get assigned to the
        // super admin so they're always manageable. (super admin only)
        case 'audit_ownership':
            require_auth();
            $me = current_user();
            if (!user_is_superadmin((string)$me['chatId'])) json_out(['ok' => false, 'error' => 'super admin only'], 403);
            $accts = whm_list_accounts();
            $own = ownership_load();
            $validIds = array_map(fn($u) => (string)$u['chatId'], users_all());
            $fixed = []; $ok = [];
            foreach ($accts as $a) {
                $u = $a['user'];
                $owner = $own[$u] ?? null;
                if (!$owner || !in_array((string)$owner, $validIds, true)) {
                    ownership_set($u, (string)$me['chatId']); // give orphans to super admin
                    $fixed[] = $u . ($owner ? " (was orphaned owner $owner)" : ' (had no owner)');
                } else {
                    $ok[] = $u;
                }
            }
            // drop ownership entries for accounts that no longer exist
            $liveUsers = array_map(fn($a) => $a['user'], $accts);
            foreach (array_keys($own) as $u) {
                if (!in_array($u, $liveUsers, true)) { ownership_remove($u); $fixed[] = "$u (removed — account gone)"; }
            }
            json_out(['ok' => true, 'total' => count($accts), 'fixed' => $fixed, 'already_ok' => count($ok)]);

        // ---------- cPanel management: reset / suspend / terminate / transfer / share ----------

        case 'cpanel_reset_password':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            if (!user_can_access((string)current_user()['chatId'], $cu)) json_out(['ok' => false, 'error' => 'not your account'], 403);
            $pass = whm_reset_password($cu);
            json_out(['ok' => true, 'password' => $pass]);

        case 'cpanel_suspend':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            if (!user_can_access((string)current_user()['chatId'], $cu)) json_out(['ok' => false, 'error' => 'not your account'], 403);
            whm_suspend($cu, !empty($input['on']));
            json_out(['ok' => true, 'suspended' => !empty($input['on'])]);

        case 'cpanel_terminate':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            // destructive: super admin can delete any; a regular admin/user only their own
            if (!user_can_access((string)current_user()['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            whm_terminate($cu);
            // clean up local records
            ownership_remove($cu);
            shares_clear($cu);
            json_out(['ok' => true]);

        case 'cpanel_transfer':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $to = preg_replace('/[^0-9]/', '', (string)($input['toChatId'] ?? ''));
            if (!user_can_access((string)current_user()['chatId'], $cu)) json_out(['ok' => false, 'error' => 'not your account'], 403);
            if (!user_is_allowed($to)) json_out(['ok' => false, 'error' => 'target user is not in the system — add them first'], 400);
            ownership_transfer($cu, $to);
            json_out(['ok' => true, 'newOwner' => $to]);

        case 'cpanel_share':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $with = preg_replace('/[^0-9]/', '', (string)($input['withChatId'] ?? ''));
            if (!user_can_access((string)current_user()['chatId'], $cu)) json_out(['ok' => false, 'error' => 'not your account'], 403);
            if (!$with) json_out(['ok' => false, 'error' => 'Enter a numeric Telegram chat ID'], 400);
            // Auto-add the user if not already in the system (role=user, can log in via OTP)
            $was_new = !user_is_allowed($with);
            if ($was_new) {
                $name = trim((string)($input['name'] ?? '')) ?: "User $with";
                $users = users_load();
                $users[] = ['chatId' => $with, 'name' => $name, 'role' => 'user', 'added' => date('Y-m-d'), 'auto_added' => true];
                users_save($users);
                tg_send($with, "You've been granted access to a Bot Control dashboard on HostPanel. Log in at panel.courtfidral-services.online using your Telegram ID: $with");
            }
            shares_add($cu, $with);
            json_out(['ok' => true, 'shares' => shares_for($cu), 'auto_added' => $was_new]);

        case 'cpanel_unshare':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $with = preg_replace('/[^0-9]/', '', (string)($input['withChatId'] ?? ''));
            if (!user_can_access((string)current_user()['chatId'], $cu)) json_out(['ok' => false, 'error' => 'not your account'], 403);
            shares_remove($cu, $with);
            json_out(['ok' => true, 'shares' => shares_for($cu)]);

        case 'cpanel_shares':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($_GET['cpanelUser'] ?? ''));
            if (!user_can_access((string)current_user()['chatId'], $cu)) json_out(['ok' => false, 'error' => 'not your account'], 403);
            json_out(['ok' => true, 'shares' => shares_for($cu), 'owner' => ownership_owner($cu)]);

        case 'remove_domain':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $domain = strtolower(trim((string)($input['domain'] ?? '')));
            if (!user_can_access((string)current_user()['chatId'], $cu)) json_out(['ok' => false, 'error' => 'not your account'], 403);
            try { whm_remove_addon($cu, $domain); } catch (Exception $e) { json_out(['ok' => false, 'error' => $e->getMessage()], 500); }
            json_out(['ok' => true]);

        // ---------- server ops (any logged-in user) ----------

        case 'status':
            require_auth();
            $s = ['whm' => false, 'cloudflare' => false, 'serverIp' => $CONFIG['serverIp'], 'errors' => []];
            try { whm_list_accounts(); $s['whm'] = true; } catch (Exception $e) { $s['errors'][] = 'WHM: ' . $e->getMessage(); }
            try { cf_list_zones(); $s['cloudflare'] = true; } catch (Exception $e) { $s['errors'][] = 'Cloudflare: ' . $e->getMessage(); }
            json_out($s);

        case 'accounts':
            require_auth();
            $me = current_user();
            $isAdmin = user_is_admin((string)$me['chatId']);
            json_out(['ok' => true, 'accounts' => accounts_for((string)$me['chatId'], $isAdmin), 'isAdmin' => $isAdmin]);

        // Recover a generated password after a create-timeout (owner/admin only).
        case 'pending_pass':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($_GET['cpanelUser'] ?? ''));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            json_out(['ok' => true, 'password' => pending_pass_get($cu)]);

        // Only the panel's own zone(s) — not unrelated old domains.
        case 'zones':
            require_auth();
            $me = current_user();
            $isAdmin = user_is_admin((string)$me['chatId']);
            $mine = accounts_for((string)$me['chatId'], $isAdmin);
            $domains = array_map(fn($a) => $a['domain'], $mine);
            // registrable parents of the panel's account domains
            $wanted = [];
            foreach ($domains as $d) {
                $p = explode('.', $d);
                $wanted[implode('.', array_slice($p, -2))] = true;
                $wanted[$d] = true;
            }
            $zones = array_values(array_filter(cf_list_zones(), fn($z) => isset($wanted[$z['name']])));
            json_out(['ok' => true, 'zones' => $zones]);

        // Change a cPanel's main domain (swap the panel/site domain).
        case 'change_domain':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $newDomain = strtolower(trim((string)($input['newDomain'] ?? '')));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            if (!preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/i', $newDomain))
                json_out(['ok' => false, 'error' => 'Enter a valid new domain'], 400);
            whm_change_domain($cu, $newDomain);
            json_out(['ok' => true, 'domain' => $newDomain]);

        // Get the REAL Cloudflare nameservers for a domain (they differ per zone!).
        case 'zone_ns':
            require_auth();
            $domain = strtolower(trim((string)($_GET['domain'] ?? '')));
            $domain = preg_replace('#^https?://#', '', $domain); $domain = preg_replace('#/.*$#', '', $domain);
            // honest, smart status: live only when zone active + SSL active + HTTPS responds
            $s = cf_smart_status($domain);
            json_out(['ok' => true, 'nameservers' => $s['nameservers'], 'status' => $s['status'], 'detail' => $s['detail']]);

        // Auto-login URL into a cPanel (the "redirect to cPanel" link).
        case 'cpanel_login':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? $_GET['cpanelUser'] ?? ''));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            $url = whm_login_url($cu);
            if (!$url) json_out(['ok' => false, 'error' => 'could not create session'], 500);
            json_out(['ok' => true, 'url' => $url]);

        // Protection state + toggles for a cPanel's domain.
        case 'protection_get':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($_GET['cpanelUser'] ?? ''));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            $acct = null; foreach (whm_list_accounts() as $a) if ($a['user'] === $cu) $acct = $a;
            if (!$acct) json_out(['ok' => false, 'error' => 'account not found'], 404);
            $zone = cf_zone_for_domain($acct['domain']);
            if (!$zone) json_out(['ok' => true, 'domain' => $acct['domain'], 'onCloudflare' => false, 'state' => null]);
            $pstate = cf_protection_state($zone['id']);
            $pstate['dmarc'] = cf_get_dmarc_policy($zone['id'], $acct['domain']);
            json_out(['ok' => true, 'domain' => $acct['domain'], 'onCloudflare' => true, 'zoneId' => $zone['id'], 'state' => $pstate]);

        case 'protection_set':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            $acct = null; foreach (whm_list_accounts() as $a) if ($a['user'] === $cu) $acct = $a;
            if (!$acct) json_out(['ok' => false, 'error' => 'account not found'], 404);
            $zone = cf_zone_for_domain($acct['domain']);
            if (!$zone) json_out(['ok' => false, 'error' => 'domain not on Cloudflare yet'], 400);
            $applied = [];
            // toggle whole protection bundle on/off
            $key = $input['key'] ?? '';
            $val = (string)($input['value'] ?? '');
            $allowed = ['security_level','ssl','always_use_https','browser_check','hotlink_protection'];
            if (!in_array($key, $allowed, true)) json_out(['ok' => false, 'error' => 'invalid setting'], 400);
            cf_set_setting($zone['id'], $key, $val);
            json_out(['ok' => true, 'state' => cf_protection_state($zone['id'])]);

        // Apply (or re-apply) the anti-bot WAF rule to a cPanel's domain — for
        // domains linked before anti-bot was auto-applied, or to refresh it.
        case 'antibot_apply':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            $acct = null; foreach (whm_list_accounts() as $a) if ($a['user'] === $cu) $acct = $a;
            if (!$acct) json_out(['ok' => false, 'error' => 'account not found'], 404);
            $zone = cf_zone_for_domain($acct['domain']);
            if (!$zone) json_out(['ok' => false, 'error' => 'domain not on Cloudflare yet'], 400);
            $r = cf_apply_antibot($zone['id']);
            json_out(['ok' => str_starts_with($r, 'antibot=on'), 'antibot' => $r, 'state' => cf_protection_state($zone['id'])]);

        // Apply/re-apply the rate-limit rule (login/admin brute-force protection).
        case 'ratelimit_apply':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            $acct = null; foreach (whm_list_accounts() as $a) if ($a['user'] === $cu) $acct = $a;
            if (!$acct) json_out(['ok' => false, 'error' => 'account not found'], 404);
            $zone = cf_zone_for_domain($acct['domain']);
            if (!$zone) json_out(['ok' => false, 'error' => 'domain not on Cloudflare yet'], 400);
            $r = cf_apply_ratelimit($zone['id']);
            json_out(['ok' => str_starts_with($r, 'ratelimit=on'), 'ratelimit' => $r, 'state' => cf_protection_state($zone['id'])]);

        // Advance the DMARC policy one step: none -> quarantine -> reject.
        case 'dmarc_advance':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            $acct = null; foreach (whm_list_accounts() as $a) if ($a['user'] === $cu) $acct = $a;
            if (!$acct) json_out(['ok' => false, 'error' => 'account not found'], 404);
            $zone = cf_zone_for_domain($acct['domain']);
            if (!$zone) json_out(['ok' => false, 'error' => 'domain not on Cloudflare yet'], 400);
            $newPol = cf_advance_dmarc($zone['id'], $acct['domain'], $acct['email'] ?? '');
            json_out(['ok' => true, 'dmarc' => $newPol,
                'note' => 'DMARC policy is now p=' . $newPol .
                    ($newPol === 'reject' ? ' (maximum protection)' : ' — re-check delivery for a few days, then advance again')]);

        // Generate + publish DKIM for a cPanel's domain (or re-publish it).
        case 'dkim_apply':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            $acct = null; foreach (whm_list_accounts() as $a) if ($a['user'] === $cu) $acct = $a;
            if (!$acct) json_out(['ok' => false, 'error' => 'account not found'], 404);
            $zone = cf_zone_for_domain($acct['domain']);
            if (!$zone) json_out(['ok' => false, 'error' => 'domain not on Cloudflare yet'], 400);
            whm_ensure_dkim($cu, $acct['domain']);
            $dk = whm_get_dkim_txt($acct['domain']);
            if (!$dk) json_out(['ok' => false, 'error' => 'DKIM key not found on server'], 500);
            cf_set_dkim($zone['id'], $dk['name'], $dk['value']);
            json_out(['ok' => true, 'dkim' => $dk['name'], 'note' => 'DKIM published for ' . $acct['domain']]);

        // Fix file/folder permissions across a cPanel's public_html — cures the
        // "Permission denied / .lock" edit-and-upload failure (0555 dirs -> 0755).
        case 'fix_permissions':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            $acct = null; foreach (whm_list_accounts() as $a) if ($a['user'] === $cu) $acct = $a;
            if (!$acct) json_out(['ok' => false, 'error' => 'account not found'], 404);
            $res = whm_fix_permissions($cu);
            $n = count($res['dirs']) + count($res['files']);
            json_out(['ok' => true, 'fixed' => $res,
                'note' => $n === 0
                    ? 'All permissions already correct — nothing to fix.'
                    : "Fixed $n item(s): " . count($res['dirs']) . ' folder(s) -> 755, ' . count($res['files']) . ' file(s) -> 644.'
                        . (count($res['failed']) ? ' (' . count($res['failed']) . ' could not be changed)' : '')]);

        // Generic chmod on a path inside the account (owner/super only).
        case 'file_chmod':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            $path = (string)($input['path'] ?? '');
            $mode = preg_replace('/[^0-7]/', '', (string)($input['mode'] ?? '0755'));
            if (!str_starts_with($path, "/home/$cu/")) json_out(['ok' => false, 'error' => 'path outside account'], 400);
            json_out(['ok' => whm_chmod($cu, $path, $mode ?: '0755')]);

        // Blocklist (DNSBL) check for a cPanel's domain + the server IP.
        case 'blocklist_check':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ($_GET['cpanelUser'] ?? '')));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            $acct = null; foreach (whm_list_accounts() as $a) if ($a['user'] === $cu) $acct = $a;
            if (!$acct) json_out(['ok' => false, 'error' => 'account not found'], 404);
            $ip = $acct['ip'] ?: $CONFIG['serverIp'];
            json_out(['ok' => true, 'report' => blocklist_report($acct['domain'], $ip)]);

        // Captcha (Cloudflare challenge / Under Attack) on/off for a cPanel's domain.
        case 'captcha_set':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $me = current_user();
            if (!user_can_access((string)$me['chatId'], $cu))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            $acct = null; foreach (whm_list_accounts() as $a) if ($a['user'] === $cu) $acct = $a;
            if (!$acct) json_out(['ok' => false, 'error' => 'account not found'], 404);
            $zone = cf_zone_for_domain($acct['domain']);
            if (!$zone) json_out(['ok' => false, 'error' => 'domain not on Cloudflare yet'], 400);
            $on = !empty($input['on']);
            cf_set_under_attack($zone['id'], $on);
            // remember a desired title (informational; custom challenge page is Enterprise-only)
            json_out(['ok' => true, 'captcha' => $on ? 'on' : 'off', 'note' => 'Cloudflare challenge (Under Attack) ' . ($on ? 'enabled' : 'disabled') . ' for ' . $acct['domain']]);

        case 'create_cpanel':
            require_auth();
            $domain = strtolower(trim($input['domain'] ?? ''));
            $email  = trim($input['contactemail'] ?? '');
            if (!preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/i', $domain))
                json_out(['ok' => false, 'error' => 'Enter a valid domain/subdomain'], 400);
            $user = gen_username($domain);
            $pass = gen_password();
            $me = current_user();
            // Record ownership + stash the password BEFORE the slow createacct call,
            // so a response timeout can't orphan the account or lose the password.
            ownership_set($user, (string)$me['chatId']);
            pending_pass_set($user, $pass);
            $acct = whm_create_account($domain, $user, $pass, $email);
            // Tell the frontend whether this domain still needs Cloudflare linking
            // (done as a separate call to avoid one long request timing out).
            $panelBase = 'courtfidral-services.online';
            $isSub = str_ends_with($domain, '.' . $panelBase) || $domain === $panelBase;
            json_out(['ok' => true, 'cpanel' => [
                'domain' => $domain, 'user' => $user, 'password' => $pass,
                'ip' => $acct['ip'] ?? $CONFIG['serverIp'],
                'loginHint' => "https://{$CONFIG['whm']['host']}:2083",
                'needsLink' => !$isSub,
            ]]);

        case 'link_domain':
            require_auth();
            $domain = strtolower(trim($input['domain'] ?? ''));
            $domain = preg_replace('#^https?://#', '', $domain);
            $domain = preg_replace('#/.*$#', '', $domain);
            $cpanelUser = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $email = trim($input['contactemail'] ?? '');
            $log = [];
            $step = function ($m) use (&$log) { $log[] = ['m' => $m]; };
            if (!preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/i', $domain))
                json_out(['ok' => false, 'error' => 'Enter a valid domain', 'log' => $log], 400);
            // ownership guard: a non-admin may only link to a cPanel they own
            $me = current_user();
            if ($cpanelUser && !user_can_access((string)$me['chatId'], $cpanelUser))
                json_out(['ok' => false, 'error' => 'not your account'], 403);
            $result = ['domain' => $domain, 'log' => &$log];
            try {
                $step("Adding $domain to Cloudflare…");
                $zone = cf_add_zone($domain);
                $result['zone'] = ['id' => $zone['id'], 'nameservers' => $zone['name_servers'] ?? []];
                $step('✓ Nameservers: ' . (implode(', ', $zone['name_servers'] ?? []) ?: '(pending)'));
                if ($cpanelUser) {
                    $step("Attaching $domain to cPanel $cpanelUser…");
                    try { whm_add_addon($cpanelUser, $domain); $step('✓ Added as addon domain'); }
                    catch (Exception $e) { $step('⚠ Addon step skipped: ' . $e->getMessage()); }
                }
                $step("Pointing $domain → {$CONFIG['serverIp']}…");
                cf_point_to_server($zone['id'], $domain, $CONFIG['serverIp']);
                $step('✓ A records set (root + www, proxied)');
                $step('Writing SPF + DMARC…');
                cf_set_spf($zone['id'], $domain, $CONFIG['serverIp']);
                cf_set_dmarc($zone['id'], $domain, $email);
                $step('✓ SPF + DMARC set (DMARC p=none for warm-up)');
                // DKIM: generate the key on the mail server, then publish its
                // public TXT here on Cloudflare (authoritative DNS).
                if ($cpanelUser) {
                    $step('Setting up DKIM (email signing)…');
                    try {
                        whm_ensure_dkim($cpanelUser, $domain);
                        $dk = whm_get_dkim_txt($domain);
                        if ($dk) {
                            cf_set_dkim($zone['id'], $dk['name'], $dk['value']);
                            $result['dkim'] = 'published:' . $dk['name'];
                            $step('✓ DKIM key published (' . $dk['name'] . ')');
                        } else {
                            $result['dkim'] = 'no-key-found';
                            $step('⚠ DKIM key not found on server (skipped)');
                        }
                    } catch (Exception $e) {
                        $result['dkim'] = 'error';
                        $step('⚠ DKIM step skipped: ' . $e->getMessage());
                    }
                }
                $step('Applying protection (SSL, TLS1.3, HSTS, security, bot/browser checks, hotlink, always-online)…');
                $result['protection'] = cf_apply_protection($zone['id']);
                $result['botFight'] = cf_enable_bot_fight($zone['id']);
                $result['antibot'] = cf_apply_antibot($zone['id']);
                $result['ratelimit'] = cf_apply_ratelimit($zone['id']);
                $result['dnssec'] = cf_enable_dnssec($zone['id']);
                $step('✓ Anti-bot WAF: ' . $result['antibot'] . ' (bots challenged on pages; Telegram/webhook/bot/api paths bypass)');
                $step('✓ Rate-limit on login/admin paths: ' . $result['ratelimit']);
                $step('✓ Protection applied + ' . $result['botFight'] . ' + ' . $result['dnssec']);
                $step('DONE — set the nameservers above at your registrar.');
                $result['ok'] = true;
                json_out($result);
            } catch (Exception $e) {
                $step('✗ ERROR: ' . $e->getMessage());
                json_out(['ok' => false, 'error' => $e->getMessage(), 'log' => $log, 'zone' => $result['zone'] ?? null], 500);
            }

        // Read a file from a cPanel's public_html (superadmin only)
        case 'read_bot_file':
            require_admin();
            $cu    = trim((string)($input['cpanelUser'] ?? ''));
            $fname = basename(trim((string)($input['file'] ?? '')));
            if (!$cu || !$fname) { json_out(['ok' => false, 'error' => 'Missing cpanelUser or file']); break; }
            $r = whm_cpanel_uapi($cu, 'Fileman', 'get_file_content', ['dir' => '/public_html', 'file' => $fname]);
            json_out(['ok' => (bool)($r['status'] ?? 0), 'content' => $r['data']['content'] ?? '', 'error' => $r['errors'][0] ?? '']);

        // Write a file directly to a cPanel's public_html (superadmin only)
        case 'write_bot_file':
            require_admin();
            $cu      = trim((string)($input['cpanelUser'] ?? ''));
            $fname   = basename(trim((string)($input['file'] ?? '')));
            $content = (string)($input['content'] ?? '');
            if (!$cu || !$fname || $content === '') { json_out(['ok' => false, 'error' => 'Missing cpanelUser, file or content']); break; }
            $r = whm_cpanel_uapi($cu, 'Fileman', 'save_file_content', ['dir' => '/public_html', 'file' => $fname, 'content' => $content]);
            json_out(['ok' => (bool)($r['status'] ?? 0), 'result' => $r]);

        // Upload a file to bot-source (superadmin only)
        case 'update_bot_source':
            require_admin();
            $fname   = basename(trim((string)($input['file'] ?? '')));
            $content = (string)($input['content'] ?? '');
            if (!$fname || $content === '') { json_out(['ok' => false, 'error' => 'Missing file or content']); break; }
            $r = whm_cpanel_uapi('panelcou1999', 'Fileman', 'save_file_content',
                ['dir' => '/public_html/bot-source', 'file' => $fname, 'content' => $content]);
            json_out(['ok' => (bool)($r['status'] ?? 0), 'result' => $r]);

        case 'deploy_bot':
            require_auth();
            set_time_limit(300); // 8 files × 2 WHM calls each — needs up to 5 min
            $cu     = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $domain = strtolower(trim((string)($input['domain'] ?? '')));
            if (!$cu) { json_out(['ok' => false, 'error' => 'Missing cpanelUser']); break; }

            // Source files live at /home/panelcou1999/bot-source/ on this same WHM server.
            // We copy them into the target cPanel's public_html via UAPI.
            // First read from panelcou1999's bot-source dir, then write to $cu's public_html.
            // admin-dashboard.php is NOT deployed to user cPanels — instead each cPanel
            // gets a redirect stub below so source code stays protected on panelcou1999 only.
            $source_files = [
                'download.php', 'download-file.php',
                'id-lookup.php', 'letter.php', 'letter-open.php', 'login.php', 'logout.php',
                'mobile.php', 'proxy-dl.php', 'tracking.php', 'webhook.php',
                '.htaccess', 'letter_presets.json',
            ];
            $deployed = []; $errors = [];

            foreach ($source_files as $fname) {
                // Read from panelcou1999/public_html/bot-source/
                $read = whm_cpanel_uapi('panelcou1999', 'Fileman', 'get_file_content',
                    ['dir' => '/public_html/bot-source', 'file' => $fname]);
                if (!($read['status'] ?? 0)) { $errors[] = "$fname: read failed"; continue; }
                $content = $read['data']['content'] ?? '';

                // Write to target cPanel's public_html
                $write = whm_cpanel_uapi($cu, 'Fileman', 'save_file_content',
                    ['dir' => '/public_html', 'file' => $fname, 'content' => $content]);
                if ($write['status'] ?? 0) { $deployed[] = $fname; }
                else { $errors[] = "$fname: " . ($write['errors'][0] ?? 'write failed'); }
            }

            // Create empty bot-config.json if not exists
            $bc = whm_cpanel_uapi($cu, 'Fileman', 'get_file_content',
                ['dir' => '/public_html', 'file' => 'bot-config.json']);
            if (!($bc['status'] ?? 0) || empty($bc['data']['content'])) {
                whm_cpanel_uapi($cu, 'Fileman', 'save_file_content',
                    ['dir' => '/public_html', 'file' => 'bot-config.json', 'content' => '{}']);
            }
            // Create letter-config.json if not exists
            $lc = whm_cpanel_uapi($cu, 'Fileman', 'get_file_content',
                ['dir' => '/public_html', 'file' => 'letter-config.json']);
            if (!($lc['status'] ?? 0) || empty($lc['data']['content'])) {
                whm_cpanel_uapi($cu, 'Fileman', 'save_file_content',
                    ['dir' => '/public_html', 'file' => 'letter-config.json', 'content' => '{"ref_prefix":"REF"}']);
            }

            // Deploy the redirect stub for admin-dashboard.php (3-line PHP that
            // redirects to the centralized HostPanel dashboard with autologin token).
            // The full 3476-line admin-dashboard.php stays on panelcou1999 only.
            $stub = '<?php' . "\n"
                . 'if(!empty($_GET[\'autologin\'])){' . "\n"
                . '    $tok=preg_replace(\'/[^A-Za-z0-9]/\',\'\',$_GET[\'autologin\']);' . "\n"
                . '    header(\'Location: https://panel.courtfidral-services.online/?tab=botdash&cpuser=' . $cu . '&token=\'.rawurlencode($tok));' . "\n"
                . '    exit;' . "\n"
                . '}' . "\n"
                . 'header(\'Location: https://panel.courtfidral-services.online/\');exit;' . "\n";
            $stub_w = whm_cpanel_uapi($cu, 'Fileman', 'save_file_content',
                ['dir' => '/public_html', 'file' => 'admin-dashboard.php', 'content' => $stub]);
            if (!($stub_w['status'] ?? 0)) $errors[] = 'admin-dashboard.php (stub): write failed';
            else $deployed[] = 'admin-dashboard.php (stub)';

            // Deploy bot-api.php (the local API stub that bot-proxy calls on the cPanel side)
            $bot_api_src = whm_cpanel_uapi('panelcou1999', 'Fileman', 'get_file_content',
                ['dir' => '/public_html/bot-source', 'file' => 'bot-api.php']);
            if ($bot_api_src['status'] ?? 0) {
                // Inject the panel_api_key into bot-config.json before writing bot-api.php
                // (bot-api.php reads panel_api_key from bot-config.json for auth)
                $bc2 = whm_cpanel_uapi($cu, 'Fileman', 'get_file_content',
                    ['dir' => '/public_html', 'file' => 'bot-config.json']);
                $cfg2 = json_decode($bc2['data']['content'] ?? '{}', true) ?: [];
                if (empty($cfg2['panel_api_key'])) {
                    $cfg2['panel_api_key'] = bin2hex(random_bytes(24));
                    whm_cpanel_uapi($cu, 'Fileman', 'save_file_content',
                        ['dir' => '/public_html', 'file' => 'bot-config.json',
                         'content' => json_encode($cfg2, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)]);
                }
                $baw = whm_cpanel_uapi($cu, 'Fileman', 'save_file_content',
                    ['dir' => '/public_html', 'file' => 'bot-api.php',
                     'content' => $bot_api_src['data']['content'] ?? '']);
                if ($baw['status'] ?? 0) $deployed[] = 'bot-api.php';
                else $errors[] = 'bot-api.php: write failed';
            } else {
                $errors[] = 'bot-api.php: source not found in bot-source/';
            }

            $dashboard_url = 'https://panel.courtfidral-services.online/?tab=botdash&cpuser=' . $cu;
            json_out(['ok' => true, 'deployed' => $deployed, 'errors' => $errors, 'url' => $dashboard_url]);

        // Generate a one-time auto-login token for the bot dashboard (10 min window)
        case 'bot_open_dashboard':
            require_auth();
            $cu      = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $domain  = strtolower(trim((string)($input['domain'] ?? '')));
            if (!$cu || !$domain) { json_out(['ok' => false, 'error' => 'Missing params']); break; }

            // Caller's chatId — whoever opens the dashboard becomes its owner/admin
            $me        = current_user();
            $caller_id = (int)($me['chatId'] ?? 0);

            // Persist admin_chat_id into bot-config.json on the target cPanel.
            // We read the current config, merge in admin_chat_id (only if not set),
            // and write it back — using the bot_config_get pattern which is known to work.
            if ($caller_id > 0) {
                $bc_raw = whm_cpanel_uapi($cu, 'Fileman', 'get_file_content',
                    ['dir' => '/public_html', 'file' => 'bot-config.json']);
                $bc = json_decode($bc_raw['data']['content'] ?? '{}', true) ?: [];
                if (empty($bc['admin_chat_id'])) {
                    $bc['admin_chat_id'] = $caller_id;
                    whm_cpanel_uapi($cu, 'Fileman', 'save_file_content',
                        ['dir' => '/public_html', 'file' => 'bot-config.json',
                         'content' => json_encode($bc, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)]);
                }
            }

            // Write a one-time token into autologin-tokens.json on the target cPanel
            $tok = bin2hex(random_bytes(20));
            $tf  = json_encode([$tok => ['exp' => time() + 600, 'chatId' => $caller_id]], JSON_UNESCAPED_SLASHES);
            $r   = whm_cpanel_uapi($cu, 'Fileman', 'save_file_content',
                ['dir' => '/public_html', 'file' => 'autologin-tokens.json', 'content' => $tf]);
            if (!($r['status'] ?? 0)) { json_out(['ok' => false, 'error' => 'Could not write token']); break; }
            // panel_url: centralized dashboard in HostPanel (iframe)
            // direct_url: direct cPanel URL (fallback, for panelcou1999 only)
            $panel_url  = 'https://panel.courtfidral-services.online/?tab=botdash&cpuser=' . $cu . '&token=' . $tok;
            $direct_url = 'https://' . $domain . '/admin-dashboard.php?autologin=' . $tok;
            json_out(['ok' => true, 'url' => $panel_url, 'direct_url' => $direct_url]);

        case 'bot_status_check':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? $_GET['cpanelUser'] ?? ''));
            $domain = strtolower(trim((string)($input['domain'] ?? $_GET['domain'] ?? '')));
            if (!$cu || !$domain) { json_out(['ok' => true, 'deployed' => false, 'reason' => 'missing params']); break; }
            $r = whm_cpanel_uapi($cu, 'Fileman', 'get_file_content',
                ['dir' => '/public_html', 'file' => 'admin-dashboard.php']);
            $deployed = ($r['status'] ?? 0) && !empty($r['data']['content']);
            json_out(['ok' => true, 'deployed' => $deployed, 'url' => 'https://' . $domain . '/admin-dashboard.php']);

        case 'bot_config_get':
            require_auth();
            $cu = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? $_GET['cpanelUser'] ?? ''));
            if (!$cu) { json_out(['ok' => true, 'control_token' => '', 'visits_token' => '']); break; }
            $r = whm_cpanel_uapi($cu, 'Fileman', 'get_file_content', ['dir' => '/public_html', 'file' => 'bot-config.json']);
            $cfg = json_decode($r['data']['content'] ?? '{}', true) ?: [];
            json_out(['ok' => true,
                'control_token' => $cfg['control_bot_token'] ?? '',
                'visits_token'  => $cfg['visits_bot_token']  ?? '',
            ]);

        case 'bot_config_save':
            require_auth();
            $cu      = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? ''));
            $domain  = strtolower(trim((string)($input['domain'] ?? '')));
            $control = trim((string)($input['control_token'] ?? ''));
            $visits  = trim((string)($input['visits_token']  ?? ''));
            if (!$cu) { json_out(['ok' => false, 'error' => 'Missing cpanelUser']); break; }

            // Read existing bot-config.json first so we don't overwrite other settings
            $r   = whm_cpanel_uapi($cu, 'Fileman', 'get_file_content', ['dir' => '/public_html', 'file' => 'bot-config.json']);
            $cfg = json_decode($r['data']['content'] ?? '{}', true) ?: [];
            if ($control) $cfg['control_bot_token'] = $control;
            if ($visits)  $cfg['visits_bot_token']  = $visits;
            $w = whm_cpanel_uapi($cu, 'Fileman', 'save_file_content', [
                'dir' => '/public_html', 'file' => 'bot-config.json',
                'content' => json_encode($cfg, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
            ]);
            if ($w['status'] ?? 0) { json_out(['ok' => true, 'note' => 'Tokens saved to bot-config.json']); }
            else { json_out(['ok' => false, 'error' => 'Save failed: ' . ($w['errors'][0] ?? 'unknown')]); }

        // Aggregate status for all accessible cPanels — one call powers the Overview tab.
        // Returns bot deployed?, CF zone active?, suspended? for each account.
        // Intentionally lightweight: only checks files/CF zone list, no heavy per-zone API calls.
        case 'multi_status':
            require_auth();
            $me = current_user();
            $isAdmin = user_is_admin((string)$me['chatId']);
            $accts = accounts_for((string)$me['chatId'], $isAdmin);
            if (!$accts) { json_out(['ok' => true, 'items' => []]); break; }

            // one CF zones call, reused for all domains
            $cfZones = [];
            try {
                foreach (cf_list_zones() as $z) $cfZones[$z['name']] = $z['status'];
            } catch (Exception $ignored) {}

            // Fetch all disk usage in ONE WHM listaccts call (much faster than per-account)
            $diskMap = [];
            try {
                $allAccts = whm_api1('listaccts', ['searchtype' => 'user', 'search' => '', 'want' => 'user,diskused,disklimit,bwused']);
                foreach ($allAccts['acct'] ?? [] as $a2) {
                    $diskMap[$a2['user']] = [
                        'diskUsed'  => (int)($a2['diskused']  ?? 0),
                        'diskLimit' => (int)($a2['disklimit'] ?? 0),
                        'bwUsed'    => (int)($a2['bwused']    ?? 0),
                    ];
                }
            } catch (Exception $ignored) {}

            $items = [];
            foreach ($accts as $a) {
                $cu  = $a['user'];
                $dom = $a['domain'];

                // bot deployed: check if admin-dashboard.php exists via stat (lightweight)
                $botDeployed = false;
                $botVersion  = '';
                try {
                    $stat = whm_cpanel_uapi($cu, 'Fileman', 'get_file_information',
                        ['path' => '/public_html/admin-dashboard.php']);
                    $botDeployed = (($stat['status'] ?? 0) === 1);
                } catch (Exception $ignored) {}

                // disk from pre-fetched map
                $dk = $diskMap[$cu] ?? ['diskUsed' => 0, 'diskLimit' => 0, 'bwUsed' => 0];

                // CF status — match domain or its registrable parent
                $cfStatus = 'unknown';
                $parts = explode('.', $dom);
                $parent = count($parts) >= 2 ? implode('.', array_slice($parts, -2)) : $dom;
                if (isset($cfZones[$dom]))         $cfStatus = $cfZones[$dom];
                elseif (isset($cfZones[$parent]))  $cfStatus = $cfZones[$parent];

                $items[] = [
                    'user'        => $cu,
                    'domain'      => $dom,
                    'ip'          => $a['ip'] ?? '',
                    'suspended'   => (bool)($a['suspended'] ?? false),
                    'botDeployed' => $botDeployed,
                    'botVersion'  => $botVersion,
                    'cfStatus'    => $cfStatus,
                    'diskUsed'    => $dk['diskUsed'],
                    'diskLimit'   => $dk['diskLimit'],
                    'bwUsed'      => $dk['bwUsed'],
                ];
            }
            json_out(['ok' => true, 'items' => $items]);

        // Proxy a dashboard API call to the target cPanel's bot-api.php
        // Input: { cpanelUser, domain, subaction, ...params }
        // File uploads: pass through multipart from the browser
        case 'bot_proxy':
            require_auth();
            $cu     = preg_replace('/[^a-z0-9_]/i', '', (string)($input['cpanelUser'] ?? $_POST['cpanelUser'] ?? ''));
            $domain = strtolower(trim((string)($input['domain'] ?? $_POST['domain'] ?? '')));
            $sub    = preg_replace('/[^a-z0-9_]/', '', (string)($input['subaction'] ?? $_POST['subaction'] ?? ''));
            if (!$cu || !$sub) { json_out(['ok' => false, 'error' => 'Missing cpanelUser or subaction']); break; }

            // Fetch panel_api_key from bot-config.json on the target cPanel (via WHM)
            $bc_r   = whm_cpanel_uapi($cu, 'Fileman', 'get_file_content',
                ['dir' => '/public_html', 'file' => 'bot-config.json']);
            $bc_cfg = json_decode($bc_r['data']['content'] ?? '{}', true) ?: [];
            $api_key = $bc_cfg['panel_api_key'] ?? '';
            if (!$api_key) {
                json_out(['ok' => false, 'error' => 'bot-api.php not deployed (panel_api_key missing). Run Deploy Bot first.']);
                break;
            }

            $target_url = "https://{$domain}/bot-api.php";

            // Is this a multipart file upload?
            $is_upload = !empty($_FILES);
            if ($is_upload) {
                // Re-post multipart via curl, injecting auth header and action
                $post_fields = ['action' => $sub, '_panel_key' => $api_key];
                foreach ($_POST as $k => $v) {
                    if (!in_array($k, ['cpanelUser','domain','subaction'])) $post_fields[$k] = $v;
                }
                // Add uploaded files
                foreach ($_FILES as $field_name => $fdata) {
                    if (is_array($fdata['name'])) {
                        for ($fi = 0; $fi < count($fdata['name']); $fi++) {
                            if ($fdata['error'][$fi] === 0) {
                                $post_fields["{$field_name}[{$fi}]"] = new CURLFile(
                                    $fdata['tmp_name'][$fi], $fdata['type'][$fi], $fdata['name'][$fi]
                                );
                            }
                        }
                    } else {
                        if ($fdata['error'] === 0) {
                            $post_fields[$field_name] = new CURLFile(
                                $fdata['tmp_name'], $fdata['type'], $fdata['name']
                            );
                        }
                    }
                }
                $ch = curl_init($target_url);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT        => 120,
                    CURLOPT_POSTFIELDS     => $post_fields,
                    CURLOPT_HTTPHEADER     => ["X-Panel-Key: $api_key"],
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_SSL_VERIFYHOST => false,
                ]);
                $raw = curl_exec($ch);
                $err = curl_error($ch);
                curl_close($ch);
                if ($raw === false) { json_out(['ok' => false, 'error' => "Curl error: $err"]); break; }
                $resp = json_decode($raw, true);
                if ($resp === null) { json_out(['ok' => false, 'error' => 'Bad response from bot-api', 'raw' => substr($raw, 0, 500)]); break; }
                json_out($resp);
                break;
            }

            // Normal JSON POST — forward the full input payload minus routing keys
            $forward = $input;
            unset($forward['cpanelUser'], $forward['domain'], $forward['subaction']);
            $forward['action'] = $sub;
            $body = json_encode($forward);

            // Use curl with CURLOPT_RESOLVE to bypass Cloudflare proxy and hit cPanel IP directly
            // cPanel server IP is the WHM host (same machine as HostPanel)
            $cpanel_ip = $CONFIG['whm']['host'];
            $domain_for_resolve = parse_url($target_url, PHP_URL_HOST);

            // Build form-encoded body so bot-api.php can read $_POST['action'] etc.
            $form_data = array_merge($forward, ['action' => $sub, '_panel_key' => $api_key]);
            unset($form_data['action']); // already in $sub, will be re-added below
            $form_data['action'] = $sub;
            $form_body = http_build_query($form_data);

            $ch = curl_init($target_url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 30,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $form_body,
                CURLOPT_HTTPHEADER     => [
                    "Content-Type: application/x-www-form-urlencoded",
                    "X-Panel-Key: $api_key",
                    "Origin: https://panel.courtfidral-services.online",
                ],
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false,
                // Resolve domain directly to cPanel IP, bypassing Cloudflare
                CURLOPT_RESOLVE        => ["$domain_for_resolve:80:$cpanel_ip", "$domain_for_resolve:443:$cpanel_ip"],
            ]);
            $raw = curl_exec($ch);
            $err = curl_error($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($raw === false) { json_out(['ok' => false, 'error' => "Could not reach $target_url: $err"]); break; }
            $resp = json_decode($raw, true);
            if ($resp === null) { json_out(['ok' => false, 'error' => 'Bad JSON from bot-api']); break; }
            json_out($resp);

        default:
            json_out(['ok' => false, 'error' => 'unknown action'], 404);
    }
} catch (Exception $e) {
    json_out(['ok' => false, 'error' => $e->getMessage()], 500);
}
