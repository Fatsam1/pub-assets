#!/usr/bin/env python3
"""
Test Real Sending - Send one test email via Zoho Survey
"""
import os
import sys
import time
import sqlite3
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import ssl
import imaplib

# Load environment
load_dotenv()
ssl._create_default_https_context = ssl._create_unverified_context
os.environ["WDM_SSL_VERIFY"] = "0"

config = {
    'zoho_email': os.getenv("ZOHO_EMAIL", ""),
    'zoho_pw': os.getenv("ZOHO_PASSWORD", ""),
    'zoho_imap': os.getenv("ZOHO_IMAP_PASSWORD", ""),
}

print("\n" + "="*70)
print("🧪 اختبار الإرسال الحقيقي - Zoho Email Survey")
print("="*70)

# Step 1: Check invite URL
print("\n[1/4] جاري البحث عن Invite URL...")
invite_file = os.path.join(os.path.dirname(__file__), "invite_url.txt")

if os.path.exists(invite_file):
    with open(invite_file, 'r') as f:
        invite_url = f.read().strip()
    print(f"✅ تم العثور على Invite URL")
    print(f"   {invite_url[:60]}...")
else:
    print(f"❌ لم يتم العثور على invite_url.txt")
    print(f"   يجب الحصول عليها من Zoho يدويًا أو تشغيل discover_invite_secure.py")
    sys.exit(1)

# Step 2: Check test email in database
print("\n[2/4] جاري التحقق من بريد الاختبار...")
db_path = os.path.join(os.path.dirname(__file__), "zoho_sender.db")
test_email = "test.real.send@mailinator.com"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if exists
cursor.execute("SELECT status FROM registered WHERE email=?", (test_email,))
result = cursor.fetchone()

if not result:
    print(f"📧 جاري إضافة بريد الاختبار: {test_email}")
    cursor.execute(
        "INSERT INTO registered (email, status) VALUES (?, ?)",
        (test_email, 'pending')
    )
    conn.commit()
    print(f"✅ تم إضافة البريد")
else:
    status = result[0]
    print(f"✅ البريد موجود بالفعل - الحالة: {status}")

conn.close()

# Step 3: Open browser and send
print("\n[3/4] جاري فتح المتصفح وإرسال الاستبيان...")

try:
    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--no-sandbox")
    # chrome_options.add_argument("--headless")  # Uncomment for headless mode

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(options=chrome_options, service=service)

    print(f"✅ تم فتح Chrome")

    # Navigate to invite URL
    print(f"   جاري الانتقال إلى الاستبيان...")
    driver.get(invite_url)
    time.sleep(3)

    # Take screenshot
    driver.save_screenshot(os.path.join(os.path.dirname(__file__), "survey_page.png"))
    print(f"   ✅ تم حفظ لقطة الشاشة")

    # Try to find email input field
    print(f"   جاري البحث عن حقل البريد الإلكتروني...")
    try:
        # Common Zoho Survey field selectors
        selectors = [
            ("xpath", "//input[@placeholder='Email' or @placeholder='email']"),
            ("xpath", "//input[@type='email']"),
            ("name", "email"),
            ("id", "email"),
            ("class", "email-input"),
        ]

        email_input = None
        for sel_type, selector in selectors:
            try:
                if sel_type == "xpath":
                    email_input = WebDriverWait(driver, 5).until(
                        EC.presence_of_element_located((By.XPATH, selector))
                    )
                else:
                    email_input = WebDriverWait(driver, 5).until(
                        EC.presence_of_element_located((By.NAME if sel_type == "name" else By.ID if sel_type == "id" else By.CLASS_NAME, selector))
                    )
                if email_input:
                    print(f"   ✅ وجدت حقل البريد: {sel_type}={selector}")
                    break
            except:
                continue

        if email_input:
            # Clear and type email
            email_input.clear()
            email_input.send_keys(test_email)
            print(f"   ✅ تم إدخال البريد: {test_email}")

            # Take another screenshot
            time.sleep(1)
            driver.save_screenshot(os.path.join(os.path.dirname(__file__), "survey_filled.png"))

            # Find and click submit button
            submit_buttons = driver.find_elements(By.XPATH, "//button[contains(text(), 'Submit') or contains(text(), 'send') or contains(text(), 'Continue')]")
            if submit_buttons:
                print(f"   ✅ وجدت زر الإرسال")
                submit_buttons[0].click()
                time.sleep(2)
                print(f"   ✅ تم الضغط على الإرسال")

                # Take final screenshot
                driver.save_screenshot(os.path.join(os.path.dirname(__file__), "survey_sent.png"))

                # Update database
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE registered SET status=? WHERE email=?",
                    ('sent', test_email)
                )
                conn.commit()
                conn.close()
                print(f"   ✅ تم تحديث قاعدة البيانات - الحالة: sent")
            else:
                print(f"   ⚠️  لم يتم العثور على زر الإرسال")
        else:
            print(f"   ⚠️  لم يتم العثور على حقل البريد الإلكتروني")

    except Exception as e:
        print(f"   ❌ خطأ أثناء ملء النموذج: {str(e)[:80]}")

    # Close browser
    driver.quit()
    print(f"✅ تم إغلاق المتصفح")

except Exception as e:
    print(f"❌ خطأ في المتصفح: {str(e)[:100]}")

# Step 4: Verify in IMAP
print("\n[4/4] جاري التحقق من البريد الوارد...")

try:
    domain = config['zoho_email'].split("@")[1]
    imap_server = f"mail.{domain}"

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    imap = imaplib.IMAP4_SSL(imap_server, 993, ssl_context=ctx)
    imap.login(config['zoho_email'], config['zoho_imap'])

    status, mailbox = imap.select('INBOX')
    status, emails = imap.search(None, 'ALL')

    email_ids = emails[0].split()
    recent_count = min(5, len(email_ids))

    print(f"✅ الاتصال بـ IMAP بنجاح")
    print(f"   - عدد الرسائل الكلي: {len(email_ids)}")
    print(f"   - آخر {recent_count} رسائل:")

    for i in range(recent_count):
        email_id = email_ids[-(i+1)]
        status, msg_data = imap.fetch(email_id, '(RFC822)')
        print(f"      [{i+1}] {email_id.decode()}")

    imap.close()
    imap.logout()

except Exception as e:
    print(f"⚠️  خطأ في التحقق من IMAP: {str(e)[:80]}")

print("\n" + "="*70)
print("✅ اختبار الإرسال الحقيقي اكتمل!")
print("="*70 + "\n")
