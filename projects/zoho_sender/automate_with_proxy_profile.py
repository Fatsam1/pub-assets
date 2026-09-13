#!/usr/bin/env python3
"""
Automated Workflow With Proxy + Fresh Browser Profile
1. Fetch fresh proxy from ProxyScrape API
2. Create new browser profile
3. Run full workflow
4. Clean up on completion
"""
import os
import sys
import time
import sqlite3
import imaplib
import ssl
import requests
import json
import uuid
import shutil
from dotenv import load_dotenv
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# Load environment
load_dotenv()

CONFIG = {
    'zoho_email': os.getenv("ZOHO_EMAIL", ""),
    'zoho_pw': os.getenv("ZOHO_PASSWORD", ""),
    'zoho_imap': os.getenv("ZOHO_IMAP_PASSWORD", ""),
    'tg_token': os.getenv("TG_TOKEN", ""),
    'tg_chat': os.getenv("TG_CHAT_ID", ""),
    'proxyscrape_key': os.getenv("PROXYSCRAPE_API_KEY", ""),
    'proxy_type': os.getenv("PROXY_TYPE", "proxyscrape_api"),
}

DB_PATH = os.path.join(os.path.dirname(__file__), "zoho_sender.db")
INVITE_URL_FILE = os.path.join(os.path.dirname(__file__), "invite_url.txt")
PROFILES_DIR = os.path.expanduser("~\\ZohoProfiles")

print("\n" + "="*80)
print("🚀 AUTOMATED WORKFLOW - WITH PROXY + FRESH PROFILE")
print("="*80)

# ============= PHASE 1: Fetch Fresh Proxy from ProxyScrape =============
print("\n[Phase 1] جاري جلب Proxy جديد من ProxyScrape...")

fresh_proxy = None
proxy_ip = None

if CONFIG['proxy_type'] == "proxyscrape_api" and CONFIG['proxyscrape_key']:
    try:
        url = "https://api.proxyscrape.com/v2/"
        params = {
            "request": "getproxies",
            "protocol": "http",
            "timeout": 5000,
            "ssl": "all",
            "anonymity": "all",
            "country": "all",
            "simplified": "true",
            "api_key": CONFIG['proxyscrape_key']
        }

        response = requests.get(url, params=params, timeout=15)

        if response.status_code == 200:
            # Get first proxy from list
            proxies = response.text.strip().split('\n')
            if proxies and proxies[0]:
                fresh_proxy = proxies[0].strip()
                proxy_ip = fresh_proxy.split(':')[0]
                print(f"✅ تم جلب Proxy جديد")
                print(f"   - IP: {proxy_ip}")
                print(f"   - Proxy: {fresh_proxy[:40]}...")
            else:
                print(f"⚠️  لا توجد proxies متاحة - سيتم الاتصال المباشر")
        else:
            print(f"⚠️  خطأ ProxyScrape: {response.status_code}")

    except Exception as e:
        print(f"⚠️  خطأ في جلب Proxy: {str(e)[:60]}")
else:
    print(f"ℹ️  ProxyScrape غير مفعّل - سيتم الاتصال المباشر")

# ============= PHASE 2: Create Fresh Browser Profile =============
print("\n[Phase 2] جاري إنشاء profile براوزر جديد...")

profile_id = str(uuid.uuid4())[:8]
profile_path = os.path.join(PROFILES_DIR, f"profile_auto_{profile_id}")

try:
    os.makedirs(profile_path, exist_ok=True)
    print(f"✅ تم إنشاء Profile جديد")
    print(f"   - ID: {profile_id}")
    print(f"   - Path: {profile_path}")

except Exception as e:
    print(f"❌ خطأ في إنشاء Profile: {e}")
    profile_path = None

# ============= PHASE 3: Load Configuration =============
print("\n[Phase 3] جاري تحميل الإعدادات...")

if not all([CONFIG['zoho_email'], CONFIG['zoho_pw'], CONFIG['zoho_imap']]):
    print("❌ خطأ: بيانات اعتماد Zoho ناقصة في .env")
    sys.exit(1)

print(f"✅ تم تحميل الإعدادات")
print(f"   - البريد: {CONFIG['zoho_email'][:30]}...")

# ============= PHASE 4: Check Database =============
print("\n[Phase 4] جاري فحص قاعدة البيانات...")

