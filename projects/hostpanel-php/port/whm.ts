// whm.ts — WHM (WebHost Manager JSON-API) client + cPanel provisioning logic.
//
// Faithful 1:1 port of the WHM half of hostpanel-php/lib.php.
// Modern TS / ESM, Node 20+ built-in fetch, runs under tsx.
//
// TLS note: the WHM cert is issued for the hostname but we dial the raw IP, so
// verification must be disabled. Node's global fetch can't set per-request TLS
// options, so for WHM (insecure) calls we use the built-in `node:https` module
// with an Agent that has rejectUnauthorized:false. No external dependency.
import { request as httpsRequest, Agent as HttpsAgent } from 'node:https';
import { randomInt as nodeRandomInt } from 'node:crypto';

// ---------- config ----------

export interface WhmConfig {
  host: string;
  user: string;
  token: string;
  port: number;
}

let _whmConfig: WhmConfig | null = null;

/** Read WHM config from process.env once (host/user/token from env, port hardcoded 2087). */
export function getWhmConfig(): WhmConfig {
  if (_whmConfig) return _whmConfig;
  _whmConfig = {
    host: process.env.WHM_HOST || '54.38.221.66',
    user: process.env.WHM_USER || 'streamfl',
    token: process.env.WHM_API_TOKEN || '',
    port: 2087,
  };
  return _whmConfig;
}

// Shared insecure agent for every WHM request (cert-for-hostname vs IP).
const whmInsecureAgent = new HttpsAgent({ rejectUnauthorized: false, keepAlive: true });

/**
 * Perform an HTTPS request via node:https with TLS verification disabled,
 * returning { status, body }. Used for WHM calls (cert is for the hostname,
 * we dial the IP). Mirrors a fetch() call but allows rejectUnauthorized:false.
 */
function insecureHttps(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs: number }
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = httpsRequest(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: init.method ?? 'GET',
        headers: init.headers ?? {},
        agent: whmInsecureAgent,
        timeout: init.timeoutMs,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      }
    );
    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

// ---------- types ----------

export interface Account {
  domain: string;
  user: string;
  ip: string;
  plan: string;
  email: string;
  suspended: boolean;
}

export interface DirEntry {
  file: string;
  type: string;
  mode: number; // octal int, & 07777
  writable: boolean; // owner write bit (0200)
  size: number;
}

export interface FixPermsResult {
  dirs: string[];
  files: string[];
  failed: string[];
}

export interface DkimTxt {
  name: string;
  value: string;
}

// ---------- HTTP helper (mirrors PHP http_json) ----------

interface HttpOpts {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number; // seconds (as in PHP)
  insecure?: boolean;
}

/**
 * Perform an HTTP request and decode JSON, mirroring the PHP http_json().
 * Throws on transport failure or non-JSON response, with the same messages.
 */
async function httpJson(url: string, opts: HttpOpts = {}): Promise<any> {
  const timeoutMs = (opts.timeout ?? 120) * 1000;
  let raw: string;
  let code = 0;
  try {
    if (opts.insecure) {
      // WHM: TLS verification disabled via node:https.
      const r = await insecureHttps(url, {
        method: opts.method ?? 'GET',
        headers: opts.headers ?? {},
        body: opts.body,
        timeoutMs,
      });
      code = r.status;
      raw = r.body;
    } else {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const init: RequestInit = {
          method: opts.method ?? 'GET',
          headers: opts.headers ?? {},
          signal: controller.signal,
        };
        if (opts.body !== undefined) init.body = opts.body;
        const res = await fetch(url, init);
        code = res.status;
        raw = await res.text();
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (e: any) {
    throw new Error(`request failed: ${e?.message ?? String(e)}`);
  }
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`non-JSON response (HTTP ${code}): ${raw.substring(0, 160)}`);
  }
  if (data === null) {
    throw new Error(`non-JSON response (HTTP ${code}): ${raw.substring(0, 160)}`);
  }
  return data;
}

/** URL-encode an object into an application/x-www-form-urlencoded query string (PHP http_build_query). */
function buildQuery(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) sp.append(k, String(v));
  return sp.toString();
}

// ---------- WHM ----------

