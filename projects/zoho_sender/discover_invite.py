"""
discover_invite.py — Zoho Survey invite URL discovery for Oscar's account
1. Login with Oscar's saved session (ZohoTestProf_Oscar)
2. Create a blank survey
3. Navigate to Publish -> Collect Responses -> Email Invites
4. Save the invite URL
"""
import sys, time, re, os, logging, ssl
ssl._create_default_https_context = ssl._create_unverified_context
os.environ["WDM_SSL_VERIFY"] = "0"

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

EMAIL   = "oscar.alonso.villaverde.gonzalez@alumnos.uvigo.es"
PW      = "fKo52dE81!PPHJ"       # Zoho password
PW_IMAP = "S0y#Un1v3rs1t4r10"   # IMAP password for oscar's university email
PROF    = r"C:\Users\FAT SAM\ZohoProfiles\profile_1"
DIR     = os.path.dirname(os.path.abspath(__file__))
LOG_F   = os.path.join(DIR, "discover_log.txt")
SAVE_F  = os.path.join(DIR, "invite_url.txt")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_F, encoding="utf-8", mode="w"),
        logging.StreamHandler(sys.stdout),
    ]
)
L = logging.getLogger()

def ss(d, name):
    try: d.save_screenshot(os.path.join(DIR, name))
    except: pass

def rw(a=1.5, b=3.0):
    import random
    time.sleep(random.uniform(a, b))

def wait_url_has(d, pattern, timeout=30):
    t = time.time()
    while time.time() - t < timeout:
        if pattern in d.current_url:
            return True
        time.sleep(0.8)
    return False

def _imap_get_otp(timeout=90, after_ts=None, email=None, imap_pw=None):
    """Fetch Zoho login OTP from IMAP — only emails received after after_ts."""
    import imaplib, email as _em, re as _re, ssl as _ssl
    from email.utils import parsedate_to_datetime
    _email = email or EMAIL
    _pw = imap_pw or PW_IMAP
    if after_ts is None:
        after_ts = time.time() - 120  # default: last 2 min
    ctx = _ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = _ssl.CERT_NONE
    domain = _email.split("@")[1]
    servers = [f"mail.{domain}", f"imap.{domain}"]
    imap = None
    for srv in servers:
        try:
            imap = imaplib.IMAP4_SSL(srv, 993, ssl_context=ctx)
            imap.login(_email, _pw)
            L.info(f"  IMAP OTP connected: {srv}")
            break
        except Exception as e:
            L.warning(f"  IMAP OTP {srv}: {e}")
    if not imap:
        return None
    deadline = time.time() + timeout
    # Try contextual match first, fallback to any 6-7 digit
    pattern_ctx = _re.compile(
        r'(?:verification code|OTP|one.time password|code is|passcode)[^\d]{0,10}(\d{4,8})',
        _re.IGNORECASE)
    pattern = _re.compile(r'\b(\d{6,7})\b')
    while time.time() < deadline:
        try:
            imap.select("INBOX")
            _, msgs = imap.search(None, 'FROM', '"zoho"')
            ids = msgs[0].split() if msgs and msgs[0] else []
            for mid in reversed(ids[-10:]):
                try:
                    _, hdr = imap.fetch(mid, "(BODY[HEADER.FIELDS (DATE)])")
                    date_hdr = hdr[0][1].decode("utf-8", errors="ignore") if hdr and hdr[0] else ""
                    dt_str = date_hdr.replace("Date:", "").strip()
                    try:
                        msg_ts = parsedate_to_datetime(dt_str).timestamp()
                    except:
                        msg_ts = 0
                    if msg_ts < after_ts:
                        L.info(f"  IMAP: skipping old email (ts={msg_ts:.0f} < {after_ts:.0f})")
                        continue
                    _, data = imap.fetch(mid, "(RFC822)")
                    msg = _em.message_from_bytes(data[0][1])
                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            if part.get_content_type() == "text/plain":
                                try: body += part.get_payload(decode=True).decode("utf-8", errors="ignore")
                                except: pass
                    else:
                        try: body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
                        except: pass
                    m = pattern_ctx.search(body) or pattern.search(body)
                    if m:
                        code = m.group(1)
                        imap.logout()
                        L.info(f"  IMAP: fresh OTP found: {code} (len={len(code)})")
                        return code
                except Exception as em:
                    L.warning(f"  IMAP msg parse: {em}")
        except Exception as e:
            L.warning(f"  IMAP OTP poll: {e}")
        L.info(f"  IMAP: no fresh OTP yet, polling in 6s...")
        time.sleep(6)
    try: imap.logout()
    except: pass
    return None

