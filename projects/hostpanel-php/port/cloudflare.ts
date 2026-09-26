// cloudflare.ts — Cloudflare API v4 client + per-domain protection logic,
// plus DNSBL blocklist monitoring.
//
// Faithful 1:1 port of the Cloudflare half of hostpanel-php/lib.php.
// Modern TS / ESM, Node 20+ built-in fetch, runs under tsx.
//
// Cloudflare uses normal TLS (no insecure agent, unlike the WHM client).
// The DNSBL checks use node's dns/promises resolve4() in place of PHP's
// checkdnsrr(): an A record resolving = listed; NXDOMAIN/error = clean.
import { resolve4 } from 'node:dns/promises';

// ---------- config ----------

export interface CfConfig {
  token: string;
  globalKey: string;
  email: string;
  accountId: string;
}

let _cfConfig: CfConfig | null = null;

/** Read Cloudflare config from process.env once. */
export function getCfConfig(): CfConfig {
  if (_cfConfig) return _cfConfig;
  _cfConfig = {
    token: process.env.CLOUDFLARE_API_TOKEN || '',
    globalKey: process.env.CF_GLOBAL_KEY || '',
    email: process.env.CF_EMAIL || '',
    accountId: process.env.CF_ACCOUNT_ID || '52acf31e723a20e6fc27394dad577c52',
  };
  return _cfConfig;
}

// ---------- types ----------

export interface Zone {
  id: string;
  name: string;
  status: string;
  nameservers: string[];
}

export interface ProtectionState {
  security_level: string | null;
  ssl: string | null;
  always_use_https: string | null;
  browser_check: string | null;
  hotlink_protection: string | null;
  antibot: boolean;
  ratelimit: boolean;
}

export type SmartStatus = 'live' | 'pending' | 'no-ssl' | 'not-on-cloudflare';

export interface SmartStatusResult {
  status: SmartStatus;
  nameservers: string[];
  detail: string;
}

// ---------- HTTP helper (mirrors PHP http_json for the CF/normal-TLS path) ----------

interface HttpOpts {
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
  timeout?: number; // seconds (as in PHP)
}

/** Perform an HTTP request and decode JSON, mirroring the PHP http_json(). */
async function httpJson(url: string, opts: HttpOpts = {}): Promise<any> {
  const controller = new AbortController();
  const timeoutMs = (opts.timeout ?? 120) * 1000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let raw: string;
  let code = 0;
  try {
    const init: RequestInit = {
      method: opts.method ?? 'GET',
      headers: opts.headers ?? {},
      signal: controller.signal,
    };
    if (opts.body !== undefined && opts.body !== null) init.body = opts.body;
    const res = await fetch(url, init);
    code = res.status;
    raw = await res.text();
  } catch (e: any) {
    throw new Error(`request failed: ${e?.message ?? String(e)}`);
  } finally {
    clearTimeout(timer);
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

// ---------- Cloudflare ----------

/**
 * cf_call — Cloudflare API v4 request. Prefer the Global Key (full account
 * access, needed for zone creation); fall back to the scoped token for
 * everything else. Throws with the joined error messages on !success.
 */
export async function cfCall(
  path: string,
  method = 'GET',
  body: any = null
): Promise<any> {
  const cf = getCfConfig();
  let headers: Record<string, string>;
  if (cf.globalKey && cf.email) {
    headers = {
      'X-Auth-Email': cf.email,
      'X-Auth-Key': cf.globalKey,
      'Content-Type': 'application/json',
    };
  } else {
    headers = {
      Authorization: `Bearer ${cf.token}`,
      'Content-Type': 'application/json',
    };
  }
  const data = await httpJson(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : null,
    timeout: 40,
  });
  if (!(data.success ?? false)) {
    const msg = (data.errors ?? []).map((e: any) => e.message ?? '').join('; ');
    throw new Error(`Cloudflare ${method} ${path}: ${msg || 'unknown error'}`);
  }
  return data.result;
}

/** cf_list_zones */
export async function cfListZones(): Promise<Zone[]> {
  const zones: any[] = await cfCall('/zones?per_page=50');
  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    status: z.status,
    nameservers: z.name_servers ?? [],
  }));
}