/** whm_call — dial the WHM JSON-API. Throws if metadata.result !== 1. */
export async function whmCall(fn: string, params: Record<string, any> = {}): Promise<any> {
  const w = getWhmConfig();
  const p = { ...params, 'api.version': '1' };
  const url = `https://${w.host}:${w.port}/json-api/${fn}?${buildQuery(p)}`;
  const data = await httpJson(url, {
    headers: { Authorization: `whm ${w.user}:${w.token}` },
    insecure: true, // WHM cert is for hostname, not the IP we dial
  });
  const meta = data.metadata ?? {};
  if ((meta.result ?? 0) != 1) {
    throw new Error(`WHM ${fn} failed: ${meta.reason ?? 'unknown'}`);
  }
  return data.data ?? {};
}

/** whm_list_accounts */
export async function whmListAccounts(): Promise<Account[]> {
  const d = await whmCall('listaccts');
  const accts: any[] = d.acct ?? [];
  return accts.map((a) => ({
    domain: a.domain ?? '',
    user: a.user ?? '',
    ip: a.ip ?? '',
    plan: a.plan ?? '',
    email: a.email ?? '',
    suspended: (a.suspended ?? 0) == 1,
  }));
}

/** whm_create_account */
export async function whmCreateAccount(
  domain: string,
  username: string,
  password: string,
  email: string
): Promise<any> {
  return whmCall('createacct', {
    domain,
    username,
    password,
    contactemail: email,
  });
}

/** whm_change_domain — change the main domain of an existing cPanel account. */
export async function whmChangeDomain(cpanelUser: string, newDomain: string): Promise<any> {
  return whmCall('modifyacct', { user: cpanelUser, domain: newDomain });
}

/** whm_login_url — create a one-time auto-login URL into a cPanel account (no password needed). */
export async function whmLoginUrl(cpanelUser: string): Promise<string> {
  const d = await whmCall('create_user_session', { user: cpanelUser, service: 'cpaneld' });
  return d.url ?? '';
}

/** whm_add_addon */
export async function whmAddAddon(cpanelUser: string, domain: string): Promise<any> {
  const dir = domain.replace(/[^a-z0-9]/gi, '');
  return whmCall('cpanel', {
    cpanel_jsonapi_user: cpanelUser,
    cpanel_jsonapi_apiversion: '2',
    cpanel_jsonapi_module: 'AddonDomain',
    cpanel_jsonapi_func: 'addaddondomain',
    newdomain: domain,
    subdomain: dir,
    dir: `public_html/${dir}`,
  });
}

// ---------- File management (via cPanel API2 Fileman::fileop) ----------
//
// This server blocks most Fileman UAPI funcs (mkdir/chmod/unlink/copy...).
// The ONE working entry point is API2 `Fileman::fileop` with an `op` verb.
// These wrappers give the panel full file control through it.

