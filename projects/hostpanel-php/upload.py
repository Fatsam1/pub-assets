#!/usr/bin/env python3
"""Upload HostPanel PHP files into the target cPanel's public_html via WHM's
cPanel proxy (Fileman::save_file_content). Reads tokens from E:\\work\\.env."""
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
CU = os.environ.get("CPANEL_USER", "panelcou1999")
DEST = f"/home/{CU}/public_html"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ["index.php", "config.php", "lib.php", "api.php"]


def save_file(dest_name, content):
    params = {
        "api.version": "1",
        "cpanel_jsonapi_user": CU,
        "cpanel_jsonapi_apiversion": "3",
        "cpanel_jsonapi_module": "Fileman",
        "cpanel_jsonapi_func": "save_file_content",
        "dir": DEST,
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
    with urllib.request.urlopen(req, context=ctx, timeout=90) as r:
        d = json.loads(r.read().decode())
    res = d.get("result", d)
    return res.get("status") == 1, res.get("errors")


for f in FILES:
    local = os.path.join(HERE, f)
    if not os.path.isfile(local):
        print(f"SKIP (missing): {f}")
        continue
    content = open(local, encoding="utf-8").read()
    ok, errs = save_file(f, content)
    print(f"{'OK  ' if ok else 'FAIL'} {f}  ({len(content)} bytes){'' if ok else '  ' + str(errs)}")

print("\nDone.")