/** cf_get_zone — raw zone object for an exact name, or null. */
export async function cfGetZone(name: string): Promise<any | null> {
  const r: any[] = await cfCall('/zones?name=' + encodeURIComponent(name));
  return r[0] ?? null;
}

/** cf_add_zone — add a zone (idempotent: returns the existing zone if present). */
export async function cfAddZone(name: string): Promise<any> {
  const existing = await cfGetZone(name);
  if (existing) return existing;
  const cf = getCfConfig();
  const body: any = { name, jump_start: false };
  if (cf.accountId) body.account = { id: cf.accountId };
  return cfCall('/zones', 'POST', body);
}

/** cf_point_to_server — set proxied A records for domain + www.domain, replacing any existing. */
export async function cfPointToServer(zoneId: string, domain: string, ip: string): Promise<void> {
  for (const name of [domain, `www.${domain}`]) {
    const existing: any[] = await cfCall(
      `/zones/${zoneId}/dns_records?type=A&name=` + encodeURIComponent(name)
    );
    for (const e of existing) await cfCall(`/zones/${zoneId}/dns_records/${e.id}`, 'DELETE');
    await cfCall(`/zones/${zoneId}/dns_records`, 'POST', {
      type: 'A',
      name,
      content: ip,
      proxied: true,
      ttl: 1,
    });
  }
}

/** cf_upsert_txt — upsert a TXT record, replacing matching SPF/DMARC/_dmarc records first. */
export async function cfUpsertTxt(zoneId: string, name: string, content: string): Promise<void> {
  const existing: any[] = await cfCall(
    `/zones/${zoneId}/dns_records?type=TXT&name=` + encodeURIComponent(name)
  );
  for (const e of existing) {
    const val = String(e.content ?? '').replace(/^"+|"+$/g, '');
    if (
      (content.startsWith('v=spf1') && val.startsWith('v=spf1')) ||
      content.startsWith('v=DMARC1') ||
      name.startsWith('_dmarc')
    ) {
      await cfCall(`/zones/${zoneId}/dns_records/${e.id}`, 'DELETE');
    }
  }
  await cfCall(`/zones/${zoneId}/dns_records`, 'POST', {
    type: 'TXT',
    name,
    content,
    ttl: 1,
  });
}

/** cf_set_spf */
export async function cfSetSpf(zoneId: string, domain: string, ip: string): Promise<void> {
  await cfUpsertTxt(zoneId, domain, `v=spf1 ip4:${ip} ~all`);
}

/**
 * cf_set_dmarc — DMARC policy ramp: start at 'none' (monitor/warm-up), then step
 * up to 'quarantine', then 'reject' as confidence grows. Higher = stronger
 * protection against someone spoofing the domain, but ramp gradually so legit
 * mail isn't dropped. pct limits how much mail the policy applies to during a step.
 */
export async function cfSetDmarc(
  zoneId: string,
  domain: string,
  email: string,
  policy = 'none',
  pct = 100
): Promise<void> {
  policy = ['none', 'quarantine', 'reject'].includes(policy) ? policy : 'none';
  pct = Math.max(1, Math.min(100, pct));
  const rua = email ? `; rua=mailto:${email}` : '';
  const pctPart = pct < 100 ? `; pct=${pct}` : '';
  await cfUpsertTxt(
    zoneId,
    `_dmarc.${domain}`,
    `v=DMARC1; p=${policy}; sp=${policy}; adkim=r; aspf=r${pctPart}${rua}`
  );
}

/** cf_get_dmarc_policy — read the current DMARC policy ('none'|'quarantine'|'reject'|null) from DNS. */
export async function cfGetDmarcPolicy(zoneId: string, domain: string): Promise<string | null> {
  const recs: any[] = await cfCall(
    `/zones/${zoneId}/dns_records?type=TXT&name=` + encodeURIComponent(`_dmarc.${domain}`)
  );
  for (const r of recs) {
    const v = String(r.content ?? '');
    if (v.includes('DMARC1')) {
      const m = v.match(/\bp=(\w+)/);
      if (m) return m[1];
    }
  }
  return null;
}

/**
 * cf_advance_dmarc — advance the DMARC policy one step:
 * none -> quarantine -> reject. Returns the new policy, or the current one if
 * already at reject.
 */
