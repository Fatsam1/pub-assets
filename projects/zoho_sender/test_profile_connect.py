#!/usr/bin/env python3
"""
Test: Click on first profile -> Connect -> Fetch fresh proxy -> Launch Chrome
"""
import os, sys, time, socket
from dotenv import load_dotenv

load_dotenv('.env')

print("\n" + "="*80)
print("TEST: PROFILE CONNECTION WITH FRESH PROXY")
print("="*80 + "\n")

# Simulate what happens when user clicks "Connect" on a profile
profile_email = "francis.pfeiffer@nordnet.fr"
profile_dir = f"C:\\temp\\chrome_profile_test"

# Create profile dir if needed
import shutil
if os.path.exists(profile_dir):
    shutil.rmtree(profile_dir)
os.makedirs(profile_dir, exist_ok=True)

print(f"[1] Profile: {profile_email}")
print(f"[2] Profile Dir: {profile_dir}")
print()

# Import the driver function
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zoho_sender_gui import _build_driver

print("[3] Building Chrome driver with ProxyScrape API...")
print("-" * 80)

try:
    driver = _build_driver(profile_dir, headless=True, size=(1200, 900))
    print("\n[OK] ChromeDriver built successfully!")
    print(f"[OK] URL: {driver.current_url}")

    # Navigate to httpbin to verify proxy
    print("\n[4] Testing proxy...")
    driver.get("http://httpbin.org/ip")
    time.sleep(2)

    try:
        body = driver.find_element("tag name", "body").text
        print(f"[OK] Proxy response: {body[:100]}")
    except:
        print(f"[WARNING] Could not read response")

    # Navigate to Zoho
    print("\n[5] Navigating to Zoho...")
    driver.get("https://accounts.zoho.com/signin/v2/workspaces")
    time.sleep(2)

    print(f"[OK] Zoho page loaded: {driver.current_url}")

    driver.quit()
    print("\n[OK] Chrome closed")
    print("\nSUCCESS: Profile connect workflow complete!")

except Exception as e:
    print(f"\n[ERROR] {str(e)[:200]}")
    try:
        driver.quit()
    except:
        pass

print()