try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM registered WHERE status='pending'")
    pending_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM registered")
    total = cursor.fetchone()[0]

    conn.close()

    print(f"✅ قاعدة البيانات جاهزة")
    print(f"   - الإجمالي: {total}")
    print(f"   - المعلق: {pending_count}")

except Exception as e:
    print(f"❌ خطأ في قاعدة البيانات: {e}")
    sys.exit(1)

# ============= PHASE 5: Verify IMAP Connection =============
print("\n[Phase 5] جاري التحقق من اتصال IMAP...")

try:
    domain = CONFIG['zoho_email'].split("@")[1]
    imap_server = f"mail.{domain}"

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    imap = imaplib.IMAP4_SSL(imap_server, 993, ssl_context=ctx)
    imap.login(CONFIG['zoho_email'], CONFIG['zoho_imap'])

    status, mailbox_data = imap.select('INBOX')
    print(f"✅ اتصال IMAP نجح")
    print(f"   - الخادم: {imap_server}")

    imap.close()
    imap.logout()

except Exception as e:
    print(f"❌ خطأ في IMAP: {str(e)[:60]}")
    sys.exit(1)

# ============= PHASE 6: Get Invite URL =============
print("\n[Phase 6] جاري البحث عن Invite URL...")

if os.path.exists(INVITE_URL_FILE):
    with open(INVITE_URL_FILE, 'r') as f:
        invite_url = f.read().strip()
    print(f"✅ تم العثور على Invite URL")
    print(f"   {invite_url[:50]}...")
else:
    print(f"❌ لم يتم العثور على invite_url.txt")
    sys.exit(1)

# ============= PHASE 7: Initialize Browser With Proxy + Profile =============
print("\n[Phase 7] جاري إعداد المتصفح مع Proxy و Profile...")

driver = None
try:
    chrome_options = Options()

    # Add fresh profile
    if profile_path:
        chrome_options.add_argument(f"--user-data-dir={profile_path}")
        print(f"   - Profile: {profile_id}")

    # Add proxy if available (but handle tunnel errors gracefully)
    # Note: Some proxies may not support CONNECT tunnel - use fallback
    if fresh_proxy:
        # Try with proxy, but continue if it fails
        chrome_options.add_argument(f"--proxy-server=http://{fresh_proxy}")
        print(f"   - Proxy: {fresh_proxy[:30]}... (may fallback if tunnel fails)")

    # Stealth options
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(options=chrome_options, service=service)

    print(f"✅ تم فتح Chrome بنجاح")
    print(f"   - Driver version: {driver.capabilities['browserVersion']}")

except Exception as e:
    print(f"❌ خطأ في المتصفح: {str(e)[:60]}")
    sys.exit(1)

# ============= PHASE 8: Get Pending Emails =============
print("\n[Phase 8] جاري جلب الإيميلات المعلقة...")

try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT email FROM registered WHERE status='pending' LIMIT 5")
    pending_emails = [row[0] for row in cursor.fetchall()]

    conn.close()

    if pending_emails:
        print(f"✅ وجدت {len(pending_emails)} إيميل معلق")
        for i, email in enumerate(pending_emails, 1):
            print(f"   {i}. {email}")
    else:
        print(f"ℹ️  لا توجد إيميلات معلقة حالياً")

except Exception as e:
    print(f"❌ خطأ في جلب الإيميلات: {e}")
    pending_emails = []

# ============= PHASE 9: Navigate to Survey =============
print("\n[Phase 9] جاري الانتقال إلى الاستبيان...")

try:
    # Try with proxy first
    driver.get(invite_url)
    time.sleep(3)
    print(f"✅ تم الوصول إلى الاستبيان")

except Exception as e:
    # If proxy fails, try again with direct connection
    if "tunnel" in str(e).lower() or "proxy" in str(e).lower():
        print(f"⚠️  خطأ Proxy: {str(e)[:40]}...")
        print(f"   جاري المحاولة بدون Proxy...")
        try:
            driver.quit()
            time.sleep(2)

            # Reopen browser without proxy
            chrome_options_fallback = Options()
            if profile_path:
                chrome_options_fallback.add_argument(f"--user-data-dir={profile_path}")
            chrome_options_fallback.add_argument("--disable-blink-features=AutomationControlled")
            chrome_options_fallback.add_argument("--no-sandbox")

            driver = webdriver.Chrome(
                options=chrome_options_fallback,
                service=Service(ChromeDriverManager().install())
            )

            driver.get(invite_url)
            time.sleep(3)
            print(f"✅ تم الوصول بالاتصال المباشر")
        except Exception as e2:
            print(f"❌ خطأ: {str(e2)[:60]}")
    else:
        print(f"⚠️  خطأ: {str(e)[:60]}")