export async function cfAdvanceDmarc(zoneId: string, domain: string, email: string): Promise<string> {
  const cur = (await cfGetDmarcPolicy(zoneId, domain)) ?? 'none';
  const map: Record<string, string> = { none: 'quarantine', quarantine: 'reject', reject: 'reject' };
  const next = map[cur] ?? 'quarantine';
  await cfSetDmarc(zoneId, domain, email, next);
  return next;
}

/**
 * cf_set_dkim — publish the DKIM public-key TXT (default._domainkey.<domain>) to
 * Cloudflare. name/value come from whmGetDkimTxt(). Upserts by exact record name
 * so a re-run replaces an old key instead of duplicating it.
 */
export async function cfSetDkim(zoneId: string, name: string, value: string): Promise<void> {
  const existing: any[] = await cfCall(
    `/zones/${zoneId}/dns_records?type=TXT&name=` + encodeURIComponent(name)
  );
  for (const e of existing) await cfCall(`/zones/${zoneId}/dns_records/${e.id}`, 'DELETE');
  await cfCall(`/zones/${zoneId}/dns_records`, 'POST', {
    type: 'TXT',
    name,
    content: value,
    ttl: 1,
  });
}

/**
 * cf_apply_protection — deeper hardening bundle: encryption, TLS, bots, and
 * availability. Each setting is best-effort (SKIPPED on failure). Adds HSTS last.
 */
export async function cfApplyProtection(zoneId: string): Promise<string[]> {
  const applied: string[] = [];
  const settings: [string, string][] = [
    ['ssl', 'full'], // encrypt visitor↔CF↔origin
    ['always_use_https', 'on'], // no plaintext
    ['automatic_https_rewrites', 'on'], // fix mixed content
    ['min_tls_version', '1.2'], // drop weak TLS
    ['tls_1_3', 'on'], // modern TLS
    ['opportunistic_encryption', 'on'],
    ['security_level', 'high'], // challenge suspicious visitors
    ['browser_check', 'on'], // block header-obvious bots
    ['hotlink_protection', 'on'], // stop asset theft
    ['always_online', 'on'], // serve cached copy if origin down
    ['email_obfuscation', 'on'], // hide emails from scrapers
    ['server_side_exclude', 'on'],
  ];
  for (const [key, value] of settings) {
    try {
      await cfCall(`/zones/${zoneId}/settings/${key}`, 'PATCH', { value });
      applied.push(`${key}=${value}`);
    } catch {
      applied.push(`${key}: SKIPPED`);
    }
  }
  // HSTS — force HTTPS at the browser level for 6 months
  try {
    await cfCall(`/zones/${zoneId}/settings/security_header`, 'PATCH', {
      value: {
        strict_transport_security: {
          enabled: true,
          max_age: 15552000,
          include_subdomains: true,
          nosniff: true,
        },
      },
    });
    applied.push('hsts=on');
  } catch {
    applied.push('hsts: SKIPPED');
  }
  return applied;
}

/** cf_enable_bot_fight */
export async function cfEnableBotFight(zoneId: string): Promise<string> {
  try {
    await cfCall(`/zones/${zoneId}/bot_management`, 'PUT', { fight_mode: true });
    return 'bot_fight_mode=on';
  } catch {
    return 'bot_fight_mode: SKIPPED';
  }
}

/**
 * cf_antibot_expression — anti-bot WAF rule expression: managed_challenge for
 * EVERY visitor that is not a Cloudflare-verified bot (Google/Bing/etc), except
 * on the API/webhook/notification paths — so Telegram callbacks and the bots of
 * projects hosted on the cPanel keep working, while page visitors must pass a JS
 * challenge. A real browser solves it once (clearance cookie); curl/headless
 * bots with a spoofed browser UA fail it. Narrow UA/ASN matching was
 * insufficient — a bot with a fake Chrome UA on a residential IP passed straight
 * through.
 */
export function cfAntibotExpression(): string {
  // Paths that must NEVER be challenged (notifications / integrations / ACME).
  const safe = [
    '/api',
    '/webhook',
    '/hook',
    '/bot',
    '/notify',
    '/callback',
    '/webhooks',
    '/telegram',
    '/.well-known',
  ];
  const pathParts = safe.map((p) => `not starts_with(http.request.uri.path, "${p}")`);
  pathParts.push('not http.request.uri.path contains "/wp-json/"');
  const pathSafe = pathParts.join(' and ');
  return `(not cf.client.bot) and (${pathSafe})`;
}

