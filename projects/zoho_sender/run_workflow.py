#!/usr/bin/env python3
"""
Run Zoho Sender workflow - send pending emails
"""
import os
import sys
import sqlite3
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Import config loader
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config_loader import load_config

print("🚀 Zoho Email Sender v5 - Workflow Runner")
print("=" * 50)

# Load config
config = load_config()
print(f"✅ Configuration loaded")
print(f"   - Email: {config['zoho_email']}")
print(f"   - Batch size: {config['batch_size']}")
print(f"   - Cooldown: {config['cd_min']}s - {config['cd_max']}s")

# Check database
db_path = os.path.join(os.path.dirname(__file__), "zoho_sender.db")
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM registered")
    total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM registered WHERE status='pending'")
    pending = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM registered WHERE status='sent'")
    sent = cursor.fetchone()[0]

    conn.close()

    print(f"\n📊 Database Status:")
    print(f"   - Total emails: {total}")
    print(f"   - Pending: {pending}")
    print(f"   - Sent: {sent}")
    print(f"   - Success rate: {(sent/total*100):.1f}%")

    if pending > 0:
        print(f"\n⚠️  {pending} emails waiting to be sent!")
        print(f"   Run 'python zoho_sender_gui.py' to continue sending")
    else:
        print(f"\n✅ All emails processed!")
else:
    print(f"❌ Database not found: {db_path}")

print("\n" + "=" * 50)
print("✅ Workflow check complete")