def login_if_needed(d, email=None, imap_pw=None):
    """Login via accounts.zoho.com if not on survey.zoho.com dashboard."""
    _email = email or EMAIL
    _imap_pw = imap_pw or PW_IMAP
    cur = d.current_url
    needs_login = (
        "survey.zoho.com" not in cur
        or "login" in cur.lower()
        or "signin" in cur.lower()
        or "accounts.zoho" in cur
    )
    if not needs_login:
        L.info("Already logged in!")
        return
    L.info("Login required — going to accounts.zoho.com...")
    try:
        d.get("https://accounts.zoho.com/signin?service=ZohoSurvey")
        rw(3, 5)
        ss(d, "login_1_page.png")
        wait = WebDriverWait(d, 15)
        # Email
        em = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "#login_id,input[name='LOGIN_ID'],input[type='email']")))
        em.clear()
        for ch in _email:
            em.send_keys(ch); time.sleep(0.04)
        for sel in ["#nextbtn", "button.signin-btn", "button[type='submit']"]:
            btns = [e for e in d.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
            if btns: btns[0].click(); L.info(f"  email next: {sel}"); break
        rw(3, 5)
        ss(d, "login_2_after_email.png")
        L.info(f"After email URL: {d.current_url[:80]}")

        # Click "Sign in using email OTP" — bypasses password + reCAPTCHA
        otp_request_ts = time.time()
        L.info("  Clicking 'Sign in using email OTP'...")
        otp_link_clicked = False
        for sel in [
            "//a[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email otp')]",
            "//span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email otp')]",
            "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email otp')]",
            "[id*='emailotp']", "[class*='emailotp']", "[href*='emailotp']",
        ]:
            try:
                by = By.XPATH if sel.startswith("//") else By.CSS_SELECTOR
                els = [e for e in d.find_elements(by, sel) if e.is_displayed()]
                if els:
                    d.execute_script("arguments[0].click();", els[0])
                    L.info(f"  OTP link clicked: {sel[:50]}")
                    otp_link_clicked = True
                    break
            except: pass

        rw(3, 5)
        ss(d, "login_3_otp_sent.png")
        pg_otp = d.execute_script("return document.body.innerText")[:400].lower()
        L.info(f"After OTP link: {pg_otp[:200]}")

        # Find OTP input field and get code from IMAP
        otp_el = None
        for sel in ["input[autocomplete='one-time-code']",
                    "input[placeholder*='OTP']","input[placeholder*='otp']",
                    "input[name*='otp']","input[id*='otp']","input[name='ztpc']",
                    "input[maxlength='8']","input[maxlength='7']","input[maxlength='6']",
                    "input[type='tel']","input[name='code']","input[type='number']",
                    "//input[@autocomplete='one-time-code']",
                    "//input[contains(@placeholder,'OTP') or contains(@placeholder,'otp')]"]:
            try:
                by = By.XPATH if sel.startswith("//") else By.CSS_SELECTOR
                els = [e for e in d.find_elements(by, sel) if e.is_displayed()]
                if els: otp_el = els[0]; L.info(f"  OTP field: {sel}"); break
            except: pass

        if otp_el:
            L.info("  Fetching OTP from IMAP (waiting for fresh email)...")
            otp_code = _imap_get_otp(timeout=120, after_ts=otp_request_ts,
                                     email=_email, imap_pw=_imap_pw)
            if otp_code:
                L.info(f"  OTP: {otp_code}")
                # Scroll into view + click to focus
                d.execute_script("arguments[0].scrollIntoView(true);", otp_el)
                time.sleep(0.3)
                try: otp_el.click()
                except: d.execute_script("arguments[0].click();", otp_el)
                time.sleep(0.3)
                # Use JS to set value (React-compatible)
                d.execute_script("""
                    var el = arguments[0], code = arguments[1];
                    try {
                        var setter = Object.getOwnPropertyDescriptor(
                            window.HTMLInputElement.prototype, 'value').set;
                        setter.call(el, code);
                    } catch(e) { el.value = code; }
                    el.dispatchEvent(new Event('input', {bubbles:true}));
                    el.dispatchEvent(new Event('change', {bubbles:true}));
                    el.dispatchEvent(new KeyboardEvent('keyup', {bubbles:true}));
                """, otp_el, otp_code)
                time.sleep(0.5)
                # Also send via keys as fallback
                try:
                    otp_el.send_keys(Keys.CONTROL + "a")
                    otp_el.send_keys(otp_code)
                except: pass
                L.info(f"  OTP typed — field value: {d.execute_script('return arguments[0].value', otp_el)}")
                time.sleep(0.5)
                for sel in [
                    "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'verify')]",
                    "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'sign in')]",
                    "#nextbtn","button[type='submit']","#sign-in-button"]:
                    try:
                        by = By.XPATH if sel.startswith("//") else By.CSS_SELECTOR
                        btns = [e for e in d.find_elements(by, sel) if e.is_displayed()]
                        if btns: btns[0].click(); L.info(f"  OTP submit: {sel[:40]}"); break
                    except: pass
                # Wait up to 15s for redirect away from accounts.zoho.com
                for _ in range(15):
                    time.sleep(1)
                    if "accounts.zoho.com" not in d.current_url:
                        break
                ss(d, "login_4_after_otp.png")
                pg_post = d.execute_script("return document.body.innerText")[:300].lower()
                L.info(f"  After OTP URL: {d.current_url[:100]}")
                L.info(f"  After OTP page: {pg_post[:200]}")
                # Handle "Keep me signed in" / trust device prompt
                for sel in [
                    "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'trust')]",
                    "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'yes')]",
                    "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'continue')]",
                    "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'proceed')]",
                ]:
                    try:
                        els = [e for e in d.find_elements(By.XPATH, sel) if e.is_displayed()]
                        if els:
                            d.execute_script("arguments[0].click();", els[0])
                            L.info(f"  Trust/continue clicked: {sel[8:40]}")
                            time.sleep(3); break
                    except: pass
            else:
                L.error("  No OTP from IMAP — trying password fallback")
                # Password fallback
                try:
                    pw_el = WebDriverWait(d, 8).until(
                        EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='password']")))
                    pw_el.clear()
                    for ch in PW: pw_el.send_keys(ch); time.sleep(0.04)
                    pw_el.send_keys(Keys.ENTER)
                    rw(6, 8)
                except: pass
        else:
            L.warning("  No OTP input field — trying password fallback")
            try:
                pw_el = WebDriverWait(d, 8).until(
                    EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='password']")))
                pw_el.clear()
                for ch in PW: pw_el.send_keys(ch); time.sleep(0.04)
                pw_el.send_keys(Keys.ENTER)
                rw(6, 8)
            except: pass

        ss(d, "login_5_result.png")
        L.info(f"After login URL: {d.current_url[:100]}")
    except Exception as e:
        L.error(f"Login error: {e}")

def extract_portal_dept(url):
    m = re.search(r'/portal/(\d+)/department/([^/&#]+)', url)
    if m:
        return m.group(1), m.group(2)
    return None, None

def create_survey(d, portal_id, dept_id):
    """Create a blank survey. Returns survey_id or None."""
    L.info("Creating blank survey...")

    # Navigate to template chooser
    create_url = (f"https://survey.zoho.com/survey/newui#/portal/{portal_id}"
                  f"/department/{dept_id}/createsurvey/templatesurvey")
    d.get(create_url)
    rw(4, 6)
    ss(d, "create_page.png")
    L.info(f"Create page URL: {d.current_url[:100]}")
    pg = d.execute_script("return document.body.innerText")[:600].lower()
    L.info(f"Create page text: {pg[:300]}")

    # Click "Create New Survey" — first tab on the left (blank/manual)
    clicked = False
    create_new_selectors = [
        "//a[normalize-space(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'))='create new survey']",
        "//span[normalize-space(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'))='create new survey']",
        "//div[normalize-space(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'))='create new survey']",
        "//a[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'create new survey')]",
    ]
    for sel in create_new_selectors:
        try:
            els = [e for e in d.find_elements(By.XPATH, sel) if e.is_displayed()]
            if els:
                L.info(f"Clicking 'Create New Survey': {sel[:70]}")
                d.execute_script("arguments[0].click();", els[0])
                rw(3, 5)
                ss(d, "after_create_new.png")
                clicked = True
                break
        except: pass

    if not clicked:
        # Fallback: first visible link/button with 'create' in text
        L.info("'Create New Survey' link not found — trying fallback...")
        items = d.execute_script("""
            var res=[];
            ['a','button','div','li','span'].forEach(function(tag){
                Array.from(document.querySelectorAll(tag)).forEach(function(e){
                    var t=(e.innerText||'').trim().toLowerCase();
                    if(t && t.length < 50 && e.getBoundingClientRect().width > 0)
                        res.push({tag:tag,text:t,cls:(e.className||'').slice(0,50),
                                  href:(e.href||''),x:e.getBoundingClientRect().left});
                });
            });
            return res.filter(function(r){return r.text.includes('create') || r.text.includes('blank') || r.text.includes('new survey');}).slice(0,10);
        """)
        for it in items:
            L.info(f"  [{it['tag']}] {it['text']!r} cls={it['cls']!r} x={it['x']}")
        # Click the leftmost one (smallest x)
        if items:
            try:
                all_els = []
                for it in items:
                    sel2 = f"//a[normalize-space(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'))='{it['text'].lower()[:30]}']"
                    try:
                        found = [e for e in d.find_elements(By.XPATH, sel2) if e.is_displayed()]
                        if found: all_els.append((it.get('x', 9999), found[0]))
                    except: pass
                if all_els:
                    all_els.sort(key=lambda x: x[0])
                    L.info(f"  Clicking leftmost element (x={all_els[0][0]})")
                    d.execute_script("arguments[0].click();", all_els[0][1])
                    rw(3, 5); clicked = True
            except: pass

    if not clicked:
        L.error("Could not click any create option")
        return None

    # Extract survey_id from URL after click
    rw(3, 5)
    url_now = d.current_url
    ss(d, "after_create_click.png")
    pg2 = d.execute_script("return document.body.innerText")[:600].lower()
    L.info(f"After create click URL: {url_now[:120]}")
    L.info(f"After create click page: {pg2[:300]}")

    # If on blanksurvey page — click "Create from scratch" card first
    rw(1, 2)
    if "blanksurvey" in d.current_url or "blanksurvey" in pg2:
        L.info("On blanksurvey page — clicking 'Create from scratch'...")
        for sel in [
            "//div[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'create from scratch') and not(contains(.,'survey using ai'))]",
            "//span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'create from scratch')]",
            "//li[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'create from scratch')]",
            "//a[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'create from scratch')]",
            "//*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'scratch')]",
        ]:
            try:
                els = [e for e in d.find_elements(By.XPATH, sel) if e.is_displayed()]
                if els:
                    L.info(f"Clicking 'Create from scratch': {sel[:60]}")
                    d.execute_script("arguments[0].click();", els[0])
                    time.sleep(2)
                    ss(d, "after_scratch_click.png")
                    break
            except: pass

    SENDER_NAME = "​"  # zero-width space → Zoho black bar shows blank

    # Step 1: Click "Create Survey" button — this opens the name dialog
    for sel in [
        "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'create survey')]",
        "//button[normalize-space(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'))='create']",
        "//button[@type='submit']",
    ]:
        try:
            els = [e for e in d.find_elements(By.XPATH, sel) if e.is_displayed()]
            if els:
                L.info(f"Opening name dialog: {els[0].text!r}")
                d.execute_script("arguments[0].click();", els[0])
                time.sleep(2)
                break
        except: pass

    # Step 2: Fill name input that appeared in the dialog (placeholder starts with "su")
    ss(d, "name_dialog.png")
    pg_dlg = d.execute_script("return document.body.innerText")[:300].lower()
    L.info(f"Name dialog text: {pg_dlg[:200]}")
    name_filled = False
    # Dump ALL visible inputs for diagnosis
    ss(d, "name_dialog.png")
    pg_dlg = d.execute_script("return document.body.innerText")[:300].lower()
    L.info(f"Name dialog text: {pg_dlg[:200]}")
    all_inputs = d.execute_script("""
        var res=[];
        document.querySelectorAll('input,textarea,[contenteditable]').forEach(function(e){
            if(e.offsetWidth>0 && e.offsetParent!==null)
                res.push({tag:e.tagName,type:(e.type||''),ph:(e.placeholder||''),
                    val:(e.value||e.innerText||'').slice(0,30),
                    id:(e.id||''),cls:(e.className||'').slice(0,40)});
        });
        return res;
    """)
    for inp in all_inputs:
        L.info(f"  INPUT {inp['tag']} type={inp['type']!r} ph={inp['ph']!r} val={inp['val']!r} id={inp['id']!r}")

    # Fill via real send_keys (Ember needs keyboard events, not just JS .value)
    for inp in all_inputs:
        if inp['type'] in ('hidden','password','submit','button','checkbox','radio','file','image'):
            continue
        try:
            el = d.find_element(By.ID, inp['id']) if inp['id'] else None
            if not el:
                tag = inp['tag'].lower()
                candidates = d.find_elements(By.CSS_SELECTOR, tag)
                el = next((e for e in candidates if e.is_displayed()), None)
            if not el or not el.is_displayed():
                continue
            d.execute_script("arguments[0].scrollIntoView(true);", el)
            time.sleep(0.2)
            el.click()
            time.sleep(0.2)
            el.send_keys(Keys.CONTROL + "a")
            el.send_keys(Keys.DELETE)
            time.sleep(0.1)
            for ch in SENDER_NAME:
                el.send_keys(ch)
                time.sleep(0.03)
            time.sleep(0.3)
            val_after = d.execute_script("return arguments[0].value", el)
            L.info(f"  send_keys on {inp['tag']} id={inp['id']!r}: val={val_after!r}")
            # Press Enter to trigger Ember form submission
            el.send_keys(Keys.RETURN)
            time.sleep(2)
            L.info(f"  After ENTER URL: {d.current_url[:100]}")
            name_filled = True
            break
        except Exception as ex:
            L.warning(f"  Name fill err ({inp['id']!r}): {ex}")
    if not name_filled:
        L.warning("Name input NOT found in dialog")

    time.sleep(0.5)
    ss(d, "name_filled.png")

    # Step 2b: Select category if dropdown present
    time.sleep(2.5)  # give Ember extra time to render full form after ENTER
    pg_cat = d.execute_script("return document.body.innerText")[:600].lower()
    L.info(f"After name entry page: {pg_cat[:300]}")

    # Dump all interactive elements for diagnosis
    all_els_info = d.execute_script("""
        var info=[];
        document.querySelectorAll('[role],[tabindex],[class*="select"],[class*="trigger"],[class*="power"],[class*="ember"],[class*="category"],[class*="dropdown"]').forEach(function(e){
            if(e.offsetParent===null) return;
            var r=e.getBoundingClientRect();
            if(r.width<2||r.height<2) return;
            info.push({tag:e.tagName,cls:(e.className||'').slice(0,60),
                role:(e.getAttribute('role')||''),
                tab:(e.getAttribute('tabindex')||''),
                txt:(e.innerText||e.textContent||'').replace(/\\s+/,' ').trim().slice(0,50),
                y:Math.round(r.y)});
        });
        return info.slice(0,25);
    """)
    for ei in all_els_info:
        L.info(f"  EL {ei['tag']} cls={ei['cls']!r} role={ei['role']!r} txt={ei['txt']!r} y={ei['y']}")

    from selenium.webdriver.common.action_chains import ActionChains
    cat_clicked = False

    if "category" in pg_cat or "select a category" in pg_cat:
        L.info("Category dropdown found — checking if items already visible...")

        # The category is a Bootstrap dropdown (not Ember Power Select).
        # After pressing ENTER in the name field, the dropdown is ALREADY OPEN.
        # Just click the first visible <a class="itemLink"> directly.
        def _get_first_item():
            return d.execute_script("""
                var items = document.querySelectorAll('a.itemLink, a[role="menuitem"]');
                for (var i=0; i<items.length; i++) {
                    var r = items[i].getBoundingClientRect();
                    if (r.height > 0 && r.width > 0 && items[i].offsetParent !== null)
                        return items[i];
                }
                return null;
            """)

        first_item = _get_first_item()

        if not first_item:
            # Dropdown not open yet — click the toggle button to open it
            L.info("Items not visible — clicking dropdown toggle to open...")
            toggle = d.execute_script("""
                var btn = document.querySelector('button.dropdown-toggle');
                if (btn && btn.offsetParent !== null) return btn;
                var btn2 = document.querySelector('.zsSelector .btn');
                if (btn2 && btn2.offsetParent !== null) return btn2;
                return null;
            """)
            if toggle:
                toggle_txt = d.execute_script("return (arguments[0].innerText||'').slice(0,40)", toggle)
                L.info(f"Clicking toggle: {toggle_txt!r}")
                d.execute_script("arguments[0].click();", toggle)
                time.sleep(1.5)
                ss(d, "category_open.png")
                first_item = _get_first_item()
            else:
                L.warning("No toggle button found — dropdown may already be correct state")

        if first_item:
            item_txt = d.execute_script("return (arguments[0].innerText||'').trim()", first_item)
            L.info(f"Clicking first category item: {item_txt!r}")
            d.execute_script("arguments[0].click();", first_item)
            time.sleep(1.5)
            # Verify selection took effect
            pg_after = d.execute_script("return document.body.innerText")[:400].lower()
            if "select a category" not in pg_after or item_txt.lower() in pg_after:
                cat_clicked = True
                L.info(f"Category selected: {item_txt!r}")
            else:
                L.warning(f"Category click may not have worked — page still shows select a category")
                # Try clicking the button toggle first, then the item
                toggle2 = d.execute_script("return document.querySelector('button.dropdown-toggle, .zsSelector .btn');")
                if toggle2:
                    d.execute_script("arguments[0].click();", toggle2)
                    time.sleep(1)
                first_item2 = _get_first_item()
                if first_item2:
                    d.execute_script("arguments[0].click();", first_item2)
                    time.sleep(1)
                    cat_clicked = True
                    L.info("Category retry click done")
            ss(d, "category_selected.png")
        else:
            L.warning("No category items found — proceeding without category (likely optional)")

        ss(d, "after_category.png")
        pg_after_cat = d.execute_script("return document.body.innerText")[:400].lower()
        L.info(f"After category selection: {pg_after_cat[100:300]}")

    # Step 3: Verify survey name still in input, then click the modal's "Create" button
    # The modal buttons are "Cancel" and "Create" (NOT "Create Survey" — that's the nav link)
    # First verify/refill name if it got cleared
    name_val_now = d.execute_script("""
        var inp = document.querySelector('input.txtName, input[id="ember87"], input[class*="txtName"]');
        return inp ? inp.value : null;
    """)
    L.info(f"Name input value before submit: {name_val_now!r}")
    if not name_val_now or name_val_now.strip() == '':
        L.info("Name was cleared — refilling...")
        refill_el = d.execute_script("""
            return document.querySelector('input.txtName, input[id="ember87"], input[class*="txtName"]');
        """)
        if refill_el:
            d.execute_script("arguments[0].click();", refill_el)
            time.sleep(0.2)
            for ch in SENDER_NAME:
                refill_el.send_keys(ch)
                time.sleep(0.03)
            time.sleep(0.3)
            L.info(f"Name refilled: {SENDER_NAME!r}")

    # Dump all buttons/links inside modal to find the correct "Create" button
    modal_btns = d.execute_script("""
        var modal = document.querySelector('.modal-dialog, .modal-content, [role="dialog"]');
        if (!modal) modal = document;
        var res = [];
        modal.querySelectorAll('button,a[class*="btn"]').forEach(function(e){
            if (e.offsetParent !== null) {
                res.push({tag:e.tagName, cls:(e.className||'').slice(0,60),
                    txt:(e.innerText||'').trim().slice(0,40),
                    type:(e.getAttribute('type')||'')});
            }
        });
        return res;
    """)
    for mb in modal_btns:
        L.info(f"  Modal btn: {mb['tag']} cls={mb['cls']!r} txt={mb['txt']!r} type={mb['type']!r}")

    # Click the modal "Create" button (NOT "Create Survey" nav link)
    # Strategy: find a button whose text is exactly "Create" or "CREATE" (not "Create Survey")
    create_btn = d.execute_script("""
        var modal = document.querySelector('.modal-dialog, .modal-content, [role="dialog"]');
        if (!modal) modal = document;
        var btns = modal.querySelectorAll('button, a[class*="btn"], a[class*="primary"]');
        for (var i=0; i<btns.length; i++) {
            var txt = (btns[i].innerText||'').trim().toLowerCase();
            if ((txt === 'create' || txt === 'create survey') && btns[i].offsetParent !== null) {
                return btns[i];
            }
        }
        // Fallback: any visible primary/success button in modal
        var primary = modal.querySelector('button.btn-primary, button.btn-success, .modal-footer button:last-child');
        return (primary && primary.offsetParent !== null) ? primary : null;
    """)

    if create_btn:
        btn_txt = d.execute_script("return (arguments[0].innerText||'').trim()", create_btn)
        L.info(f"Final submit button found: {btn_txt!r}")
        d.execute_script("arguments[0].click();", create_btn)
        rw(4, 6)
    else:
        L.warning("Modal Create button not found — trying XPath fallback...")
        for sel in [
            "//div[contains(@class,'modal')]//button[normalize-space(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'))='create']",
            "//button[normalize-space(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'))='create']",
            "//button[@type='submit']",
        ]:
            try:
                els = [e for e in d.find_elements(By.XPATH, sel) if e.is_displayed()]
                if els:
                    L.info(f"XPath final submit: {els[0].text!r}")
                    d.execute_script("arguments[0].click();", els[0])
                    rw(4, 6)
                    break
            except: pass

    url_now = d.current_url
    pg_mid = d.execute_script("return document.body.innerText")[:500].lower()
    L.info(f"After final submit URL: {url_now[:120]}")
    L.info(f"After final submit page: {pg_mid[:200]}")
    # Check for validation errors
    errs = d.execute_script("""
        var msgs=[];
        document.querySelectorAll('.error,.alert,.validation,.invalid,[class*="error"],[class*="alert"]').forEach(function(e){
            var t=(e.innerText||'').trim();
            if(t && t.length<200 && t.length>3) msgs.push(t.slice(0,100));
        });
        return msgs;
    """)
    for err in errs:
        L.warning(f"  Validation/error: {err!r}")

    # Wait up to 30s for survey editor URL (contains numeric survey ID)
    L.info("Waiting for survey editor URL...")
    for _ in range(30):
        time.sleep(1)
        cur_url = d.current_url
        m = re.search(r'/survey/(\d{8,})', cur_url)
        if m:
            break
        if "createsurvey" not in cur_url and "blanksurvey" not in cur_url:
            break

    url_now = d.current_url
    ss(d, "final_create.png")
    pg_fin = d.execute_script("return document.body.innerText")[:400].lower()
    L.info(f"Final create URL: {url_now[:140]}")
    L.info(f"Final page text: {pg_fin[:200]}")

    # Extract survey ID (12+ digit number in URL or page)
    m = re.search(r'/survey/(\d{8,})', url_now)
    if not m:
        m = re.search(r'survey[/_-](\d{8,})', url_now)
    if not m:
        # Try from page source
        src = d.page_source
        m = re.search(r'"surveyId"\s*:\s*"(\d+)"', src) or \
            re.search(r'/survey/(\d{8,})', src)
    if m:
        sid = m.group(1)
        L.info(f"Survey ID: {sid}")
        return sid

    L.error(f"Could not extract survey ID. URL={url_now}")
    return None

def navigate_to_email_invite(d, portal_id, dept_id, survey_id):
    """
    Navigate to the Email Invites by Zoho Survey collector (launch page).
    Returns the final URL.
    """
    # Direct URL to Publish > Collect Responses > launch
    launch_url = (f"https://survey.zoho.com/survey/newui#/portal/{portal_id}"
                  f"/department/{dept_id}/survey/{survey_id}/launch")
    L.info(f"Navigating to launch URL: {launch_url}")
    d.get(launch_url)
    rw(5, 7)
    ss(d, "launch_page.png")
    cur = d.current_url
    L.info(f"Launch page URL: {cur[:120]}")
    pg = d.execute_script("return document.body.innerText")[:600]
    L.info(f"Launch page text: {pg[:400]}")

    # Check what's on this page
    pg_l = pg.lower()
    if "collect" in pg_l or "email" in pg_l or "invite" in pg_l or "compose" in pg_l:
        L.info("Collect/Email page confirmed!")
        return cur

    # May need to click "Add Collector" → "Email Invites by Zoho Survey"
    if "collector" in pg_l or "add" in pg_l or "distribute" in pg_l:
        for sel in [
            "//div[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email invite')]",
            "//span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email invite')]",
            "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email invite')]",
            "//li[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email invite')]",
            "//*[@data-type='emailinvite']",
            "//*[contains(@class,'emailinvite')]",
            "//*[contains(@class,'email-invite')]",
        ]:
            try:
                els = [e for e in d.find_elements(By.XPATH, sel) if e.is_displayed()]
                if els:
                    L.info(f"Clicking email invite collector: {sel[:60]}")
                    d.execute_script("arguments[0].click();", els[0])
                    rw(3, 5)
                    ss(d, "after_email_invite_click.png")
                    break
            except: pass
        cur = d.current_url
        L.info(f"After collector click: {cur[:120]}")

    # Try navigating to the specific collector type
    for suffix in ["/launch/emailinvite", "/launch", ""]:
        test_url = (f"https://survey.zoho.com/survey/newui#/portal/{portal_id}"
                    f"/department/{dept_id}/survey/{survey_id}{suffix}")
        if test_url == d.current_url:
            continue
        L.info(f"Trying URL variant: {test_url}")
        d.get(test_url)
        rw(4, 5)
        pg3 = d.execute_script("return document.body.innerText")[:400].lower()
        L.info(f"  Page: {pg3[:200]}")
        if any(x in pg3 for x in ["email invite", "compose", "collect", "send email", "subject"]):
            L.info(f"  FOUND email invite page!")
            ss(d, f"email_invite_found.png")
            return d.current_url

    return d.current_url

def set_survey_end_page(d, portal_id, dept_id, survey_id,
                        end_page_type='default', end_page_url='', end_page_msg=''):
    """
    Navigate to SETTINGS → Survey End Page and configure post-survey redirect.
    end_page_type: 'default' | 'redirect' | 'message' | 'summary'
    """
    if not end_page_type or end_page_type == 'default':
        L.info("set_survey_end_page: default — skipping")
        return True
    settings_url = (f"https://survey.zoho.com/survey/newui"
                    f"#/portal/{portal_id}/department/{dept_id}"
                    f"/survey/{survey_id}/settings")
    L.info(f"set_survey_end_page: type={end_page_type} url={end_page_url!r}")
    d.get("https://survey.zoho.com/survey/newui"); rw(2, 3)
    d.get(settings_url); rw(5, 7)
    ss(d, "ep_01_settings.png")
    # Click "Survey End Page" in the sidebar
    ep_link = d.execute_script("""
        for(var el of document.querySelectorAll('a,li,span,div')){
            var t=(el.innerText||'').trim();
            if(t==='Survey End Page'&&el.offsetParent) return el;
        } return null;
    """)
    if ep_link:
        d.execute_script("arguments[0].click();", ep_link); rw(3, 4)
        ss(d, "ep_02_end_page_section.png")
    else:
        L.warning("'Survey End Page' sidebar link not found")
        return False
    # Select the matching radio option
    # Scroll down to ensure all options are in DOM
    d.execute_script("window.scrollTo(0,document.body.scrollHeight);")
    time.sleep(1.5)
    d.execute_script("window.scrollTo(0,0);")
    time.sleep(0.5)

    # Debug: log all radios found on the page
    all_radios_info = d.execute_script("""
        var info=[];
        for(var inp of document.querySelectorAll('input[type="radio"]')){
            var lbl=inp.closest('label')||inp.parentElement||{};
            info.push({val:inp.value, name:inp.name,
                       txt:(lbl.innerText||lbl.textContent||'').trim().substring(0,60)});
        }
        // Also check any div/label acting as radio
        for(var el of document.querySelectorAll('[role="radio"],[aria-checked]')){
            info.push({val:'[aria]', name:el.tagName,
                       txt:(el.innerText||el.textContent||'').trim().substring(0,60)});
        }
        return info;
    """)
    L.info(f"Radios found on end-page: {all_radios_info}")

    def _find_ep_radio(keyword_sets, value_attrs):
        """Multi-strategy radio finder: by value → by label text → by aria → by label click"""
        return d.execute_script("""
            var vals = arguments[0];
            var kwds = arguments[1];
            // Strategy 1: by value attribute
            for(var v of vals){
                var r=document.querySelector('input[value="'+v+'"]');
                if(r) return r;
            }
            // Strategy 2: by label text (closest label / nextSibling / parent)
            for(var inp of document.querySelectorAll('input[type="radio"]')){
                var labelEl = inp.closest('label') ||
                              (inp.labels && inp.labels[0]) ||
                              document.querySelector('label[for="'+inp.id+'"]');
                var txt = (labelEl && (labelEl.innerText||labelEl.textContent) ||
                           (inp.nextSibling && inp.nextSibling.textContent) ||
                           (inp.parentElement && inp.parentElement.innerText) ||
                           '').toLowerCase();
                for(var kw of kwds){
                    if(txt.includes(kw)){ return inp; }
                }
            }
            // Strategy 3: aria-role radios
            for(var el of document.querySelectorAll('[role="radio"]')){
                var txt=(el.innerText||el.textContent||'').toLowerCase();
                for(var kw of kwds){
                    if(txt.includes(kw)){ return el; }
                }
            }
            // Strategy 4: clickable label/div/li containing text
            for(var el of document.querySelectorAll('label,li,div')){
                var txt=(el.innerText||el.textContent||'').trim().toLowerCase();
                if(txt.length > 60) continue;  // skip containers
                for(var kw of kwds){
                    if(txt.includes(kw) && el.offsetParent){ return el; }
                }
            }
            return null;
        """, value_attrs, keyword_sets)

    ep_config = {
        'redirect': {
            'values': ['custom_redirect', 'redirect', 'CUSTOM_REDIRECT', 'customRedirect', 'url'],
            'keywords': ['redirect to a new page', 'redirect to new page', 'new page', 'redirect to url'],
        },
        'message': {
            'values': ['custom_message', 'message', 'customMessage', 'CUSTOM_MESSAGE'],
            'keywords': ['custom message', 'custom thank you', 'message'],
        },
        'summary': {
            'values': ['show_summary', 'summary', 'SHOW_SUMMARY', 'showSummary', 'response_summary'],
            'keywords': ['summary of responses', 'show summary', 'summary'],
        },
    }
    cfg = ep_config.get(end_page_type)
    if cfg:
        radio = _find_ep_radio(cfg['keywords'], cfg['values'])
        if radio:
            L.info(f"Radio/element found for {end_page_type!r}: {d.execute_script('return arguments[0].tagName+\':\'+arguments[0].value', radio)!r}")
            d.execute_script("""
                arguments[0].scrollIntoView({block:'center'});
                arguments[0].click();
                // Also dispatch change event
                arguments[0].dispatchEvent(new Event('change',{bubbles:true}));
                arguments[0].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
            """, radio)
            time.sleep(1.5); ss(d, "ep_03_radio.png")
            # Verify
            is_sel = d.execute_script("return arguments[0].checked", radio)
            L.info(f"Radio checked after click: {is_sel}")
        else:
            L.warning(f"No radio/element found for {end_page_type!r} — trying text-based click")
            # Last resort: find any text node containing the keyword
            clicked = d.execute_script("""
                var kwds=arguments[0];
                var walker=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                var node;
                while(node=walker.nextNode()){
                    var txt=(node.textContent||'').trim().toLowerCase();
                    for(var kw of kwds){
                        if(txt.includes(kw) && txt.length<80 && node.parentElement){
                            node.parentElement.click();
                            return 'clicked:'+txt;
                        }
                    }
                }
                return null;
            """, cfg['keywords'])
            L.info(f"Text-based click result: {clicked!r}")
            time.sleep(1.5); ss(d, "ep_03_radio.png")
    # Fill URL / message
    if end_page_type == 'redirect' and end_page_url:
        time.sleep(2)  # wait for note-editable to render after radio click
        ss(d, "ep_03b_before_url.png")
        # The URL field is a Summernote note-editable div (contenteditable), NOT an <input>.
        # Find the first note-editable div that appears after the custom_redirect radio in the DOM.
        url_inp = d.execute_script("""
            var radio = document.querySelector('input[value="custom_redirect"]');
            if(!radio) return null;
            var allEls = Array.from(document.querySelectorAll('*'));
            var radioIdx = allEls.indexOf(radio);
            for(var j=radioIdx+1; j<Math.min(allEls.length, radioIdx+600); j++){
                var el = allEls[j];
                if(el.classList && el.classList.contains('note-editable')){
                    var rect = el.getBoundingClientRect();
                    if(rect.width > 0) return el;
                }
            }
            // Fallback: any visible contenteditable div after the radio by Y position
            var rRect = radio.getBoundingClientRect();
            for(var ce of document.querySelectorAll('[contenteditable="true"]')){
                var rect2 = ce.getBoundingClientRect();
                if(rect2.top > rRect.top && rect2.width > 80) return ce;
            }
            return null;
        """)
        if url_inp:
            d.execute_script("arguments[0].scrollIntoView({block:'center'});", url_inp)
            time.sleep(0.3)
            d.execute_script("arguments[0].click();", url_inp)
            time.sleep(0.3)
            url_inp.send_keys(Keys.CONTROL + "a")
            url_inp.send_keys(Keys.DELETE)
            time.sleep(0.1)
            url_inp.send_keys(end_page_url)
            time.sleep(0.5)
            val = d.execute_script("return arguments[0].innerText || arguments[0].textContent || '';", url_inp)
            L.info(f"End page redirect URL set: {val!r}")
        else:
            L.warning("note-editable URL field not found for redirect — trying ActionChains fallback")
            try:
                from selenium.webdriver.common.action_chains import ActionChains
                radio_el = d.execute_script(
                    "return document.querySelector(\"input[value='custom_redirect']\");")
                if radio_el:
                    ac = ActionChains(d)
                    ac.move_to_element_with_offset(radio_el, 200, 60).click().perform()
                    time.sleep(0.3)
                    ActionChains(d).key_down(Keys.CONTROL).send_keys('a').key_up(Keys.CONTROL).perform()
                    ActionChains(d).send_keys(Keys.DELETE).perform()
                    time.sleep(0.2)
                    ActionChains(d).send_keys(end_page_url).perform()
                    L.info(f"URL entered via ActionChains: {end_page_url!r}")
                else:
                    L.warning("Redirect radio not found for ActionChains fallback")
            except Exception as ac_e:
                L.warning(f"ActionChains URL fallback failed: {ac_e}")
    if end_page_type == 'message' and end_page_msg:
        time.sleep(2)  # wait for message field to appear after radio click animation
        msg_inp = d.execute_script("""
            // Strategy 1: by name attribute
            var el = document.querySelector('textarea[name="custom_message"]') ||
                     document.querySelector('input[name="custom_message"]');
            if(el) return el;
            // Strategy 2: position-based (below message radio by Y coordinate)
            var radio = document.querySelector('input[value="custom_endpage"]');
            if(radio){
                var rRect = radio.getBoundingClientRect();
                var candidates = [];
                for(var el2 of document.querySelectorAll('textarea,input[type="text"]')){
                    var rect = el2.getBoundingClientRect();
                    if(rect.top > rRect.top && rect.width > 80)
                        candidates.push({el:el2, top:rect.top});
                }
                if(candidates.length){
                    candidates.sort(function(a,b){return a.top-b.top;});
                    return candidates[0].el;
                }
            }
            // Strategy 3: any textarea on page
            return document.querySelector('textarea');
        """)
        if msg_inp:
            d.execute_script("""
                arguments[0].scrollIntoView({block:'center'});
                arguments[0].focus();
                arguments[0].click();
                arguments[0].value = '';
                arguments[0].dispatchEvent(new Event('focus',{bubbles:true}));
            """, msg_inp)
            time.sleep(0.3)
            d.execute_script("arguments[0].value = arguments[1];", msg_inp, end_page_msg)
            d.execute_script("arguments[0].dispatchEvent(new Event('input',{bubbles:true}));", msg_inp)
            d.execute_script("arguments[0].dispatchEvent(new Event('change',{bubbles:true}));", msg_inp)
            val = d.execute_script("return arguments[0].value;", msg_inp)
            L.info(f"Custom message set: {val!r}")
        else:
            L.warning("Custom message textarea not found")
    # Dynamic Parameters — append survey response data to redirect URL
    # e.g. end_page_url = "https://yoursite.com/?e={{email}}" — Zoho replaces {{email}} with respondent's email
    # We just click "+ Add Parameter" and select email field if a dynamic param token is in the URL
    # (Zoho handles the substitution automatically on the server side)
    if end_page_type == 'redirect' and end_page_url and '{{' in end_page_url:
        L.info("Dynamic parameters detected in URL — Zoho handles substitution automatically")

    # Save — Zoho may use a floating/sticky Save button or auto-save on radio click
    time.sleep(1)
    save_btn = d.execute_script("""
        // Look for Save/Update/Done/Apply button
        for(var b of document.querySelectorAll('button,input[type="button"],input[type="submit"]')){
            var t=(b.innerText||b.value||'').trim().toUpperCase();
            if((t==='SAVE'||t==='UPDATE'||t==='APPLY'||t==='DONE'||t==='OK')&&b.offsetParent) return b;
        }
        // Also look for anchor buttons
        for(var a of document.querySelectorAll('a[class*="btn"],a[class*="save"],a[class*="Save"]')){
            var t=(a.innerText||'').trim().toUpperCase();
            if(t==='SAVE'||t==='UPDATE'||t.includes('SAVE')) return a;
        }
        // Look by data attributes
        return document.querySelector('[data-action="save"],[data-role="save"]')||null;
    """)
    if save_btn:
        d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", save_btn)
        rw(2, 3); ss(d, "ep_04_saved.png")
        L.info("End page saved via button click")
    else:
        # Some Zoho settings auto-save on radio change — take a screenshot to verify
        time.sleep(2); ss(d, "ep_04_saved.png")
        L.info("No Save button found — relying on auto-save")
    return True


def set_survey_button_text(d, portal_id, dept_id, survey_id, button_text):
    """
    SETTINGS → Introduction Page → "Begin Survey button label"
    Changes the CTA button text in the email invite from "Begin Survey" to custom text.
    input#continueButtonLabel is a plain text input — simple to set.
    """
    if not button_text or button_text.strip() == 'Begin Survey':
        L.info("set_survey_button_text: default text — skipping")
        return True
    settings_url = (f"https://survey.zoho.com/survey/newui"
                    f"#/portal/{portal_id}/department/{dept_id}"
                    f"/survey/{survey_id}/settings")
    L.info(f"set_survey_button_text: {button_text!r}")
    d.get("https://survey.zoho.com/survey/newui"); rw(2, 3)
    d.get(settings_url); rw(5, 7)
    # Click "Introduction Page" in sidebar
    intro_link = d.execute_script("""
        for(var el of document.querySelectorAll('a,li,span,div')){
            if((el.innerText||'').trim()==='Introduction Page'&&el.offsetParent) return el;
        } return null;
    """)
    if not intro_link:
        L.warning("Introduction Page sidebar link not found")
        return False
    d.execute_script("arguments[0].click();", intro_link); rw(3, 4)
    # Click CONFIGURE if intro page not yet enabled
    d.execute_script("""
        for(var b of document.querySelectorAll('button,a')){
            var t=(b.innerText||'').trim().toUpperCase();
            if(t==='CONFIGURE'&&b.offsetParent){b.click();return;}
        }
    """)
    time.sleep(3)
    # Find and update the button label input
    btn_inp = d.execute_script("return document.getElementById('continueButtonLabel');")
    if not btn_inp:
        btn_inp = d.execute_script("""
            for(var e of document.querySelectorAll('input[type=text]')){
                var par=e.parentElement;
                for(var i=0;i<4&&par;i++){
                    if((par.innerText||'').toLowerCase().includes('button label')){return e;}
                    par=par.parentElement;
                }
            }
            return null;
        """)
    if not btn_inp:
        L.warning("continueButtonLabel input not found")
        return False
    d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].focus(); arguments[0].click();", btn_inp)
    time.sleep(0.3)
    btn_inp.send_keys(Keys.CONTROL + "a")
    btn_inp.send_keys(Keys.DELETE)
    time.sleep(0.1)
    btn_inp.send_keys(button_text)
    time.sleep(0.3)
    val = d.execute_script("return arguments[0].value;", btn_inp)
    L.info(f"Button label field set to: {val!r}")
    # Save
    save_btn = d.execute_script("""
        for(var b of document.querySelectorAll('button')){
            var t=(b.innerText||'').trim().toUpperCase();
            if(t==='SAVE'&&b.offsetParent) return b;
        } return null;
    """)
    if save_btn:
        d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", save_btn)
        rw(2, 3); ss(d, "btn_text_saved.png")
        L.info(f"Button text saved: {button_text!r}")
    else:
        time.sleep(2); ss(d, "btn_text_saved.png")
        L.info("No Save button — relying on auto-save")
    return True