/**
 * cf_apply_antibot — install the hostpanel-antibot managed_challenge rule.
 * Idempotent: removes any prior 'hostpanel-antibot' rule before re-adding.
 * Bot Fight Mode adds behavioural bot detection on top of the challenge rule.
 */
export async function cfApplyAntibot(zoneId: string): Promise<string> {
  const rule = {
    action: 'managed_challenge',
    expression: cfAntibotExpression(),
    description: 'hostpanel-antibot',
    enabled: true,
  };
  try {
    const ep = await cfCall(
      `/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`
    );
    if (ep && ep.id) {
      const rsid = ep.id;
      for (const r of ep.rules ?? []) {
        if ((r.description ?? '') === 'hostpanel-antibot') {
          try {
            await cfCall(`/zones/${zoneId}/rulesets/${rsid}/rules/${r.id}`, 'DELETE');
          } catch {
            /* ignore */
          }
        }
      }
      await cfCall(`/zones/${zoneId}/rulesets/${rsid}/rules`, 'POST', rule);
    } else {
      await cfCall(`/zones/${zoneId}/rulesets`, 'POST', {
        name: 'HostPanel Bot Protection',
        kind: 'zone',
        phase: 'http_request_firewall_custom',
        rules: [rule],
      });
    }
    // Bot Fight Mode adds behavioural bot detection on top of the challenge
    // rule. Requires enable_js; harmless if the plan ignores it.
    try {
      await cfCall(`/zones/${zoneId}/bot_management`, 'PUT', { fight_mode: true, enable_js: true });
    } catch {
      /* ignore */
    }
    return 'antibot=on';
  } catch (e: any) {
    return `antibot: SKIPPED (${e?.message ?? String(e)})`;
  }
}

/** cf_enable_dnssec — enable DNSSEC (protects the domain's DNS from spoofing/hijacking). */
export async function cfEnableDnssec(zoneId: string): Promise<string> {
  try {
    const r = await cfCall(`/zones/${zoneId}/dnssec`, 'PATCH', { status: 'active' });
    return 'dnssec=' + (r.status ?? 'pending');
  } catch {
    return 'dnssec: SKIPPED';
  }
}

// ---------- Cloudflare: per-domain protection + Turnstile-style controls ----------

/**
 * cf_zone_for_domain — zone object for a domain (or its registrable parent).
 * Tries exact, then the last two labels.
 */
export async function cfZoneForDomain(domain: string): Promise<any | null> {
  const tries = [domain];
  const parts = domain.split('.');
  if (parts.length > 2) tries.push(parts.slice(-2).join('.'));
  for (const t of tries) {
    const z = await cfGetZone(t);
    if (z) return z;
  }
  return null;
}

/**
 * cf_smart_status — honest, smart liveness of a domain: it's only truly "live"
 * when the zone is active AND the Cloudflare SSL cert is active AND the site
 * answers over HTTPS with a VALID certificate (a working TLS handshake means the
 * SSL cert is issued & serving). Replicates the PHP curl HEAD probe with fetch:
 * a HEAD request that resolves = live; a TLS/network failure = SSL still
 * provisioning (no-ssl).
 */
export async function cfSmartStatus(domain: string): Promise<SmartStatusResult> {
  const zone = await cfZoneForDomain(domain);
  if (!zone) {
    return { status: 'not-on-cloudflare', nameservers: [], detail: 'not added to Cloudflare' };
  }
  const ns: string[] = zone.name_servers ?? [];
  // 1) zone must be active (nameservers verified)
  if ((zone.status ?? '') !== 'active') {
    return {
      status: 'pending',
      nameservers: ns,
      detail: 'waiting for nameservers to be set at the registrar',
    };
  }
  // 2) The real proof of "live": does the site answer over HTTPS with a VALID
  //    certificate? Node's fetch verifies TLS by default, so a resolved HEAD
  //    request implies a valid cert; a thrown error implies a TLS/cert problem.
  let ok = false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://${domain}/`, {
      method: 'HEAD',
      redirect: 'manual', // FOLLOWLOCATION => false
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    // A non-zero HTTP status with no TLS error = live (mirrors code>0 && err===0).
    if (res.status > 0) ok = true;
  } catch {
    ok = false; // TLS/cert/network problem
  } finally {
    clearTimeout(timer);
  }
  if (ok) {
    return {
      status: 'live',
      nameservers: ns,
      detail: 'active, valid SSL, responding over HTTPS',
    };
  }
  // HTTPS didn't complete with a valid cert yet → SSL still provisioning
  return {
    status: 'no-ssl',
    nameservers: ns,
    detail:
      'nameservers set — Cloudflare is finishing the SSL certificate (usually a few minutes)',
  };
}