/** cpanel_api2 — low-level: call a cPanel API2 function for a user and return decoded JSON. */
export async function cpanelApi2(
  cpanelUser: string,
  module: string,
  func: string,
  params: Record<string, any> = {}
): Promise<any> {
  const w = getWhmConfig();
  const p = {
    cpanel_jsonapi_user: cpanelUser,
    cpanel_jsonapi_apiversion: '2',
    cpanel_jsonapi_module: module,
    cpanel_jsonapi_func: func,
    ...params,
  };
  const url = `https://${w.host}:${w.port}/json-api/cpanel`;
  const data = await httpJson(url, {
    method: 'POST',
    headers: {
      Authorization: `whm ${w.user}:${w.token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: buildQuery(p),
    insecure: true,
  });
  return data.cpanelresult ?? data;
}

/**
 * whm_fileop — run a fileop verb. op: chmod|unlink|trash|copy|move|rename|extract...
 * Returns true if the operation reported success.
 */
export async function whmFileop(
  cpanelUser: string,
  op: string,
  source: string,
  dest: string | null = null,
  meta: string | null = null
): Promise<boolean> {
  const params: Record<string, any> = { op, sourcefiles: source };
  if (dest !== null) params.destfiles = dest;
  if (meta !== null) params.metadata = meta;
  const r = await cpanelApi2(cpanelUser, 'Fileman', 'fileop', params);
  const rows: any[] = r.data ?? [];
  if (!rows || rows.length === 0) return (r.event?.result ?? 0) == 1;
  return parseInt(String(rows[0]?.result ?? 0), 10) === 1;
}

/** whm_chmod — chmod a path (dir or file). mode like '0755' or '0644'. */
export async function whmChmod(cpanelUser: string, path: string, mode: string): Promise<boolean> {
  return whmFileop(cpanelUser, 'chmod', path, null, mode);
}

/** whm_delete — delete a file or directory. */
export async function whmDelete(cpanelUser: string, path: string): Promise<boolean> {
  return whmFileop(cpanelUser, 'unlink', path);
}

/** whm_rename — rename/move: dest is the new full path (or target dir for move). */
export async function whmRename(cpanelUser: string, from: string, to: string): Promise<boolean> {
  return whmFileop(cpanelUser, 'rename', from, to);
}

/** whm_mkdir — make a directory (API2 Fileman::mkdir — the one create func that works here). */
export async function whmMkdir(cpanelUser: string, parentDir: string, name: string): Promise<boolean> {
  const r = await cpanelApi2(cpanelUser, 'Fileman', 'mkdir', { path: parentDir, name });
  // "File exists" counts as already-there = fine
  const err = String(r.error ?? '');
  return err === '' || err.toLowerCase().includes('exists');
}

/**
 * whm_list_dir — list a directory.
 * Returns [{ file, type, mode(octal int), writable(bool), size }, ...]
 */
export async function whmListDir(cpanelUser: string, dir: string): Promise<DirEntry[]> {
  const w = getWhmConfig();
  const p = {
    cpanel_jsonapi_user: cpanelUser,
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'list_files',
    dir,
  };
  const url = `https://${w.host}:${w.port}/json-api/cpanel?${buildQuery(p)}`;
  const data = await httpJson(url, {
    headers: { Authorization: `whm ${w.user}:${w.token}` },
    insecure: true,
  });
  const rows: any[] = data.result?.data ?? [];
  const out: DirEntry[] = [];
  for (const r of rows) {
    const mode = parseInt(String(r.mode ?? 0), 10) || 0;
    out.push({
      file: r.file ?? '',
      type: r.type ?? '',
      mode: mode & 0o7777,
      writable: (mode & 0o200) !== 0, // owner write bit
      size: r.size ?? 0,
    });
  }
  return out;
}

/**
 * whm_fix_permissions — fix permissions across a user's public_html: any dir
 * missing the owner-write bit -> 0755, any file missing it -> 0644. This cures
 * the "Permission denied / .lock" edit failure caused by 0555 folders. Recurses
 * one level into subdirs (enough for typical sites). Returns a summary.
 */
export async function whmFixPermissions(
  cpanelUser: string,
  baseDir = ''
): Promise<FixPermsResult> {
  if (baseDir === '') baseDir = `/home/${cpanelUser}/public_html`;
  const fixed: FixPermsResult = { dirs: [], files: [], failed: [] };
  const walk = async (dir: string, depth: number): Promise<void> => {
    for (const item of await whmListDir(cpanelUser, dir)) {
      const name = item.file;
      if (name === '' || name[0] === '.') continue;
      const path = `${dir}/${name}`;
      if (item.type === 'dir') {
        if (!item.writable) {
          if (await whmChmod(cpanelUser, path, '0755')) fixed.dirs.push(path);
          else fixed.failed.push(path);
        }
        if (depth < 3) await walk(path, depth + 1); // recurse, cap depth
      } else {
        if (!item.writable) {
          if (await whmChmod(cpanelUser, path, '0644')) fixed.files.push(path);
          else fixed.failed.push(path);
        }
      }
    }
  };
  // also fix the base dir itself if locked
  await walk(baseDir, 0);
  return fixed;
}

/**
 * whm_ensure_dkim — generate/enable the DKIM key pair for a domain on the mail
 * server. (EmailAuth::ensure_dkim_keys_exist creates the key; enable_dkim signs
 * with it.) enable_dkim may not exist on all builds; ensure is enough.
 */
export async function whmEnsureDkim(cpanelUser: string, domain: string): Promise<void> {
  for (const fn of ['ensure_dkim_keys_exist', 'enable_dkim']) {
    try {
      await whmCall('cpanel', {
        cpanel_jsonapi_user: cpanelUser,
        cpanel_jsonapi_apiversion: '3',
        cpanel_jsonapi_module: 'EmailAuth',
        cpanel_jsonapi_func: fn,
        domain,
      });
    } catch {
      /* enable may not exist on all builds; ensure is enough */
    }
  }
}

/**
 * whm_get_dkim_txt — read the DKIM public-key TXT (name + value) from the
 * server's local DNS zone, so we can publish it on Cloudflare (which is the
 * authoritative DNS).
 * Returns { name: 'default._domainkey.<domain>', value: 'v=DKIM1;...' } or null.
 */
export async function whmGetDkimTxt(domain: string): Promise<DkimTxt | null> {
  let z: any;
  try {
    z = await whmCall('dumpzone', { domain });
  } catch {
    return null;
  }
  const zones: any[] = z.zone ?? [];
  for (const zn of zones) {
    for (const r of zn.record ?? []) {
      const name = String(r.name ?? '').replace(/\.+$/, '');
      if ((r.type ?? '') === 'TXT' && name.includes('_domainkey')) {
        // txtdata can be a string or an array of chunks
        let val: any = r.txtdata ?? '';
        if (Array.isArray(val)) val = val.join('');
        val = String(val).replace(/^"+|"+$/g, '');
        if (val.includes('DKIM1') || val.includes('p=')) {
          return { name, value: val };
        }
      }
    }
  }
  return null;
}

// --- cPanel account management (reset / suspend / terminate) ---

/** whm_suspend */
export async function whmSuspend(cpanelUser: string, on: boolean): Promise<any> {
  return whmCall(on ? 'suspendacct' : 'unsuspendacct', { user: cpanelUser });
}

/** whm_terminate */
export async function whmTerminate(cpanelUser: string): Promise<any> {
  return whmCall('removeacct', { user: cpanelUser });
}

/** whm_reset_password — "Reset" = generate a fresh cPanel password and return it. */
export async function whmResetPassword(cpanelUser: string): Promise<string> {
  const pass = genPassword();
  await whmCall('passwd', { user: cpanelUser, password: pass, db_pass_update: 1 });
  return pass;
}

/** whm_remove_addon — remove an addon domain from an account. */
export async function whmRemoveAddon(cpanelUser: string, domain: string): Promise<any> {
  const dir = domain.replace(/[^a-z0-9]/gi, '');
  return whmCall('cpanel', {
    cpanel_jsonapi_user: cpanelUser,
    cpanel_jsonapi_apiversion: '2',
    cpanel_jsonapi_module: 'AddonDomain',
    cpanel_jsonapi_func: 'deladdondomain',
    domain,
    subdomain: `${dir}.${await getMainDomain(cpanelUser)}`,
  });
}

/** get_main_domain */
export async function getMainDomain(cpanelUser: string): Promise<string> {
  for (const a of await whmListAccounts()) if (a.user === cpanelUser) return a.domain;
  return '';
}

// ---------- helpers ----------

/** gen_username — derive a valid cPanel username from a domain. */
export function genUsername(domain: string): string {
  let base = domain.toLowerCase().replace(/[^a-z0-9]/gi, '');
  base = (base || 'site').substring(0, 8);
  let u = (base + randomInt(1000, 9999)).substring(0, 16);
  if (!/^[a-z]/.test(u)) u = 's' + u.substring(0, 15);
  return u;
}

/** gen_password — 16 unambiguous chars + '!9' suffix. */
export function genPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 16; i++) p += chars[randomInt(0, chars.length - 1)];
  return p + '!9';
}

// PHP random_int() is inclusive on both ends AND cryptographically secure —
// mirror both. crypto.randomInt(min, maxExclusive) so add 1 for an inclusive max.
// This matters: these ints seed generated cPanel passwords.
function randomInt(min: number, max: number): number {
  return nodeRandomInt(min, max + 1);
}
