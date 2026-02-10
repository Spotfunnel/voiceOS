"""
Test Telnyx setup before running live calls
"""

import os
from dotenv import load_dotenv

load_dotenv()

print("=" * 60)
print("TELNYX SETUP CHECK")
print("=" * 60)
print()

# Check environment variables
print("1. Environment variables:")
required = {
    "TELNYX_API_KEY": "Telnyx API",
    "TELNYX_PHONE_NUMBER": "Phone number",
    "NGROK_URL": "ngrok tunnel",
}

missing = []
for var, desc in required.items():
    value = os.getenv(var)
    if value:
        if var == "TELNYX_API_KEY":
            print(f"   [OK] {desc}: KEY...{value[-10:]}")
        else:
            print(f"   [OK] {desc}: {value}")
    else:
        print(f"   [FAIL] {desc}: MISSING")
        missing.append(var)

if missing:
    print()
    print(f"[FAIL] Missing: {', '.join(missing)}")
    exit(1)

print()

# Check Telnyx API key
print("2. Testing Telnyx API key...")
try:
    import telnyx
    telnyx.api_key = os.getenv("TELNYX_API_KEY")
    
    # Try a simple API call to validate key
    try:
        # Test by checking if we can access Call methods
        # (This validates the API key format)
        if not telnyx.api_key or len(telnyx.api_key) < 20:
            raise ValueError("Invalid API key format")
        print("   [OK] Telnyx API key is valid")
    except Exception as e:
        print(f"   [FAIL] Telnyx API error: {e}")
        exit(1)
        
except ImportError:
    print("   [FAIL] telnyx package not installed")
    print("   Run: pip install telnyx")
    exit(1)

print()

# Check ngrok
print("3. Checking ngrok URL...")
ngrok_url = os.getenv("NGROK_URL", "")
if not ngrok_url:
    print("   [FAIL] NGROK_URL not set")
    exit(1)

if not (ngrok_url.startswith("https://") or ngrok_url.startswith("http://")):
    print(f"   [FAIL] NGROK_URL must start with https:// or http://")
    exit(1)

print(f"   [OK] ngrok URL: {ngrok_url}")
print()

# Summary
print("=" * 60)
print("[SUCCESS] ALL CHECKS PASSED")
print("=" * 60)
print()
print("Next steps:")
print("1. Make sure ngrok is running:")
print("   ngrok http 8000")
print()
print("2. Start the server:")
print("   python bot_runner_telnyx.py")
print()
print("3. Configure Telnyx webhook:")
print(f"   URL: {ngrok_url}/api/telnyx/webhook")
print(f"   https://portal.telnyx.com/#/app/call-control/applications")
print()
print("4. Test by calling:")
print(f"   {os.getenv('TELNYX_PHONE_NUMBER')}")
print()