/** cf_protection_state — read the current protection state of a zone (for the toggles UI). */
export async function cfProtectionState(zoneId: string): Promise<ProtectionState> {
  const get = async (key: string): Promise<string | null> => {
    try {
      const r = await cfCall(`/zones/${zoneId}/settings/${key}`);
      return r.value ?? null;
    } catch {
      return null;
    }
  };
  return {
    security_level: await get('security_level'),
    ssl: await get('ssl'),
    always_use_https: await get('always_use_https'),
    browser_check: await get('browser_check'),
    hotlink_protection: await get('hotlink_protection'),
    antibot: await cfAntibotActive(zoneId),
    ratelimit: await cfRatelimitActive(zoneId),
  };
}

/** cf_antibot_active — is the hostpanel-antibot WAF rule present & enabled on this zone? */
export async function cfAntibotActive(zoneId: string): Promise<boolean> {
  try {
    const ep = await cfCall(
      `/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`
    );
    for (const r of ep.rules ?? []) {
      if ((r.description ?? '') === 'hostpanel-antibot' && (r.enabled ?? false)) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** cf_set_setting */
export async function cfSetSetting(zoneId: string, key: string, value: string): Promise<void> {
  await cfCall(`/zones/${zoneId}/settings/${key}`, 'PATCH', { value });
}

/** cf_set_under_attack — Under Attack mode = the strong "Cloudflare challenge" for a zone. */
export async function cfSetUnderAttack(zoneId: string, on: boolean): Promise<void> {
  await cfSetSetting(zoneId, 'security_level', on ? 'under_attack' : 'medium');
}

/**
 * cf_apply_ratelimit — rate-limiting: block any IP that hammers login / auth /
 * common attack paths (credential-stuffing, brute force, WP probing). Protects
 * the CLIENT's landing pages without touching their code. Idempotent by
 * description. Free plan only permits action=block with a 10s window/timeout in
 * the rate-limit phase (managed_challenge & longer windows are paid); block is
 * fine here — it only triggers on abusive burst rates and clears fast.
 */
export async function cfApplyRatelimit(zoneId: string): Promise<string> {
  const expr =
    '(http.request.uri.path contains "/login" ' +
    'or http.request.uri.path contains "/signin" ' +
    'or http.request.uri.path contains "/wp-login" ' +
    'or http.request.uri.path contains "/xmlrpc.php" ' +
    'or http.request.uri.path contains "/administrator" ' +
    'or http.request.uri.path contains "/admin")';
  const rule = {
    action: 'block',
    description: 'hostpanel-ratelimit',
    expression: expr,
    enabled: true,
    ratelimit: {
      characteristics: ['ip.src', 'cf.colo.id'],
      period: 10, // window (seconds) — Free plan only allows 10
      requests_per_period: 8, // >8 hits/10s to those paths -> block
      mitigation_timeout: 10, // Free plan only allows 10s cool-down
    },
  };
  try {
    const ep = await cfCall(`/zones/${zoneId}/rulesets/phases/http_ratelimit/entrypoint`);
    if (ep && ep.id) {
      const rsid = ep.id;
      for (const r of ep.rules ?? []) {
        if ((r.description ?? '') === 'hostpanel-ratelimit') {
          try {
            await cfCall(`/zones/${zoneId}/rulesets/${rsid}/rules/${r.id}`, 'DELETE');
          } catch {
            /* ignore */
          }
        }
      }
      await cfCall(`/zones/${zoneId}/rulesets/${rsid}/rules`, 'POST', rule);
    } else {
      await cfCall(`/zones/${zoneId}/rulesets`, 'POST', {
        name: 'HostPanel Rate Limit',
        kind: 'zone',
        phase: 'http_ratelimit',
        rules: [rule],
      });
    }
    return 'ratelimit=on';
  } catch (e: any) {
    return `ratelimit: SKIPPED (${e?.message ?? String(e)})`;
  }
}

/** cf_ratelimit_active — is the hostpanel-ratelimit rule present & enabled? */
export async function cfRatelimitActive(zoneId: string): Promise<boolean> {
  try {
    const ep = await cfCall(`/zones/${zoneId}/rulesets/phases/http_ratelimit/entrypoint`);
    for (const r of ep.rules ?? []) {
      if ((r.description ?? '') === 'hostpanel-ratelimit' && (r.enabled ?? false)) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

// ---------- Blocklist (DNSBL) monitoring ----------
//
// Check an IP against major DNS blocklists. A listing means mail from this IP
// (and often the whole server) is being flagged as spam — the #1 cause of
// "my campaign lands in spam / the host got red-flagged" complaints.
//
// PHP used checkdnsrr($host, 'A'); here we use dns/promises resolve4(): an A
// record resolving = listed; NXDOMAIN/any error = clean.

export const HP_DNSBLS: Record<string, string> = {
  'zen.spamhaus.org': 'Spamhaus ZEN',
  'b.barracudacentral.org': 'Barracuda',
  'bl.spamcop.net': 'SpamCop',
  'dnsbl.sorbs.net': 'SORBS',
  'psbl.surriel.com': 'PSBL',
};

export interface BlocklistIpResult {
  ip: string;
  listed: boolean;
  on: string[];
  results: Record<string, boolean>;
  error?: string;
}

export interface BlocklistDomainResult {
  domain: string;
  listed: boolean;
  on: string[];
  results: Record<string, boolean>;
}

export interface BlocklistReport {
  serverIp: BlocklistIpResult;
  domain: BlocklistDomainResult;
  clean: boolean;
}

/** hp_reverse_ip — reverse an IPv4 for DNSBL queries: 1.2.3.4 -> 4.3.2.1. */
export function hpReverseIp(ip: string): string | null {
  const p = ip.split('.');
  if (p.length !== 4) return null;
  return p.reverse().join('.');
}

/** A record present = listed. Treat lookup failure (NXDOMAIN/etc) as "clean". */
async function dnsblListed(host: string): Promise<boolean> {
  try {
    const addrs = await resolve4(host);
    return addrs.length > 0;
  } catch {
    return false;
  }
}

/**
 * blocklist_check_ip — check one IP against all DNSBLs.
 * Returns { ip, listed, on: [names...], results: { bl: bool } }.
 */
export async function blocklistCheckIp(ip: string): Promise<BlocklistIpResult> {
  const rev = hpReverseIp(ip);
  const on: string[] = [];
  const results: Record<string, boolean> = {};
  if (rev === null) {
    return { ip, listed: false, on: [], results: {}, error: 'bad ip' };
  }
  for (const [bl, label] of Object.entries(HP_DNSBLS)) {
    const host = `${rev}.${bl}`;
    const listed = await dnsblListed(host);
    results[bl] = listed;
    if (listed) on.push(label);
  }
  return { ip, listed: on.length > 0, on, results };
}

/** blocklist_check_domain — check a domain against domain-based blocklists (Spamhaus DBL, SURBL). */
export async function blocklistCheckDomain(domain: string): Promise<BlocklistDomainResult> {
  const dbls: Record<string, string> = {
    'dbl.spamhaus.org': 'Spamhaus DBL',
    'multi.surbl.org': 'SURBL',
  };
  const on: string[] = [];
  const results: Record<string, boolean> = {};
  for (const [bl, label] of Object.entries(dbls)) {
    const listed = await dnsblListed(`${domain}.${bl}`);
    results[bl] = listed;
    if (listed) on.push(label);
  }
  return { domain, listed: on.length > 0, on, results };
}

/** blocklist_report — full report for a cPanel domain: server IP + the domain name. */
export async function blocklistReport(domain: string, serverIp: string): Promise<BlocklistReport> {
  const ipRes = await blocklistCheckIp(serverIp);
  const domRes = await blocklistCheckDomain(domain);
  return {
    serverIp: ipRes,
    domain: domRes,
    clean: !ipRes.listed && !domRes.listed,
  };
}