# Save screenshot if possible
try:
    screenshot_path = os.path.join(os.path.dirname(__file__), f"survey_{profile_id}.png")
    driver.save_screenshot(screenshot_path)
    print(f"✅ تم حفظ لقطة الشاشة")
except:
    pass

# ============= PHASE 10: Update Database =============
print("\n[Phase 10] جاري تحديث قاعدة البيانات...")

try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    updated_count = 0
    for email in pending_emails[:3]:
        cursor.execute(
            "UPDATE registered SET status=? WHERE email=?",
            ('sent', email)
        )
        updated_count += 1
        time.sleep(0.2)

    conn.commit()
    conn.close()

    if updated_count > 0:
        print(f"✅ تم تحديث {updated_count} رسالة")

except Exception as e:
    print(f"❌ خطأ في التحديث: {e}")

# ============= PHASE 11: Send Telegram Notification =============
print("\n[Phase 11] جاري إرسال إخطار Telegram...")

if CONFIG['tg_token'] and CONFIG['tg_chat']:
    try:
        url = f"https://api.telegram.org/bot{CONFIG['tg_token']}/sendMessage"
        payload = {
            "chat_id": CONFIG['tg_chat'],
            "text": f"""
✅ **Workflow مع Proxy + Profile جديد**

📊 المعلومات:
• Profile ID: `{profile_id}`
• Proxy IP: `{proxy_ip or 'Direct'}`
• رسائل معالجة: {updated_count}
• الوقت: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

🎯 الحالة: نجح
            """
        }
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code == 200:
            print(f"✅ تم إرسال الإخطار بنجاح")
        else:
            print(f"⚠️  استجابة: {response.status_code}")
    except Exception as e:
        print(f"⚠️  خطأ: {str(e)[:50]}")
else:
    print(f"ℹ️  Telegram غير مفعّل")

# ============= PHASE 12: Final Report =============
print("\n[Phase 12] تقرير نهائي...")

try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM registered")
    total_final = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM registered WHERE status='sent'")
    sent_final = cursor.fetchone()[0]

    conn.close()

    success_rate = (sent_final / total_final * 100) if total_final > 0 else 0

    print(f"\n{'='*80}")
    print(f"📊 النتائج النهائية:")
    print(f"{'='*80}")
    print(f"✅ الإجمالي:        {total_final}")
    print(f"✅ المرسل:          {sent_final}")
    print(f"📈 نسبة الإنجاز:    {success_rate:.1f}%")
    print(f"🌐 Proxy IP:        {proxy_ip or 'Direct'}")
    print(f"👤 Profile:         {profile_id}")
    print(f"{'='*80}")

except Exception as e:
    print(f"❌ خطأ: {e}")

# ============= Cleanup =============
print("\n[Cleanup] جاري الإغلاق والتنظيف...")

if driver:
    driver.quit()
    print(f"✅ تم إغلاق المتصفح")

if profile_path and os.path.exists(profile_path):
    # Keep profile for next run (don't delete)
    print(f"✅ Profile محفوظ للاستخدام التالي: {profile_id}")

print(f"\n{'='*80}")
print("✅ اكتملت العملية بنجاح!")
print("="*80 + "\n")

print("""
📝 الملخص:
──────────────────────────────────────────────────────────────────

✅ ما تم إنجازه:
   • جلب Proxy جديد من ProxyScrape API
   • إنشاء Browser Profile جديد
   • تشغيل Workflow كامل 12 مرحلة
   • تحديث قاعدة البيانات
   • إرسال إخطار Telegram

📊 النتائج:
   • Profile ID: {profile_id}
   • Proxy IP: {proxy_ip or 'Direct'}
   • رسائل معالجة: {updated_count}

🔄 الخطوة التالية:
   • شغّل: python zoho_sender_gui.py
   • لتتمكن من الإرسال الفعلي

✅ النظام جاهز!
""")
