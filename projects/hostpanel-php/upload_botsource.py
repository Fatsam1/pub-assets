#!/usr/bin/env python3
"""Upload bot-source files to panelcou1999/public_html/bot-source/ via WHM API."""
import os, sys, json, ssl, urllib.parse, urllib.request

ENV = {}
for path in [r"E:\work\.env"]:
    if os.path.isfile(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            ENV[k.strip()] = v.strip()

HOST = ENV.get("WHM_HOST", "54.38.221.66")
USER = ENV.get("WHM_USER", "streamfl")
TOKEN = ENV["WHM_API_TOKEN"]
CU = "panelcou1999"
DEST = f"/home/{CU}/public_html/bot-source"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Bot source files from final-project/
SRC = r"E:\work\final-project"

FILES = [
    "admin-dashboard.php",
    "bot-api.php",
    "download-file.php",
    "download.php",
    "id-lookup.php",
    "img-proxy.php",
    "letter-open.php",
    "letter.php",
    "login.php",
    "logo-proxy.php",
    "logout.php",
    "landing.php",
    "mobile.php",
    "proxy-dl.php",
    "tracking.php",
    "webhook.php",
]

def save_file(dest_dir, dest_name, content):
    params = {
        "api.version": "1",
        "cpanel_jsonapi_user": CU,
        "cpanel_jsonapi_apiversion": "3",
        "cpanel_jsonapi_module": "Fileman",
        "cpanel_jsonapi_func": "save_file_content",
        "dir": dest_dir,
        "file": dest_name,
        "content": content,
    }
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(
        f"https://{HOST}:2087/json-api/cpanel",
        data=data,
        headers={"Authorization": f"whm {USER}:{TOKEN}"},
        method="POST",
    )
    with urllib.request.urlopen(req, context=ctx, timeout=120) as r:
        d = json.loads(r.read().decode())
    res = d.get("result", d)
    return res.get("status") == 1, res.get("errors")

# Also upload proxy.php to public_html root (not bot-source)
extra = {
    f"/home/{CU}/public_html": ["proxy.php"],
}

for f in FILES:
    local = os.path.join(SRC, f)
    if not os.path.isfile(local):
        print(f"SKIP (missing): {f}")
        continue
    content = open(local, encoding="utf-8", errors="replace").read()
    ok, errs = save_file(DEST, f, content)
    size = len(content.encode("utf-8"))
    print(f"{'OK  ' if ok else 'FAIL'} bot-source/{f}  ({size:,} bytes){'' if ok else '  ' + str(errs)}")

print()
for dest_dir, flist in extra.items():
    for f in flist:
        local = os.path.join(SRC, f)
        if not os.path.isfile(local):
            print(f"SKIP (missing): {f}")
            continue
        content = open(local, encoding="utf-8", errors="replace").read()
        ok, errs = save_file(dest_dir, f, content)
        size = len(content.encode("utf-8"))
        print(f"{'OK  ' if ok else 'FAIL'} {f}  ({size:,} bytes){'' if ok else '  ' + str(errs)}")

print("\nDone.")
