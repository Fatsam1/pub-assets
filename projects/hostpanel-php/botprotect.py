import json, urllib.request, urllib.error, time
ENV = {}
for line in open(r'E:\work\.env', encoding='utf-8'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1); ENV[k.strip()] = v.strip()
CF = ENV['CF_GLOBAL_KEY']; EM = ENV['CF_EMAIL']

def call(path, method='GET', body=None):
    last = None
    for _ in range(6):
        try:
            req = urllib.request.Request('https://api.cloudflare.com/client/v4' + path,
                data=json.dumps(body).encode() if body else None,
                headers={'X-Auth-Email': EM, 'X-Auth-Key': CF, 'Content-Type': 'application/json'}, method=method)
            return json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
        except urllib.error.HTTPError as e:
            # 404 etc: return the parsed body instead of raising, so caller can branch
            try: return json.loads(e.read().decode())
            except: return {'success': False, 'errors': [{'code': e.code}]}
        except Exception as e:
            last = e; time.sleep(5)
    raise last

zones = {z['name']: z['id'] for z in call('/zones?per_page=50')['result']}
DOMAINS = ['casaisdeharo.com', 'prahim.shop', 'culipably.com']

# Paths that project bots / Telegram callbacks / APIs hit — these must NEVER be
# challenged, or notifications and integrations break (user requirement).
PATH_SAFE = ('not starts_with(http.request.uri.path, "/api") '
             'and not starts_with(http.request.uri.path, "/webhook") '
             'and not starts_with(http.request.uri.path, "/hook") '
             'and not starts_with(http.request.uri.path, "/bot") '
             'and not starts_with(http.request.uri.path, "/notify") '
             'and not starts_with(http.request.uri.path, "/callback") '
             'and not starts_with(http.request.uri.path, "/webhooks") '
             'and not starts_with(http.request.uri.path, "/telegram") '
             'and not http.request.uri.path contains "/wp-json/" '
             'and not starts_with(http.request.uri.path, "/.well-known")')
# Challenge EVERY visitor that is not a Cloudflare-verified bot (Google/Bing/etc),
# except on the API/webhook/notification paths above. A managed_challenge forces a
# JS challenge, so curl/headless bots with a spoofed browser UA fail it, while a
# real browser solves it once and gets a clearance cookie. Narrow UA/ASN matching
# was insufficient: a bot with a fake Chrome UA on a residential IP passed it.
expr = f'(not cf.client.bot) and ({PATH_SAFE})'

RULE = {'action': 'managed_challenge', 'expression': expr, 'description': 'hostpanel-antibot', 'enabled': True}

for dom in DOMAINS:
    zid = zones.get(dom)
    if not zid:
        print(dom, '-> not on CF'); continue
    ep = call(f'/zones/{zid}/rulesets/phases/http_request_firewall_custom/entrypoint')
    if ep.get('success') and ep.get('result'):
        rsid = ep['result']['id']
        for r in ep['result'].get('rules', []):
            if r.get('description') == 'hostpanel-antibot':
                call(f'/zones/{zid}/rulesets/{rsid}/rules/{r["id"]}', 'DELETE')
        res = call(f'/zones/{zid}/rulesets/{rsid}/rules', 'POST', RULE)
    else:
        # no custom ruleset yet -> create one with our rule
        res = call(f'/zones/{zid}/rulesets', 'POST', {
            'name': 'HostPanel Bot Protection', 'kind': 'zone',
            'phase': 'http_request_firewall_custom', 'rules': [RULE]})
    ok = res.get('success')
    try: call(f'/zones/{zid}/bot_management', 'PUT', {'fight_mode': True})
    except: pass
    print(dom, '-> bot protection:', 'OK' if ok else ('ERR '+str(res.get('errors'))))
