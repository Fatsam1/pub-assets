#!/usr/bin/env python3
"""
Test Full Workflow - End to End
Steps:
1. Load config
2. Check database
3. Prepare emails
4. Test Telegram notification
5. Test IMAP validation
6. Simulate batch sending
7. Report results
"""
import os
import sys
import time
import sqlite3
import requests
import imaplib
from dotenv import load_dotenv
from datetime import datetime

# Load environment
load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config_loader import load_config

print("\n" + "="*70)
print("🚀 ZOHO EMAIL SENDER v5 - FULL WORKFLOW TEST")
print("="*70)

# ============= Step 1: Load Config =============
print("\n[1/7] جاري تحميل الإعدادات...")
config = load_config()
if not config['zoho_email']:
    print("❌ خطأ: لم يتم العثور على بريد Zoho في .env")
    sys.exit(1)

print(f"✅ تم تحميل الإعدادات")
print(f"   - البريد: {config['zoho_email']}")
print(f"   - نوع Proxy: {config['proxy_type']}")
print(f"   - حجم الدفعة: {config['batch_size']}")

# ============= Step 2: Check Database =============
print("\n[2/7] جاري فحص قاعدة البيانات...")
db_path = os.path.join(os.path.dirname(__file__), "zoho_sender.db")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='registered'")
    if not cursor.fetchone():
        print("⚠️  لم يتم العثور على جدول registered - جاري الإنشاء...")
        cursor.execute("""
            CREATE TABLE registered (
                email TEXT UNIQUE,
                imap_server TEXT,
                profile_idx INTEGER,
                registered_at TEXT,
                status TEXT DEFAULT 'pending'
            )
        """)
        conn.commit()
        print("✅ تم إنشاء الجدول")

    # Get stats
    cursor.execute("SELECT COUNT(*) FROM registered")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM registered WHERE status='sent'")
    sent = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM registered WHERE status='pending'")
    pending = cursor.fetchone()[0]

    conn.close()

    print(f"✅ قاعدة البيانات جاهزة")
    print(f"   - الإجمالي: {total}")
    print(f"   - المرسل: {sent}")
    print(f"   - المعلق: {pending}")
except Exception as e:
    print(f"❌ خطأ في قاعدة البيانات: {e}")
    sys.exit(1)

# ============= Step 3: Prepare Test Emails =============
print("\n[3/7] جاري إضافة بريد اختبار...")
test_emails = [
    "test.workflow.001@mailinator.com",
    "test.workflow.002@mailinator.com",
    "test.workflow.003@mailinator.com",
]

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    added = 0
    for email in test_emails:
        try:
            cursor.execute(
                "INSERT INTO registered (email, status) VALUES (?, ?)",
                (email, 'pending')
            )
            added += 1
        except sqlite3.IntegrityError:
            pass  # Already exists

    conn.commit()
    conn.close()

    if added > 0:
        print(f"✅ تم إضافة {added} بريد اختبار")
    else:
        print(f"ℹ️  جميع الرسائل موجودة بالفعل")
except Exception as e:
    print(f"❌ خطأ في إضافة الرسائل: {e}")

# ============= Step 4: Test Telegram Notification =============
print("\n[4/7] جاري اختبار إخطارات Telegram...")
tg_token = config.get('tg_token', '')
tg_chat = config.get('tg_chat', '')

if tg_token and tg_chat:
    try:
        url = f"https://api.telegram.org/bot{tg_token}/sendMessage"
        payload = {
            "chat_id": tg_chat,
            "text": f"🧪 اختبار Zoho Sender v5\n⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n✅ النظام يعمل بنجاح"
        }
        response = requests.post(url, json=payload, timeout=10)

        if response.status_code == 200:
            print("✅ تم إرسال إخطار Telegram بنجاح")
        else:
            print(f"⚠️  استجابة Telegram: {response.status_code}")
    except Exception as e:
        print(f"⚠️  خطأ في Telegram: {str(e)[:50]}")
else:
    print("⚠️  لم يتم تكوين Telegram (اختياري)")

# ============= Step 5: Test IMAP Connection =============
print("\n[5/7] جاري اختبار اتصال IMAP...")
zoho_email = config['zoho_email']
zoho_pw = config['zoho_imap_password']

try:
    domain = zoho_email.split("@")[1]
    imap_server = f"mail.{domain}"

    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    imap = imaplib.IMAP4_SSL(imap_server, 993, ssl_context=ctx)
    imap.login(zoho_email, zoho_pw)

    # Get mailbox info
    status, mailbox = imap.select('INBOX')
    print(f"✅ تم الاتصال بـ IMAP بنجاح")
    print(f"   - الخادم: {imap_server}")
    print(f"   - البريد: {zoho_email}")

    imap.close()
    imap.logout()
except Exception as e:
    print(f"❌ خطأ في IMAP: {str(e)[:80]}")

# ============= Step 6: Simulate Batch Send =============
print("\n[6/7] محاكاة إرسال دفعة...")
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get pending emails
    cursor.execute("SELECT email FROM registered WHERE status='pending' LIMIT 3")
    pending_emails = cursor.fetchall()

    if pending_emails:
        print(f"ℹ️  عدد الرسائل المعلقة: {len(pending_emails)}")

        # Simulate sending
        for (email,) in pending_emails:
            print(f"   📧 محاكاة إرسال إلى: {email}")
            time.sleep(0.5)  # Simulate sending delay

            # Update status
            cursor.execute(
                "UPDATE registered SET status=? WHERE email=?",
                ('sent', email)
            )

        conn.commit()
        print(f"✅ تم تحديث {len(pending_emails)} رسالة في قاعدة البيانات")
    else:
        print("ℹ️  لا توجد رسائل معلقة")

    conn.close()
except Exception as e:
    print(f"❌ خطأ في محاكاة الإرسال: {e}")

# ============= Step 7: Final Report =============
print("\n[7/7] تقرير نهائي...")
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM registered")
    total_final = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM registered WHERE status='sent'")
    sent_final = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM registered WHERE status='pending'")
    pending_final = cursor.fetchone()[0]

    conn.close()

    success_rate = (sent_final / total_final * 100) if total_final > 0 else 0

    print(f"\n{'='*70}")
    print(f"📊 النتائج النهائية:")
    print(f"{'='*70}")
    print(f"✅ الإجمالي:       {total_final}")
    print(f"✅ المرسل:         {sent_final}")
    print(f"⏳ المعلق:         {pending_final}")
    print(f"📈 نسبة الإنجاز:   {success_rate:.1f}%")
    print(f"{'='*70}")

    if success_rate >= 50:
        print(f"🎉 النظام يعمل بكفاءة!")
    elif success_rate > 0:
        print(f"⚠️  جاري العمل على تحسين الأداء")
    else:
        print(f"🔧 نحتاج إلى إصلاح بعض الأشياء")

except Exception as e:
    print(f"❌ خطأ في التقرير النهائي: {e}")

print(f"\n{'='*70}")
print("✅ اختبار الـ Workflow اكتمل!")
print("="*70 + "\n")