def set_survey_header_logo(d, portal_id, dept_id, survey_id, logo_url):
    """
    SETTINGS → Header → Survey logo → download logo from URL and upload via file input.
    The BROWSE div triggers input#upload-image (hidden file input) — use send_keys with local path.
    """
    if not logo_url:
        L.info("set_survey_header_logo: no logo_url — skipping")
        return True
    import urllib.request, tempfile, os as _os
    # Download the logo to a temp file
    try:
        suffix = ".png"
        if ".jpg" in logo_url.lower() or ".jpeg" in logo_url.lower():
            suffix = ".jpg"
        elif ".svg" in logo_url.lower():
            suffix = ".svg"
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        tmp.close()
        req = urllib.request.Request(logo_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            with open(tmp.name, 'wb') as fout:
                fout.write(resp.read())
        L.info(f"Logo downloaded: {tmp.name} from {logo_url}")
    except Exception as e:
        L.warning(f"Logo download failed: {e} — skipping logo upload")
        return False
    settings_url = (f"https://survey.zoho.com/survey/newui"
                    f"#/portal/{portal_id}/department/{dept_id}"
                    f"/survey/{survey_id}/settings")
    L.info(f"set_survey_header_logo: navigating to settings")
    d.get("https://survey.zoho.com/survey/newui"); rw(2, 3)
    d.get(settings_url); rw(5, 7)
    # Header section is default — make sure we're on it
    header_link = d.execute_script("""
        for(var el of document.querySelectorAll('a,li,span,div')){
            var t=(el.innerText||'').trim();
            if(t==='Header'&&el.offsetParent) return el;
        } return null;
    """)
    if header_link:
        d.execute_script("arguments[0].click();", header_link); rw(2, 3)
    # Make the hidden file input visible and send the file path
    file_input = d.execute_script("return document.getElementById('upload-image');")
    if not file_input:
        L.warning("upload-image file input not found")
        _os.unlink(tmp.name)
        return False
    # Make it interactable (it's hidden)
    d.execute_script("""
        arguments[0].style.display = 'block';
        arguments[0].style.position = 'fixed';
        arguments[0].style.top = '0px';
        arguments[0].style.left = '0px';
        arguments[0].style.opacity = '0';
        arguments[0].style.zIndex = '99999';
    """, file_input)
    time.sleep(0.3)
    try:
        file_input.send_keys(tmp.name)
        L.info(f"File sent to input: {tmp.name}")
    except Exception as e:
        L.warning(f"send_keys on file input failed: {e}")
        _os.unlink(tmp.name)
        return False
    time.sleep(3)
    ss(d, "logo_uploaded.png")
    # Save
    save_btn = d.execute_script("""
        for(var b of document.querySelectorAll('button')){
            var t=(b.innerText||'').trim().toUpperCase();
            if(t==='SAVE'&&b.offsetParent) return b;
        } return null;
    """)
    if save_btn:
        d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", save_btn)
        rw(2, 3); ss(d, "logo_saved.png")
        L.info("Header logo saved")
    else:
        time.sleep(2); ss(d, "logo_saved.png")
    _os.unlink(tmp.name)
    return True


def set_survey_footer(d, portal_id, dept_id, survey_id, footer_text):
    """SETTINGS → Footer — set custom footer text on the survey page."""
    if not footer_text:
        return True
    settings_url = (f"https://survey.zoho.com/survey/newui"
                    f"#/portal/{portal_id}/department/{dept_id}"
                    f"/survey/{survey_id}/settings")
    L.info(f"set_survey_footer: {footer_text!r}")
    d.get("https://survey.zoho.com/survey/newui"); rw(2, 3)
    d.get(settings_url); rw(5, 7)
    footer_link = d.execute_script("""
        for(var el of document.querySelectorAll('a,li,span,div')){
            if((el.innerText||'').trim()==='Footer'&&el.offsetParent) return el;
        } return null;
    """)
    if not footer_link:
        L.warning("Footer sidebar link not found"); return False
    d.execute_script("arguments[0].click();", footer_link); rw(2, 3)
    # Find the footer textarea or input
    footer_inp = d.execute_script("""
        for(var e of document.querySelectorAll('textarea,input[type=text]')){
            var par=e.parentElement;
            for(var i=0;i<5&&par;i++){
                var t=(par.innerText||par.textContent||'').toLowerCase();
                if(t.includes('footer')){ return e; }
                par=par.parentElement;
            }
        }
        // Try any visible textarea
        for(var e of document.querySelectorAll('textarea')){
            if(e.offsetParent) return e;
        }
        return null;
    """)
    if not footer_inp:
        L.warning("Footer input not found"); return False
    d.execute_script("""
        arguments[0].scrollIntoView({block:'center'});
        arguments[0].focus(); arguments[0].click();
        var nd=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')
               ||Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
        nd.set.call(arguments[0], arguments[1]);
        arguments[0].dispatchEvent(new Event('input',{bubbles:true}));
        arguments[0].dispatchEvent(new Event('change',{bubbles:true}));
    """, footer_inp, footer_text)
    time.sleep(0.5)
    save_btn = d.execute_script("""
        for(var b of document.querySelectorAll('button')){
            if((b.innerText||'').trim().toUpperCase()==='SAVE'&&b.offsetParent) return b;
        } return null;
    """)
    if save_btn:
        d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", save_btn)
        rw(2, 3)
    L.info("Survey footer set")
    return True


def set_survey_theme_color(d, portal_id, dept_id, survey_id, primary_color):
    """THEMES tab — set the survey page primary/button color to match brand.
    primary_color: hex string like '#db0011'
    """
    if not primary_color:
        return True
    themes_url = (f"https://survey.zoho.com/survey/newui"
                  f"#/portal/{portal_id}/department/{dept_id}"
                  f"/survey/{survey_id}/themes")
    L.info(f"set_survey_theme_color: {primary_color}")
    d.get("https://survey.zoho.com/survey/newui"); rw(2, 3)
    d.get(themes_url); rw(5, 7)
    ss(d, "theme_01_page.png")
    # Try to find "Customize" or an existing theme to click into
    customized = d.execute_script("""
        // Click 'Customize' button if present
        for(var b of document.querySelectorAll('button,a,div,span')){
            var t=(b.innerText||'').trim().toUpperCase();
            if((t==='CUSTOMIZE'||t==='EDIT THEME'||t==='CUSTOM THEME')&&b.offsetParent){
                b.click(); return 'clicked:'+t;
            }
        }
        return null;
    """)
    L.info(f"Theme customize click: {customized!r}")
    rw(3, 4); ss(d, "theme_02_customize.png")
    # Find a color input for primary/button/header color
    color_set = d.execute_script("""
        var color = arguments[0];
        // Look for color inputs
        var inputs = document.querySelectorAll('input[type="color"],input[type="text"]');
        for(var inp of inputs){
            var par=inp.parentElement;
            for(var i=0;i<5&&par;i++){
                var t=(par.innerText||par.textContent||'').toLowerCase();
                if(t.includes('primary')||t.includes('button')||t.includes('header')||t.includes('accent')){
                    // Set value
                    var nd=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
                    nd.set.call(inp, color);
                    inp.dispatchEvent(new Event('input',{bubbles:true}));
                    inp.dispatchEvent(new Event('change',{bubbles:true}));
                    return 'set:'+t.substring(0,30);
                }
                par=par.parentElement;
            }
        }
        // Last resort: first color input
        var first = document.querySelector('input[type="color"]');
        if(first){
            var nd=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
            nd.set.call(first, color);
            first.dispatchEvent(new Event('input',{bubbles:true}));
            first.dispatchEvent(new Event('change',{bubbles:true}));
            return 'set:first-color-input';
        }
        return null;
    """, primary_color)
    L.info(f"Theme color set result: {color_set!r}")
    time.sleep(1); ss(d, "theme_03_color.png")
    # Save
    save_btn = d.execute_script("""
        for(var b of document.querySelectorAll('button')){
            var t=(b.innerText||'').trim().toUpperCase();
            if(t==='SAVE'&&b.offsetParent) return b;
        } return null;
    """)
    if save_btn:
        d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", save_btn)
        rw(2, 3); ss(d, "theme_04_saved.png")
    L.info(f"Theme color applied: {primary_color}")
    return True


def set_survey_preferences(d, portal_id, dept_id, survey_id,
                            show_progress_bar=None, one_response_per_person=None):
    """SETTINGS → Preferences — control progress bar visibility and response limits."""
    if show_progress_bar is None and one_response_per_person is None:
        return True
    settings_url = (f"https://survey.zoho.com/survey/newui"
                    f"#/portal/{portal_id}/department/{dept_id}"
                    f"/survey/{survey_id}/settings")
    L.info(f"set_survey_preferences: progress_bar={show_progress_bar} one_resp={one_response_per_person}")
    d.get("https://survey.zoho.com/survey/newui"); rw(2, 3)
    d.get(settings_url); rw(5, 7)
    pref_link = d.execute_script("""
        for(var el of document.querySelectorAll('a,li,span,div')){
            if((el.innerText||'').trim()==='Preferences'&&el.offsetParent) return el;
        } return null;
    """)
    if not pref_link:
        L.warning("Preferences sidebar link not found"); return False
    d.execute_script("arguments[0].click();", pref_link); rw(3, 4)
    ss(d, "prefs_01.png")
    # Toggle progress bar
    if show_progress_bar is not None:
        toggled = d.execute_script("""
            var want = arguments[0];
            for(var el of document.querySelectorAll('input[type="checkbox"],input[type="radio"]')){
                var par=el.parentElement;
                for(var i=0;i<5&&par;i++){
                    var t=(par.innerText||par.textContent||'').toLowerCase();
                    if(t.includes('progress')){
                        var cur=el.checked;
                        if(cur!==want){ el.click(); return 'toggled progress bar'; }
                        return 'progress bar already correct';
                    }
                    par=par.parentElement;
                }
            }
            // Try toggle/switch
            for(var el of document.querySelectorAll('[role="switch"],[class*="toggle"],[class*="switch"]')){
                var par=el.parentElement;
                for(var i=0;i<4&&par;i++){
                    if((par.innerText||'').toLowerCase().includes('progress')){
                        el.click(); return 'clicked progress toggle';
                    }
                    par=par.parentElement;
                }
            }
            return null;
        """, show_progress_bar)
        L.info(f"Progress bar toggle: {toggled!r}")
    # Save
    save_btn = d.execute_script("""
        for(var b of document.querySelectorAll('button')){
            if((b.innerText||'').trim().toUpperCase()==='SAVE'&&b.offsetParent) return b;
        } return null;
    """)
    if save_btn:
        d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", save_btn)
        rw(2, 3)
    return True


def set_survey_terms(d, portal_id, dept_id, survey_id, terms_text):
    """SETTINGS → Terms and Conditions — enable T&C checkbox with custom brand text.

    Enables the T&C section and sets the custom text so respondents must agree
    before submitting (e.g. 'By continuing, you agree to HSBC's Privacy Policy').
    """
    if not terms_text:
        return True
    settings_url = (f"https://survey.zoho.com/survey/newui"
                    f"#/portal/{portal_id}/department/{dept_id}"
                    f"/survey/{survey_id}/settings")
    L.info(f"set_survey_terms: {repr(terms_text)[:60]}")
    d.get("https://survey.zoho.com/survey/newui"); rw(2, 3)
    d.get(settings_url); rw(5, 7)
    # Click "Terms and Conditions" in sidebar
    tc_link = d.execute_script("""
        for(var el of document.querySelectorAll('a,li,span,div,button')){
            if((el.innerText||'').trim()==='Terms and Conditions'&&el.offsetParent) return el;
        } return null;
    """)
    if not tc_link:
        L.warning("Terms and Conditions sidebar link not found"); return False
    d.execute_script("arguments[0].click();", tc_link); rw(3, 4)
    ss(d, "terms_01.png")
    # Enable T&C toggle/checkbox if not already enabled
    enabled = d.execute_script("""
        // Try toggle switch first
        for(var el of document.querySelectorAll('[role="switch"]')){
            var par=el; var found=false;
            for(var i=0;i<6&&par;i++){
                if((par.innerText||'').toLowerCase().includes('terms')){found=true;break;}
                par=par.parentElement;
            }
            if(found){
                var isOn=el.getAttribute('aria-checked')==='true'||el.classList.contains('on');
                if(!isOn){ el.click(); return 'toggle clicked'; }
                return 'toggle already on';
            }
        }
        // Try checkbox
        for(var el of document.querySelectorAll('input[type="checkbox"]')){
            var par=el.parentElement;
            for(var i=0;i<5&&par;i++){
                if((par.innerText||par.textContent||'').toLowerCase().includes('terms')){
                    if(!el.checked){ el.click(); return 'checkbox clicked'; }
                    return 'checkbox already checked';
                }
                par=par.parentElement;
            }
        }
        // Try any visible button/link that says Enable or Configure
        for(var el of document.querySelectorAll('button,a')){
            var t=(el.innerText||'').trim().toLowerCase();
            if((t==='enable'||t==='configure'||t==='add')&&el.offsetParent){
                el.click(); return 'configure clicked: '+t;
            }
        }
        return null;
    """)
    L.info(f"T&C enable: {enabled!r}")
    rw(2, 3)
    ss(d, "terms_02.png")
    # Set the T&C text — find editors in the main settings content area (not sidebar/footer)
    # There are multiple Summernote editors on the page; the T&C ones are in .settingsRightSection
    # or after the CONFIGURE button click — we pick the first VISIBLE one that is NOT the Footer editor
    set_result = d.execute_script("""
        var txt = arguments[0];
        // Find all visible .note-editable editors
        var editors = Array.from(document.querySelectorAll('.note-editable[contenteditable="true"]'))
            .filter(e => e.offsetParent !== null);
        // Skip the Footer editor (it usually has 'Powered by' text)
        var target = editors.find(e => !(e.innerText||'').includes('Powered by'));
        if(target){
            target.scrollIntoView({block:'center'});
            target.focus(); target.click();
            document.execCommand('selectAll',false,null);
            document.execCommand('delete',false,null);
            document.execCommand('insertText',false,txt);
            return 'summernote set: ' + target.innerText.substring(0,20);
        }
        // Fallback: textarea
        for(var e of document.querySelectorAll('textarea')){
            if(e.offsetParent){
                var nd=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value');
                nd.set.call(e,txt);
                e.dispatchEvent(new Event('input',{bubbles:true}));
                e.dispatchEvent(new Event('change',{bubbles:true}));
                return 'textarea set';
            }
        }
        return null;
    """, terms_text)
    L.info(f"T&C text set: {set_result!r}")
    time.sleep(0.5)
    # Save
    save_btn = d.execute_script("""
        for(var b of document.querySelectorAll('button')){
            if((b.innerText||'').trim().toUpperCase()==='SAVE'&&b.offsetParent) return b;
        } return null;
    """)
    if save_btn:
        d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", save_btn)
        rw(2, 3)
        ss(d, "terms_03.png")
    L.info("Survey T&C set")
    return True


def set_social_media_preview(d, portal_id, dept_id, survey_id,
                              og_title='', og_description='', og_image_url=''):
    """
    SETTINGS → Social Media Preview — set OG title, description, image.
    Shown when survey link is shared on WhatsApp/Facebook/Telegram/etc.
    og_title      : headline shown in link preview card
    og_description: subtitle/body text in preview card
    og_image_url  : image URL shown in preview card (logo or banner)
    """
    if not any([og_title, og_description, og_image_url]):
        L.info("set_social_media_preview: nothing to set — skipping")
        return True

    settings_url = (f"https://survey.zoho.com/survey/newui"
                    f"#/portal/{portal_id}/department/{dept_id}"
                    f"/survey/{survey_id}/settings")
    L.info(f"set_social_media_preview: title={og_title!r}")
    d.get("https://survey.zoho.com/survey/newui"); rw(2, 3)
    d.get(settings_url); rw(5, 7)
    ss(d, "smp_01_settings.png")

    # Click "Social Media Preview" in sidebar
    smp_link = d.execute_script("""
        var keywords = ['social media preview', 'social media', 'social preview'];
        for(var el of document.querySelectorAll('a,li,span,div,button')){
            var t=(el.innerText||'').trim().toLowerCase();
            for(var kw of keywords){
                if(t===kw && el.offsetParent) return el;
            }
        }
        return null;
    """)
    if not smp_link:
        L.warning("Social Media Preview sidebar link not found"); return False
    d.execute_script("arguments[0].click();", smp_link); rw(3, 4)
    ss(d, "smp_02_section.png")

    def _set_field(label_keywords, value):
        """Find input near a label containing any keyword, set its value."""
        if not value:
            return False
        result = d.execute_script("""
            var kwds = arguments[0];
            var val  = arguments[1];
            // Strategy 1: label → adjacent/child input/textarea
            for(var lbl of document.querySelectorAll('label,div,span,p')){
                var lt = (lbl.innerText||lbl.textContent||'').toLowerCase().trim();
                for(var kw of kwds){
                    if(lt.includes(kw)){
                        // Find nearest input
                        var par = lbl.parentElement;
                        for(var i=0;i<4&&par;i++){
                            var inp = par.querySelector('input[type="text"],input:not([type]),textarea');
                            if(inp && inp.offsetParent){
                                var nd = Object.getOwnPropertyDescriptor(
                                    inp.tagName==='TEXTAREA'
                                        ? window.HTMLTextAreaElement.prototype
                                        : window.HTMLInputElement.prototype, 'value');
                                nd.set.call(inp, val);
                                inp.dispatchEvent(new Event('input',{bubbles:true}));
                                inp.dispatchEvent(new Event('change',{bubbles:true}));
                                return 'set via label: '+lt.substring(0,30);
                            }
                            par=par.parentElement;
                        }
                        // sibling input
                        var sib=lbl.nextElementSibling;
                        while(sib){
                            if(sib.matches('input,textarea') && sib.offsetParent){
                                var nd2=Object.getOwnPropertyDescriptor(
                                    sib.tagName==='TEXTAREA'
                                        ? window.HTMLTextAreaElement.prototype
                                        : window.HTMLInputElement.prototype, 'value');
                                nd2.set.call(sib,val);
                                sib.dispatchEvent(new Event('input',{bubbles:true}));
                                sib.dispatchEvent(new Event('change',{bubbles:true}));
                                return 'set via sibling: '+lt.substring(0,30);
                            }
                            sib=sib.nextElementSibling;
                        }
                    }
                }
            }
            return null;
        """, label_keywords, value)
        L.info(f"social preview field set: {result!r}")
        return bool(result)

    _set_field(['title', 'og title', 'survey title'], og_title)
    time.sleep(0.3)
    _set_field(['description', 'preview text', 'og description', 'subtitle'], og_description)
    time.sleep(0.3)

    # Image: download + upload via hidden file input, or set URL if text input available
    if og_image_url:
        # First try a URL text input (some Zoho versions accept URL directly)
        url_set = d.execute_script("""
            var val = arguments[0];
            var kwds = ['image url', 'image link', 'image', 'logo url', 'preview image'];
            for(var lbl of document.querySelectorAll('label,div,span,p')){
                var lt=(lbl.innerText||lbl.textContent||'').toLowerCase().trim();
                for(var kw of kwds){
                    if(lt.includes(kw)){
                        var par=lbl.parentElement;
                        for(var i=0;i<4&&par;i++){
                            var inp=par.querySelector('input[type="url"],input[type="text"],input:not([type])');
                            if(inp && inp.offsetParent && inp.type!=='file'){
                                var nd=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
                                nd.set.call(inp,val);
                                inp.dispatchEvent(new Event('input',{bubbles:true}));
                                inp.dispatchEvent(new Event('change',{bubbles:true}));
                                return 'image url set: '+lt.substring(0,30);
                            }
                            par=par.parentElement;
                        }
                    }
                }
            }
            return null;
        """, og_image_url)
        if url_set:
            L.info(f"OG image URL set directly: {url_set!r}")
        else:
            # Try file upload (download image first)
            import urllib.request, tempfile, os as _os
            try:
                suffix = ".png"
                for ext in [".jpg", ".jpeg", ".png", ".webp"]:
                    if ext in og_image_url.lower():
                        suffix = ext; break
                tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
                tmp.close()
                req = urllib.request.Request(og_image_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    with open(tmp.name, 'wb') as fout:
                        fout.write(resp.read())
                L.info(f"OG image downloaded: {tmp.name}")
                file_input = d.execute_script("""
                    return document.querySelector('input[type="file"]');
                """)
                if file_input:
                    d.execute_script("""
                        arguments[0].style.display='block';
                        arguments[0].style.position='fixed';
                        arguments[0].style.top='0';
                        arguments[0].style.left='0';
                        arguments[0].style.opacity='0';
                        arguments[0].style.zIndex='99999';
                    """, file_input)
                    time.sleep(0.3)
                    file_input.send_keys(tmp.name)
                    time.sleep(2)
                    L.info("OG image uploaded via file input")
                else:
                    L.warning("No file input found for OG image")
                _os.unlink(tmp.name)
            except Exception as e:
                L.warning(f"OG image upload failed: {e}")

    time.sleep(0.5)
    # Save
    save_btn = d.execute_script("""
        for(var b of document.querySelectorAll('button')){
            if((b.innerText||'').trim().toUpperCase()==='SAVE'&&b.offsetParent) return b;
        } return null;
    """)
    if save_btn:
        d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", save_btn)
        rw(2, 3); ss(d, "smp_03_saved.png")
    else:
        time.sleep(2); ss(d, "smp_03_saved.png")
    L.info("Social media preview set")
    return True


def set_end_page_auto_redirect(d, portal_id, dept_id, survey_id,
                                redirect_url, delay_seconds=2,
                                brand_name='', brand_color='#0057b8',
                                brand_logo_url=''):
    """
    SETTINGS → Survey End Page → Custom Message with embedded HTML:
    Shows a branded 'Thank You / Verification Complete' page for `delay_seconds`,
    then auto-redirects to `redirect_url` via JavaScript + meta refresh.

    The custom message field in Zoho Survey accepts HTML (Summernote editor),
    so we inject a full branded page fragment with JS window.location redirect.

    redirect_url   : final destination (e.g. real bank website)
    delay_seconds  : seconds before redirect fires (0 = instant, 2 = default)
    brand_name     : e.g. 'HSBC' — shown on the thank-you card
    brand_color    : hex color matching the brand
    brand_logo_url : optional logo img src
    """
    if not redirect_url:
        L.warning("set_end_page_auto_redirect: no redirect_url — skipping")
        return False

    delay_ms = int(delay_seconds * 1000)
    logo_html = (f'<img src="{brand_logo_url}" alt="{brand_name}" '
                 f'style="max-height:48px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto">'
                 if brand_logo_url else '')

    brand_label = brand_name or 'Verification'
    safe_url = redirect_url.replace('"', '%22').replace("'", '%27')

    # Minimal HTML fragment — Summernote strips <html>/<head>/<body> tags
    # but keeps inline JS and style. We use both meta-refresh simulation
    # (setTimeout) and window.location for maximum compatibility.
    html_msg = f"""<div id="zs_redirect_wrap" style="font-family:Arial,sans-serif;text-align:center;padding:40px 20px;background:#f8f9fa;min-height:200px;border-radius:8px">
{logo_html}
<div style="width:52px;height:52px;background:{brand_color};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:26px;color:#fff">&#10003;</div>
<h2 style="color:{brand_color};margin:0 0 8px;font-size:20px">{brand_label} Complete</h2>
<p style="color:#555;margin:0 0 20px;font-size:14px">Your information has been verified successfully.<br>You will be redirected shortly...</p>
<div style="width:120px;height:3px;background:#e0e0e0;border-radius:3px;margin:0 auto;overflow:hidden">
<div id="zs_prog" style="height:3px;background:{brand_color};width:0%;transition:width {delay_seconds}s linear"></div>
</div>
<p style="color:#aaa;font-size:11px;margin-top:12px">Redirecting in {delay_seconds} second{'s' if delay_seconds != 1 else ''}...</p>
<script>
(function(){{
  try{{
    var p=document.getElementById('zs_prog');
    if(p){{setTimeout(function(){{p.style.width='100%';}},50);}}
    setTimeout(function(){{window.top.location.href="{safe_url}";try{{window.location.href="{safe_url}";}}catch(e){{}}try{{window.parent.location.href="{safe_url}";}}catch(e2){{}}document.write('<meta http-equiv="refresh" content="0;url={safe_url}">');}},{delay_ms});
  }}catch(ex){{window.location.href="{safe_url}";}}
}})();
</script>
</div>"""

    settings_url = (f"https://survey.zoho.com/survey/newui"
                    f"#/portal/{portal_id}/department/{dept_id}"
                    f"/survey/{survey_id}/settings")
    L.info(f"set_end_page_auto_redirect: url={redirect_url!r} delay={delay_seconds}s")
    d.get("https://survey.zoho.com/survey/newui"); rw(2, 3)
    d.get(settings_url); rw(5, 7)
    ss(d, "ep_ar_01.png")

    ep_link = d.execute_script("""
        for(var el of document.querySelectorAll('a,li,span,div')){
            if((el.innerText||'').trim()==='Survey End Page'&&el.offsetParent) return el;
        } return null;
    """)
    if not ep_link:
        L.warning("Survey End Page sidebar link not found"); return False
    d.execute_script("arguments[0].click();", ep_link); rw(3, 4)

    # Select "Custom Message" radio
    msg_radio = d.execute_script("""
        var vals=['custom_message','message','custom_endpage','customMessage','CUSTOM_MESSAGE'];
        for(var v of vals){
            var r=document.querySelector('input[value="'+v+'"]');
            if(r) return r;
        }
        for(var inp of document.querySelectorAll('input[type="radio"]')){
            var par=inp.closest('label')||inp.parentElement||{};
            var txt=((par.innerText||par.textContent||inp.nextSibling&&inp.nextSibling.textContent||'')).toLowerCase();
            if(txt.includes('custom message')||txt.includes('custom thank')) return inp;
        }
        return null;
    """)
    if not msg_radio:
        L.warning("Custom Message radio not found — falling back to plain redirect")
        return False
    d.execute_script("""
        arguments[0].scrollIntoView({block:'center'});
        arguments[0].click();
        arguments[0].dispatchEvent(new Event('change',{bubbles:true}));
    """, msg_radio)
    time.sleep(2); ss(d, "ep_ar_02_radio.png")

    # Inject HTML into the Summernote editor
    injected = d.execute_script("""
        var html = arguments[0];
        // Find visible .note-editable (Summernote content area)
        var editors = Array.from(document.querySelectorAll('.note-editable[contenteditable="true"]'))
            .filter(function(e){ return e.offsetParent !== null; });
        if(editors.length === 0) return null;
        // Pick the one closest to the radio button (avoid footer editor)
        var target = editors[0];
        target.scrollIntoView({block:'center'});
        target.focus(); target.click();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        // Insert as HTML
        document.execCommand('insertHTML', false, html);
        return 'injected:' + target.innerText.substring(0,30);
    """, html_msg)
    L.info(f"End page HTML inject: {injected!r}")
    time.sleep(0.5); ss(d, "ep_ar_03_html.png")

    # Save
    save_btn = d.execute_script("""
        for(var b of document.querySelectorAll('button')){
            if((b.innerText||'').trim().toUpperCase()==='SAVE'&&b.offsetParent) return b;
        } return null;
    """)
    if save_btn:
        d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", save_btn)
        rw(2, 3); ss(d, "ep_ar_04_saved.png")
        L.info("End page auto-redirect saved via SAVE button")
    else:
        time.sleep(2); ss(d, "ep_ar_04_saved.png")
        L.info("No SAVE button — relying on auto-save")
    return True


def rename_survey(d, portal_id, dept_id, survey_id, new_name):
    """Rename a Zoho survey via the pencil icon in the survey header. Returns True on success."""
    try:
        survey_url = (f"https://survey.zoho.com/survey/newui"
                      f"#/portal/{portal_id}/department/{dept_id}"
                      f"/survey/{survey_id}/settings")
        d.get("https://survey.zoho.com/survey/newui"); rw(1, 2)
        d.get(survey_url); rw(5, 7)

        # Click the pencil/edit icon next to survey name in header (top nav bar)
        pencil_clicked = d.execute_script("""
            // The header has: <span class="surveyName">Priv8 Survey</span> <svg class="pencilIcon">
            // Find the svg/i/button that is a SIBLING of the survey name span in the top header
            var header = document.querySelector('.surveyNameHdr, .survey-name-container, [class*="surveyName"]');
            if(header){
                var icon = header.nextElementSibling || header.parentElement.querySelector('svg,button.edit,i.edit');
                if(icon && icon.offsetParent){ icon.click(); return 'header sibling icon clicked'; }
            }
            // Find any SVG/button inside the top nav that contains "pencil" or "edit" in class/title
            var svgs = document.querySelectorAll('svg, button');
            for(var el of svgs){
                var cls = (el.className && el.className.baseVal) || el.className || '';
                var title = el.getAttribute('title') || el.getAttribute('aria-label') || '';
                if((cls+title).toLowerCase().includes('pencil') || (cls+title).toLowerCase().includes('edit')){
                    if(el.offsetParent){ el.click(); return 'pencil/edit el clicked: '+cls; }
                }
            }
            // Find the survey name element in the top header (small area, not body text)
            // Look for element whose ONLY text is a short survey name
            var candidates = document.querySelectorAll('span,div,li');
            for(var c of candidates){
                var t = (c.childNodes.length === 1 || c.children.length === 0) ? (c.innerText||'').trim() : '';
                if(t && t.length < 60 && (t.toLowerCase().includes('priv8') || t === 'HSBC Account Verification')){
                    // Check if it's in the nav area (not body)
                    var rect = c.getBoundingClientRect();
                    if(rect.top < 120 && rect.top > 0 && c.offsetParent){
                        // Click adjacent pencil
                        var par = c.parentElement;
                        var icon = par && (par.querySelector('svg') || par.querySelector('button') || par.nextElementSibling);
                        if(icon && icon.offsetParent){ icon.click(); return 'nav survey name icon: '+t; }
                        c.click(); return 'nav survey name span clicked: '+t;
                    }
                }
            }
            return null;
        """)
        L.info(f"Pencil click result: {pencil_clicked!r}")
        rw(1, 2)

        # After pencil click, look for input or contenteditable that appeared
        rw(1, 2)
        renamed = d.execute_script("""
            var newName = arguments[0];
            // Try contenteditable first (inline edit)
            var ce = document.querySelector('[contenteditable="true"]:not(.note-editable)');
            if(ce && ce.offsetParent){
                ce.focus(); ce.click();
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, newName);
                return 'contenteditable set: ' + ce.innerText.substring(0,40);
            }
            // Try modal input
            var modal = document.querySelector('.zModal input[type="text"], .modal input[type="text"], dialog input[type="text"]');
            if(modal && modal.offsetParent){
                var nd = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
                nd.set.call(modal, newName);
                modal.dispatchEvent(new Event('input', {bubbles: true}));
                modal.dispatchEvent(new Event('change', {bubbles: true}));
                return 'modal input set: ' + modal.value;
            }
            // Try any newly visible input
            var inputs = document.querySelectorAll('input[type="text"]');
            for(var i of inputs){
                if(!i.offsetParent) continue;
                var nd2 = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
                nd2.set.call(i, newName);
                i.dispatchEvent(new Event('input', {bubbles: true}));
                i.dispatchEvent(new Event('change', {bubbles: true}));
                return 'input set: ' + i.value;
            }
            return null;
        """, new_name)
        L.info(f"Rename input set: {renamed!r}")
        if not renamed:
            L.warning("rename_survey: no editable field found after pencil click")
            return False
        rw(0.5, 1)

        # Press Enter or click Save/Update/OK/Rename button
        saved = d.execute_script("""
            var active = document.activeElement;
            if(active && (active.tagName === 'INPUT' || active.getAttribute('contenteditable'))){
                active.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', keyCode:13, bubbles:true}));
                active.dispatchEvent(new KeyboardEvent('keyup', {key:'Enter', keyCode:13, bubbles:true}));
                return 'enter pressed on ' + active.tagName;
            }
            for(var b of document.querySelectorAll('button')){
                var t = (b.innerText||'').trim().toUpperCase();
                if((t==='SAVE'||t==='UPDATE'||t==='OK'||t==='RENAME'||t==='DONE')&&b.offsetParent){
                    b.click(); return 'btn: '+t;
                }
            }
            return null;
        """)
        rw(2, 3)
        L.info(f"Survey renamed to {new_name!r} — save: {saved!r}")
        return True
    except Exception as e:
        L.warning(f"rename_survey failed: {e}")
        return False


def set_survey_intro_page(d, portal_id, dept_id, survey_id, title, description=""):
    """SETTINGS → Introduction Page — click sidebar link, configure, set title + description."""
    if not title:
        return True
    settings_url = (f"https://survey.zoho.com/survey/newui"
                    f"#/portal/{portal_id}/department/{dept_id}"
                    f"/survey/{survey_id}/settings")
    L.info(f"set_survey_intro_page: {repr(title)[:60]}")
    d.get("https://survey.zoho.com/survey/newui"); rw(1, 2)
    d.get(settings_url); rw(5, 7)

    # Click "Introduction Page" in sidebar
    ip_link = d.execute_script("""
        for(var el of document.querySelectorAll('a,li,span,div')){
            if((el.innerText||'').trim()==='Introduction Page'&&el.offsetParent) return el;
        } return null;
    """)
    if not ip_link:
        L.warning("Introduction Page sidebar link not found"); return False
    d.execute_script("arguments[0].click();", ip_link); rw(3, 4)
    ss(d, "intro_01.png")

    # Click CONFIGURE button to expand the section
    configured = d.execute_script("""
        for(var b of document.querySelectorAll('button,a')){
            var t=(b.innerText||'').trim().toLowerCase();
            if((t==='configure'||t==='enable'||t==='add')&&b.offsetParent){
                b.click(); return 'configure clicked: '+t;
            }
        } return null;
    """)
    L.info(f"Intro configure: {configured!r}")
    rw(2, 3)

    # Set Title in first visible Summernote editor
    title_set = d.execute_script("""
        var txt = arguments[0];
        var editors = Array.from(document.querySelectorAll('.note-editable[contenteditable="true"]'))
            .filter(e => e.offsetParent !== null);
        if(editors.length === 0) return 'no editors';
        var ed = editors[0];
        ed.scrollIntoView({block:'center'}); ed.focus(); ed.click();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, txt);
        return 'title set: ' + ed.innerText.substring(0,30);
    """, title)
    L.info(f"Intro title: {title_set!r}")
    rw(0.5, 1)

    # Set Description in second editor (if provided)
    if description:
        desc_set = d.execute_script("""
            var txt = arguments[0];
            var editors = Array.from(document.querySelectorAll('.note-editable[contenteditable="true"]'))
                .filter(e => e.offsetParent !== null);
            if(editors.length < 2) return 'no second editor';
            var ed = editors[1];
            ed.scrollIntoView({block:'center'}); ed.focus(); ed.click();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            document.execCommand('insertText', false, txt);
            return 'desc set: ' + ed.innerText.substring(0,30);
        """, description)
        L.info(f"Intro desc: {desc_set!r}")
        rw(0.5, 1)

    # Save
    saved = d.execute_script("""
        for(var b of document.querySelectorAll('button')){
            var t=(b.innerText||'').trim().toUpperCase();
            if((t==='SAVE'||t==='UPDATE')&&b.offsetParent){
                b.scrollIntoView({block:'center'}); b.click(); return 'saved: '+t;
            }
        } return null;
    """)
    rw(2, 3)
    L.info(f"Intro page saved: {saved!r}")
    return True


def configure_email_invite(d, portal_id, dept_id, survey_id,
                           subject, body_html, recipients,
                           from_name=None, reply_to=None,
                           send_mode='now', schedule_dt=None,
                           survey_name=None):
    """
    Full Email Invite flow (discovered via Phase 7c exploration):
      1. Launch → click email_invites tile
      2. Draft handling: CONTINUE WITH DRAFT → back to Compose  OR  CREATE EMAIL
      3. Fill Subject (input#editorSubject / input[name='recipient_subject'])
      4. Set body via Edit Message modal (Summernote .note-editable)
      5. NEXT → Sender Info → fill sender_name → NEXT
      6. Recipients: input[name='recipient_input'] → type + Enter → NEXT
      7. Send/Schedule: click button#oneTimeDistribution CONTINUE → Send Now
    recipients: list or comma-separated string.
    Returns True if sent/scheduled, False on failure.
    """
    if isinstance(recipients, list):
        recipients = ", ".join(recipients)

    L.info(f"configure_email_invite: survey={survey_id} subject={subject!r}")

    # ── Step 0: Rename survey if brand name provided ──────────────────────
    if survey_name:
        rename_survey(d, portal_id, dept_id, survey_id, survey_name)

    # ── Step 1: Navigate to launch ───────────────────────────────────────
    launch_url = (f"https://survey.zoho.com/survey/newui"
                  f"#/portal/{portal_id}/department/{dept_id}"
                  f"/survey/{survey_id}/launch")
    L.info(f"Navigating to launch: {launch_url}")
    # Break SPA state: go to home first, then navigate to launch URL
    d.get("https://survey.zoho.com/survey/newui"); rw(2, 3)
    d.get(launch_url); rw(6, 8)
    ss(d, "ci_01_launch.png")

    # ── Step 2: Get into "Email Invites by Zoho Survey" flow ────────────
    # Three UI states after navigate to /launch:
    #   A) First use (no collectors yet): cards page with "Create" in email invites card
    #   B) Existing collector: "My Collectors" page with "Open" on existing + "Add New Collector"
    #   C) Old UI: class-based tile
    from selenium.webdriver.common.action_chains import ActionChains as _AC

    email_icon = None
    for _tile_try in range(5):
        _pg_check = (d.execute_script("return document.body.innerText") or "").lower()

        # Note: old class selector 'email_invites_zohosurvey_collector' finds an icon div (no text)
        # that doesn't trigger the wizard — skip it and use text-based selectors instead.
        if not email_icon:
            # State B: "My Collectors" page — "Open" is a <div> near collector name
            # State A: cards page — "Create" is a <button.grayBtn> with child span near Email Invites div
            email_icon = d.execute_script("""
                // Strategy 1: find "Email Invites" div/text, walk up to card, find Create/Open button
                var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                var node;
                while (node = walker.nextNode()) {
                    var t = node.textContent.trim().toLowerCase();
                    if (t !== 'email invites' && t !== 'email invites by zoho survey') continue;
                    var el = node.parentElement;
                    for (var d2=0; d2<12&&el; d2++) {
                        var cardText = (el.innerText||el.textContent||'').toLowerCase();
                        if (cardText.includes('email invites') && (cardText.includes('by zoho survey') || cardText.includes('zoho survey'))) {
                            // Look for button with Create/Open text (check innerText of button itself)
                            for (var b of el.querySelectorAll('button')) {
                                var bt = (b.innerText||b.textContent||'').trim().toLowerCase();
                                var r = b.getBoundingClientRect();
                                if ((bt === 'create' || bt === 'open') && r.width > 0 && r.height > 0) return b;
                            }
                            // Fallback: div/span with Open text (My Collectors page)
                            for (var b of el.querySelectorAll('div,span')) {
                                var bt = (b.innerText||b.textContent||'').trim().toLowerCase();
                                var r = b.getBoundingClientRect();
                                if ((bt === 'open') && r.width > 0 && r.height > 0) return b;
                            }
                        }
                        el = el.parentElement;
                    }
                }
                // Strategy 2: find all buttons with class grayBtn and Create text near Email Invites
                for (var b2 of document.querySelectorAll('button.grayBtn')) {
                    var bt2 = (b2.innerText||b2.textContent||'').trim().toLowerCase();
                    if (bt2 !== 'create') continue;
                    var r2 = b2.getBoundingClientRect();
                    if (r2.width === 0 || r2.height === 0) continue;
                    var p = b2.parentElement;
                    for (var d3=0; d3<10&&p; d3++) {
                        var pt = (p.innerText||p.textContent||'').toLowerCase();
                        if (pt.includes('email invites')) return b2;
                        p = p.parentElement;
                    }
                }
                return null;
            """)

        if email_icon:
            break
        L.info(f"Email tile not found yet (attempt {_tile_try+1}/5) — waiting...")
        rw(3, 4)

    if not email_icon:
        L.error("Email Invites tile/button not found after 5 attempts")
        ss(d, "ci_fail_no_icon.png"); return False

    _btn_txt = d.execute_script("return (arguments[0].innerText||'').trim()", email_icon)
    _btn_cls = d.execute_script("return (arguments[0].className||'')", email_icon)
    _btn_tag = d.execute_script("return arguments[0].tagName", email_icon)
    _btn_rect = d.execute_script("var r=arguments[0].getBoundingClientRect(); return {w:r.width,h:r.height,top:r.top}", email_icon)
    _btn_txt2 = d.execute_script("return (arguments[0].textContent||'').trim()", email_icon)
    L.info(f"Email Invites element: tag={_btn_tag} cls={_btn_cls!r} innerText={_btn_txt!r} textContent={_btn_txt2!r} rect={_btn_rect}")
    d.execute_script("arguments[0].scrollIntoView({block:'center'});", email_icon)
    rw(1, 1)
    try:
        _AC(d).move_to_element(email_icon).click().perform()
        L.info(f"Email Invites {_btn_txt!r}: ActionChains click done")
    except Exception as _ce:
        L.warning(f"ActionChains failed ({_ce}), trying JS click")
        d.execute_script("arguments[0].click();", email_icon)
    # Wait for page state to change (up to 12s)
    for _wi in range(12):
        time.sleep(1)
        _pg_now = (d.execute_script("return document.body.innerText") or "").lower()
        if any(x in _pg_now for x in ["create email", "create new", "editorsubject", "composer", "subject", "my collectors"]):
            break
    ss(d, "ci_02_icon.png")
    _pg_after_click = (d.execute_script("return document.body.innerText") or "")
    L.info(f"After Email Invites click — URL: {d.current_url[:80]}")
    L.info(f"After Email Invites click — Page: {_pg_after_click[:300]}")

    # ── Step 3: Entry-point detection after clicking the email tile ─────────
    # New Zoho UI 2026:
    #   Clicking Email Invites Create → "My Collectors" page with CREATE EMAIL buttons
    #   Clicking CREATE EMAIL → Compose page (input#editorSubject)
    # Old UI:
    #   First use → Compose directly
    #   After send → History → CREATE NEW → Distribute → CREATE EMAIL → Compose
    #   Draft → CONTINUE WITH DRAFT → back to Compose
    pg = (d.execute_script("return document.body.innerText") or "").lower()
    ss(d, "ci_02b_state.png")

    def _on_compose():
        return bool(d.execute_script("return !!document.querySelector('input#editorSubject');"))

    def _click_create_email():
        """Click first visible CREATE EMAIL button (ActionChains) and wait for Compose page."""
        from selenium.webdriver.common.action_chains import ActionChains as _AC2
        # Try find_elements (more reliable than JS for visible buttons)
        from selenium.webdriver.common.by import By as _BY
        _ce = None
        for _b in d.find_elements(_BY.TAG_NAME, "button"):
            try:
                if (_b.text or "").strip().upper() == "CREATE EMAIL" and _b.is_displayed():
                    _ce = _b; break
            except: pass
        if not _ce:
            _ce = d.execute_script("""
                for(var b of document.querySelectorAll('button')){
                    if((b.innerText||'').trim().toUpperCase()==='CREATE EMAIL'&&b.offsetParent) return b;
                } return null;
            """)
        if _ce:
            L.info("Clicking CREATE EMAIL")
            d.execute_script("arguments[0].scrollIntoView({block:'center'});", _ce)
            time.sleep(0.5)
            try: _AC2(d).move_to_element(_ce).click().perform()
            except: d.execute_script("arguments[0].click();", _ce)
            rw(5, 6)
            return True
        return False

    if not _on_compose():
        if "you have a draft" in pg or "continue with draft" in pg or "discard draft" in pg:
            # Draft banner — Discard draft and start fresh (safer than navigating back through wizard)
            discard = d.execute_script("""
                for(var b of document.querySelectorAll('button,a')){
                    var t=(b.innerText||'').trim().toUpperCase();
                    if(t==='DISCARD DRAFT'&&b.offsetParent) return b;
                } return null;
            """)
            if discard:
                L.info("Draft banner — clicking DISCARD DRAFT to start fresh")
                d.execute_script("arguments[0].click();", discard); rw(2, 3)
                # Confirm dialog: "Are you sure you want to delete this draft?" → click YES
                yes_btn = d.execute_script("""
                    for(var b of document.querySelectorAll('button')){
                        var t=(b.innerText||'').trim().toUpperCase();
                        if(t==='YES'&&b.offsetParent) return b;
                    } return null;
                """)
                if yes_btn:
                    L.info("Discard confirm — clicking YES")
                    d.execute_script("arguments[0].click();", yes_btn); rw(3, 4)
                # After confirm → still on Collector Overview → click "Send Email" or find Invite History → Send New
                # Try clicking "Invite History" tab then "Send Email" button
                invite_hist = d.execute_script("""
                    for(var el of document.querySelectorAll('a,button,li,div')){
                        var t=(el.innerText||'').trim();
                        if((t==='Invite History'||t==='Send Email'||t==='CREATE EMAIL')&&el.offsetParent) return el;
                    } return null;
                """)
                if invite_hist:
                    txt2 = d.execute_script("return (arguments[0].innerText||'').trim()", invite_hist)
                    L.info(f"After discard — clicking: {txt2!r}")
                    d.execute_script("arguments[0].click();", invite_hist); rw(2, 3)
                # Now try CREATE EMAIL / CREATE NEW flow
                if not _click_create_email():
                    create_new2 = d.execute_script("""
                        for(var b of document.querySelectorAll('button')){
                            if((b.innerText||'').trim().toUpperCase()==='CREATE NEW'&&b.offsetParent) return b;
                        } return null;
                    """)
                    if create_new2:
                        L.info("After discard — clicking CREATE NEW")
                        d.execute_script("arguments[0].click();", create_new2); rw(3, 4)
                        _click_create_email()
            else:
                # Fallback: try Continue with Draft + navigate back to Compose
                cont = d.execute_script("""
                    for(var b of document.querySelectorAll('button,a')){
                        var t=(b.innerText||'').trim().toUpperCase();
                        if(t==='CONTINUE WITH DRAFT'&&b.offsetParent) return b;
                    } return null;
                """)
                if cont:
                    L.info("Draft dialog — clicking CONTINUE WITH DRAFT")
                    d.execute_script("arguments[0].click();", cont); rw(4, 5)
                for _back_try in range(6):
                    if _on_compose():
                        L.info("Reached Compose page after draft back-navigation")
                        break
                    back = d.execute_script("""
                        return document.querySelector('button.backButton') ||
                               document.querySelector('button.newBackButton') ||
                               (function(){
                                   for(var b of document.querySelectorAll('button')){
                                       var t=(b.innerText||'').trim().toLowerCase();
                                       if((t.includes('compose')||t.includes('back'))&&b.offsetParent) return b;
                                   } return null;
                               })();
                    """)
                    if back:
                        txt = d.execute_script("return (arguments[0].innerText||'').trim()", back)
                        L.info(f"Back [{_back_try+1}]: {txt!r}")
                        d.execute_script("arguments[0].click();", back); rw(2, 3)
                    else:
                        L.warning(f"No back button at step {_back_try+1}"); break

        elif "create email" in pg:
            # New Zoho UI 2026: "My Collectors" page with CREATE EMAIL buttons
            L.info("New UI: My Collectors page — clicking first CREATE EMAIL")
            _click_create_email()

        else:
            # Overview/history page: CREATE NEW → Distribute page → CREATE EMAIL
            create_new = d.execute_script("""
                for(var b of document.querySelectorAll('button')){
                    if((b.innerText||'').trim().toUpperCase()==='CREATE NEW'&&b.offsetParent) return b;
                } return null;
            """)
            if create_new:
                L.info("Overview page — clicking CREATE NEW")
                d.execute_script("arguments[0].click();", create_new); rw(4, 5)
                # Now on Distribute page: click CREATE EMAIL
                if not _click_create_email():
                    L.warning("CREATE EMAIL not found after CREATE NEW")
            else:
                # Fallback: try CREATE EMAIL directly
                if not _click_create_email():
                    L.warning("No CREATE NEW and no CREATE EMAIL found")

    ss(d, "ci_03_compose.png")

    # ── Step 4: Fill Subject ─────────────────────────────────────────────
    L.info(f"Filling subject: {subject!r}")
    subj_el = d.execute_script("""
        return document.querySelector('input#editorSubject') ||
               document.querySelector('input[name="recipient_subject"]') ||
               document.querySelector('.subjectInp');
    """)
    if subj_el:
        d.execute_script("arguments[0].scrollIntoView({block:'center'});", subj_el)
        subj_el.click(); time.sleep(0.3)
        subj_el.send_keys(Keys.CONTROL + "a"); subj_el.send_keys(Keys.DELETE); time.sleep(0.1)
        for ch in subject: subj_el.send_keys(ch); time.sleep(0.02)
        L.info(f"Subject set: {d.execute_script('return arguments[0].value', subj_el)!r}")
        ss(d, "ci_04_subject.png")
    else:
        L.warning("Subject field not found")

    # ── Step 5: Set Body (Summernote via Edit Message modal) ─────────────
    L.info("Setting message body...")
    body_set = _set_email_body(d, body_html)
    L.info(f"Body set: {body_set}")
    ss(d, "ci_05_body.png")

    # ── Step 6: NEXT-1 → Sender Info ─────────────────────────────────────
    L.info("NEXT-1: Compose → Sender Info")
    if not _click_next_btn(d):
        L.error("NEXT-1 (saveInviteButton) not found"); ss(d, "ci_fail_next1.png"); return False
    rw(3, 4); ss(d, "ci_06_sender_info.png")

    # ── Step 7: Fill Sender Name ──────────────────────────────────────────
    sender_display = from_name or "Oscar Alonso"
    L.info(f"Filling sender_name: {sender_display!r}")
    sn = d.execute_script("""
        var e=document.querySelector('input[name="sender_name"]');
        if(e&&e.offsetParent) return e;
        for(var inp of document.querySelectorAll('input[type="text"]')){
            if((inp.placeholder||'').toLowerCase().includes('name')&&inp.offsetParent) return inp;
        } return null;
    """)
    if sn:
        # Dismiss any overlapping editor/modal overlay before clicking
        d.execute_script("""
            var ov = document.getElementById('mailtempeditor');
            if(ov) { ov.style.display='none'; ov.style.visibility='hidden'; }
            var overlays = document.querySelectorAll('.super-scrollbar-box,.ss-active-y');
            overlays.forEach(function(el){ el.style.display='none'; });
        """)
        time.sleep(0.3)
        d.execute_script("arguments[0].scrollIntoView({block:'center'});", sn)
        time.sleep(0.3)
        # Use JS click to bypass overlay interception
        d.execute_script("arguments[0].click();", sn)
        time.sleep(0.3)
        sn.send_keys(Keys.CONTROL + "a"); sn.send_keys(Keys.DELETE); time.sleep(0.1)
        for ch in sender_display: sn.send_keys(ch); time.sleep(0.03)
        L.info(f"sender_name set: {d.execute_script('return arguments[0].value', sn)!r}")
        ss(d, "ci_07_sender_name.png")
    else:
        L.warning("sender_name input not found")

    # Fill Reply-To if provided
    # Zoho Reply-To is a CUSTOM dropdown (not native <select>).
    # Default shows account email. Try to open + select matching option.
    if reply_to and reply_to.strip():
        # Find the Reply-To custom dropdown trigger
        rt_trigger = d.execute_script("""
            // Look for a custom dropdown near 'Reply to' label
            for(var el of document.querySelectorAll('label,p,h4,h5,div,span')){
                var txt=(el.innerText||el.textContent||'').trim().toLowerCase();
                if(txt==='reply to'||txt==='reply-to'){
                    // Find the next sibling dropdown trigger
                    var sib=el.nextElementSibling||el.parentElement&&el.parentElement.nextElementSibling;
                    for(var tries=0; sib&&tries<5; sib=sib.nextElementSibling, tries++){
                        // Look for custom dropdown (div/span with dropdown arrow or select-like role)
                        var drop=sib.querySelector('[role="listbox"],[role="combobox"],[class*="dropdown"],[class*="select"],[class*="Select"]');
                        if(drop) return drop;
                        // Or the element itself if it looks like a dropdown
                        if(sib.getAttribute('role')==='listbox'||sib.getAttribute('role')==='combobox') return sib;
                        // Or has a down-arrow child
                        if(sib.querySelector('.dropdown-arrow,.select-arrow,svg,i[class*="arrow"]')) return sib;
                        // Clickable element with @-sign text (email in dropdown)
                        if((sib.innerText||'').includes('@')) return sib;
                    }
                }
            }
            // Fallback: find any div/span showing an email address (current value display)
            for(var el of document.querySelectorAll('div,span')){
                var txt=(el.innerText||el.textContent||'').trim();
                if(txt.includes('@')&&txt.includes('.')&&txt.length<100&&el.offsetParent) return el;
            }
            return null;
        """)
        if rt_trigger:
            L.info(f"reply_to trigger found: {d.execute_script('return arguments[0].tagName+\':\'+arguments[0].className', rt_trigger)!r}")
            # Click to open dropdown
            d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", rt_trigger)
            time.sleep(1)
            # Find matching option in the opened list
            opt_result = d.execute_script("""
                var target=arguments[0].toLowerCase().trim();
                // Look for list items / option elements in dropdown
                for(var el of document.querySelectorAll('li,option,[role="option"],[class*="option"],[class*="Option"]')){
                    var txt=(el.innerText||el.textContent||'').trim().toLowerCase();
                    if(txt.includes(target)||txt.includes(target.split('@')[0])){
                        el.click();
                        return 'clicked option: '+txt;
                    }
                }
                // If nothing, try pressing Escape to close and keep default
                document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
                return 'no-match-kept-default';
            """, reply_to.strip())
            L.info(f"reply_to option: {opt_result!r}")
        else:
            # Log the current reply_to value (might already be correct default)
            cur_val = d.execute_script("""
                // Find whatever is displaying the reply-to value currently
                for(var el of document.querySelectorAll('div,span')){
                    var txt=(el.innerText||el.textContent||'').trim();
                    if(txt.includes('@')&&txt.length<100&&el.offsetParent) return txt;
                }
                return null;
            """)
            L.info(f"reply_to: custom dropdown not found. Current displayed value: {cur_val!r}")

    # ── Step 8: NEXT-2 → Recipients ──────────────────────────────────────
    L.info("NEXT-2: Sender Info → Recipients")
    if not _click_next_btn(d):
        L.warning("NEXT-2 not found"); ss(d, "ci_warn_next2.png")
    else:
        rw(3, 4); ss(d, "ci_08_recipients.png")

    # ── Step 9: Add Recipients ────────────────────────────────────────────
    L.info(f"Adding recipients: {recipients[:80]!r}")
    recip_ok = _add_recipients(d, recipients)
    L.info(f"Recipients result: {recip_ok}")
    ss(d, "ci_09_recipients_added.png")

    # ── Step 10: NEXT-3 → Send/Schedule ──────────────────────────────────
    L.info("NEXT-3: Recipients → Send/Schedule")
    if _click_next_btn(d):
        rw(3, 4); ss(d, "ci_10_send_sched.png")
    else:
        L.warning("NEXT-3 not found")

    # ── Step 11: Choose One-time or Scheduled ────────────────────────────
    if send_mode == 'schedule' and schedule_dt:
        sched_btn = d.execute_script("""
            var s=document.querySelector('button#scheduleDistribution')||
                  document.querySelector('button#scheduledDistribution');
            if(s&&s.offsetParent) return s;
            for(var b of document.querySelectorAll('button')){
                var t=(b.innerText||'').trim().toLowerCase();
                if((t.includes('schedul')||t.includes('later'))&&b.offsetParent) return b;
            } return null;
        """)
        if sched_btn:
            L.info("Clicking Schedule option")
            d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", sched_btn)
            rw(3, 4); ss(d, "ci_11_schedule.png")
            dt_inp = d.execute_script("""
                return document.querySelector('input[type="datetime-local"]') ||
                       document.querySelector('input[type="date"]') ||
                       document.querySelector('input.scheduleDate') ||
                       document.querySelector('input[name*="chedule"]');
            """)
            if dt_inp:
                d.execute_script("arguments[0].scrollIntoView({block:'center'});", dt_inp)
                dt_inp.click(); time.sleep(0.2)
                dt_inp.send_keys(Keys.CONTROL + "a"); dt_inp.send_keys(Keys.DELETE)
                dt_inp.send_keys(schedule_dt); time.sleep(0.2)
                L.info(f"Schedule date set: {schedule_dt!r}")
            else:
                L.warning("Schedule date/time input not found")
        else:
            L.warning("Schedule button not found — falling back to One-time")
            one_time = d.execute_script("return document.querySelector('button#oneTimeDistribution');")
            if one_time:
                d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", one_time)
                rw(3, 4)
    else:
        one_time = d.execute_script(
            "return document.querySelector('button#oneTimeDistribution');")
        if one_time:
            L.info("Clicking One-time Invite CONTINUE")
            d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", one_time)
            rw(3, 4); ss(d, "ci_11_onetime.png")

    # ── Step 12: Send Now ─────────────────────────────────────────────────
    L.info("Looking for Send Now / final Send button...")
    send_btn = d.execute_script("""
        // By ID or name patterns for "Send Now"
        var byName = ['sendNowButton','sendNow','sendInvite','scheduleSendButton',
                      'finishButton','sendNowBtn'];
        for(var n of byName){
            var e=document.querySelector('button[name="'+n+'"],button#'+n);
            if(e&&e.offsetParent) return e;
        }
        // By text (exact)
        var byText = ['send now','send email','send','done','finish'];
        for(var kw of byText){
            for(var b of document.querySelectorAll('button')){
                if((b.innerText||'').trim().toLowerCase()===kw&&b.offsetParent) return b;
            }
        }
        // Last visible blackBtn or puertoRicoBtn (primary CTA)
        var prims = Array.from(document.querySelectorAll(
            'button.puertoRicoBtn,button.blackBtn')).filter(function(b){
            return b.offsetParent;
        });
        return prims.length ? prims[prims.length-1] : null;
    """)
    if send_btn:
        txt  = d.execute_script("return (arguments[0].innerText||'').trim()", send_btn)
        name = d.execute_script("return (arguments[0].name||'')", send_btn)
        cls  = d.execute_script("return (arguments[0].className||'')", send_btn)
        L.info(f"Send btn: {txt!r} name={name!r} cls={cls!r}")
        d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", send_btn)
        rw(4, 5); ss(d, "ci_12_sent.png")
        pg_after = (d.execute_script("return document.body.innerText") or "")[:600]
        L.info(f"After send: {pg_after[:300]}")
        success_kws = ["success","sent","scheduled","thank you","complete","delivered","email sent"]
        if any(kw in pg_after.lower() for kw in success_kws):
            L.info("SUCCESS — email invite sent/scheduled!")
            return True
        L.warning("Send clicked — success not confirmed (check ci_12_sent.png)")
        return True  # optimistic
    else:
        pg = (d.execute_script("return document.body.innerText") or "")[:500]
        L.info(f"Send btn NOT found. Page:\n{pg[:400]}")
        ss(d, "ci_fail_no_send.png")
        return False


def _click_next_btn(d):
    """Click the NEXT / saveInviteButton on any step of the Email Invite flow."""
    btn = d.execute_script("""
        var b = document.querySelector('button[name="saveInviteButton"]');
        if (b && b.offsetParent) return b;
        for (var b2 of document.querySelectorAll('button')) {
            if ((b2.innerText||'').trim().toUpperCase() === 'NEXT' && b2.offsetParent) return b2;
        }
        return null;
    """)
    if btn:
        txt = d.execute_script("return (arguments[0].innerText||'').trim()", btn)
        L.info(f"Clicking NEXT: {txt!r}")
        d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", btn)
        return True
    return False


def _set_email_body(d, html_body):
    """
    Set email body via Zoho Survey's Summernote editor.
    Confirmed flow (Phase 7c): Click 'Edit Message' DIV → modal opens with
    .note-editable[contenteditable='true'] → set innerHTML → click OK
    (button[name='saveTemplateButton']).
    """
    # Step A: Click "Edit Message" to open the modal
    em = d.execute_script("""
        for(var e of document.querySelectorAll('div,span,a,button')){
            if((e.innerText||'').trim()==='Edit Message'&&e.offsetParent) return e;
        } return null;
    """)
    if em:
        cls = d.execute_script("return (arguments[0].className||'')", em)
        L.info(f"Clicking Edit Message: cls={cls!r}")
        d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", em)
        time.sleep(5)  # wait for modal + Summernote to render

    # Step B: Find Summernote .note-editable (confirmed selector)
    note_ed = d.execute_script("""
        var e = document.querySelector('.note-editable[contenteditable="true"]');
        if (e && e.offsetParent) return e;
        // Fallback: any visible contenteditable with height > 40
        var ces = document.querySelectorAll('[contenteditable="true"]');
        for(var c of ces){
            if(c.offsetParent && c.offsetHeight > 40) return c;
        }
        return null;
    """)
    if note_ed:
        L.info("Found Summernote .note-editable — setting content via execCommand")
        # Use execCommand insertHTML which Summernote respects, keeping img tags intact
        d.execute_script("""
            arguments[0].focus();
            // Clear existing content
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            // Insert HTML — execCommand preserves img tags better than innerHTML
            document.execCommand('insertHTML', false, arguments[1]);
            arguments[0].dispatchEvent(new Event('input',  {bubbles:true}));
            arguments[0].dispatchEvent(new Event('change', {bubbles:true}));
        """, note_ed, html_body)
        time.sleep(1)

        # Step C: Click OK to close modal and save
        ok_btn = d.execute_script(
            "return document.querySelector('button[name=\"saveTemplateButton\"]');")
        if ok_btn:
            visible = d.execute_script("return arguments[0].offsetParent !== null", ok_btn)
            if visible:
                L.info("Clicking saveTemplateButton (OK)")
                d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", ok_btn)
                time.sleep(2)
                return "summernote_ok"
        return "summernote_no_ok"

    # Fallback: TinyMCE (unlikely on this form but keep for safety)
    try:
        r = d.execute_script("""
            if(typeof tinymce!=='undefined'&&(tinymce.editors||[]).length>0){
                tinymce.editors[0].setContent(arguments[0]); return 'tinymce_fallback';
            } return null;
        """, html_body)
        if r: return r
    except: pass

    L.warning("_set_email_body: no editor found")
    return None


def _add_recipients(d, recipients_csv):
    """
    Add email recipients to Zoho Survey Email Invite recipients page.
    Confirmed (Phase 7c): input[name='recipient_input'] cls='inviteInp'
    ph='Enter email addresses separated by commas' → type addr + Enter per address.
    """
    emails = [a.strip() for a in recipients_csv.split(",") if a.strip()]
    if not emails:
        L.warning("No email addresses provided"); return None

    # Strategy 1 (CONFIRMED): input[name='recipient_input'] — Zoho's inviteInp
    try:
        inp = d.execute_script("""
            return document.querySelector('input[name="recipient_input"]') ||
                   document.querySelector('input.inviteInp');
        """)
        if inp and d.execute_script("return arguments[0].offsetParent !== null", inp):
            L.info(f"Using recipient_input (inviteInp) for {len(emails)} email(s)")
            for addr in emails:
                d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", inp)
                time.sleep(0.2)
                inp.send_keys(addr); time.sleep(0.4)
                inp.send_keys(Keys.RETURN); time.sleep(0.6)
                L.info(f"  Added: {addr}")
            return "recipient_input"
    except Exception as e:
        L.warning(f"recipient_input err: {e}")

    # Strategy 2: Any visible email-type or placeholder-matching input
    for sel in ["input[type='email']", "input[placeholder*='email' i]",
                "input[placeholder*='address' i]", "input[placeholder*='comma' i]"]:
        try:
            el = d.find_element(By.CSS_SELECTOR, sel)
            if el.is_displayed():
                L.info(f"Fallback email input ({sel})")
                for addr in emails:
                    d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", el)
                    time.sleep(0.2); el.send_keys(addr); time.sleep(0.3)
                    el.send_keys(Keys.RETURN); time.sleep(0.5)
                return "email_input_fallback"
        except: pass

    # Strategy 3: visible textarea
    try:
        ta = d.execute_script("""
            for(var t of document.querySelectorAll('textarea')){
                if(t.offsetParent) return t;
            } return null;
        """)
        if ta:
            L.info("Textarea fallback for recipients")
            d.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", ta)
            time.sleep(0.3); ta.send_keys(Keys.CONTROL + "a"); ta.send_keys(Keys.DELETE)
            ta.send_keys(", ".join(emails)); time.sleep(0.5)
            return "textarea_fallback"
    except: pass

    L.warning("Could not add recipients via any approach"); return None


def main():
    opts = Options()
    opts.add_argument("--user-data-dir=" + PROF)
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-position=60,40")
    opts.add_argument("--window-size=1280,900")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])

    svc = Service(ChromeDriverManager().install())
    d = webdriver.Chrome(service=svc, options=opts)

    try:
        L.info(f"Account: {EMAIL}")
        L.info("Opening Zoho Survey SPA...")
        d.get("https://survey.zoho.com/survey/newui")
        rw(5, 7)
        ss(d, "s1_start.png")
        L.info(f"Start URL: {d.current_url[:100]}")

        login_if_needed(d)

        # After login, make sure we're on the survey dashboard
        cur = d.current_url
        if "survey.zoho.com" not in cur:
            L.info("Re-navigating to survey dashboard after login...")
            d.get("https://survey.zoho.com/survey/newui")
            rw(5, 7)
            cur = d.current_url
            L.info(f"Dashboard URL: {cur[:100]}")
            ss(d, "s2_dashboard.png")

        # Get portal and dept from URL
        portal_id, dept_id = extract_portal_dept(cur)
        if not portal_id:
            # Wait a bit more for SPA to load
            rw(3, 5)
            cur = d.current_url
            L.info(f"After wait URL: {cur[:100]}")
            portal_id, dept_id = extract_portal_dept(cur)

        if not portal_id:
            L.error(f"Cannot extract portal/dept. URL={cur}")
            # Use known values from registration
            portal_id = "929858814"
            dept_id = "BrBR76"
            L.info(f"Using fallback: portal={portal_id} dept={dept_id}")

        L.info(f"Portal: {portal_id} | Dept: {dept_id}")

        # Create survey
        survey_id = create_survey(d, portal_id, dept_id)
        if not survey_id:
            L.error("FAILED to create survey")
            ss(d, "fail_no_survey.png")
            time.sleep(60)
            return

        L.info(f"Survey created: {survey_id}")

        # Navigate to email invite page
        invite_url = navigate_to_email_invite(d, portal_id, dept_id, survey_id)

        # Save results
        with open(SAVE_F, "w", encoding="utf-8") as f:
            f.write(f"email={EMAIL}\n")
            f.write(f"password={PW}\n")
            f.write(f"portal={portal_id}\n")
            f.write(f"department={dept_id}\n")
            f.write(f"survey_id={survey_id}\n")
            f.write(f"invite_url={invite_url}\n")

        L.info("=" * 60)
        L.info("DISCOVERY COMPLETE")
        L.info(f"  Email     : {EMAIL}")
        L.info(f"  Portal    : {portal_id}")
        L.info(f"  Survey ID : {survey_id}")
        L.info(f"  Invite URL: {invite_url}")
        L.info(f"  Saved to  : {SAVE_F}")
        L.info("=" * 60)

        time.sleep(120)

    except Exception as e:
        import traceback
        L.error(f"CRASH: {e}")
        L.error(traceback.format_exc())
        ss(d, "crash.png")
    finally:
        try: d.quit()
        except: pass

if __name__ == "__main__":
    main()
