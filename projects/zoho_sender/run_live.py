#!/usr/bin/env python3
"""
Launch Zoho Sender v5 GUI - LIVE
Logs all events to console and file
"""
import os, sys, time
from dotenv import load_dotenv

load_dotenv('.env')

print("\n" + "="*80)
print("ZOHO SENDER v5 - LAUNCHING LIVE")
print("="*80 + "\n")

print("[1] Configuration Check")
print("-" * 80)

proxyscrape_key = os.getenv("PROXYSCRAPE_API_KEY", "").strip()
capmonster_key = os.getenv("CAPMONSTER_KEY", "").strip()
tg_token = os.getenv("TG_TOKEN", "").strip()
proxy_type = os.getenv("PROXY_TYPE", "").strip()

print(f"  ProxyScrape API: {'OK' if proxyscrape_key else 'MISSING'}")
print(f"  CapMonster Key: {'OK' if capmonster_key else 'MISSING'}")
print(f"  Telegram Token: {'OK' if tg_token else 'MISSING'}")
print(f"  Proxy Type: {proxy_type or 'none'}")

if not (proxyscrape_key and capmonster_key and tg_token):
    print("\nERROR: Missing required configuration")
    sys.exit(1)

print("\nOK All configuration loaded\n")

print("[2] Database Check")
print("-" * 80)

import sqlite3, json

try:
    conn = sqlite3.connect("zoho_sender.db")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM registered")
    count = cursor.fetchone()[0]
    conn.close()
    print(f"  Registered emails: {count}")

    with open("valid_combos.json", encoding="utf-8") as f:
        combos = json.load(f)
    print(f"  Valid combos: {len(combos)}")

    print("\nOK Database ready\n")
except Exception as e:
    print(f"\nERROR Database error: {str(e)[:100]}")
    sys.exit(1)

print("[3] Launching GUI")
print("-" * 80)
print("\n  Starting zoho_sender_gui.py...\n")
print("="*80)
print()

# Launch GUI
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import zoho_sender_gui
    # GUI runs here - this blocks until closed
except KeyboardInterrupt:
    print("\n[SHUTDOWN] User interrupted")
    sys.exit(0)
except Exception as e:
    print(f"\n[ERROR] GUI failed: {str(e)}")
    sys.exit(1)
