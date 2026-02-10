"""
Quick tests to validate your setup before running a live call.

Run these tests BEFORE you try a live call to catch configuration issues early.

Usage:
    python test_pipeline.py
"""

import os
import sys
from dotenv import load_dotenv

# Load environment
load_dotenv()

print("=" * 60)
print("MINIMAL VOICE AI - PRE-FLIGHT CHECKS")
print("=" * 60)
print()

# Test 1: Check environment variables
print("1. Checking environment variables...")
required_vars = {
    "DEEPGRAM_API_KEY": "Deepgram (STT)",
    "GOOGLE_API_KEY": "Google Gemini (LLM)",
    "CARTESIA_API_KEY": "Cartesia (TTS)",
}

missing_vars = []
for var, service in required_vars.items():
    value = os.getenv(var)
    if value:
        print(f"   [OK] {service}: {'*' * 20}{value[-4:]}")
    else:
        print(f"   [FAIL] {service}: MISSING")
        missing_vars.append(var)

if missing_vars:
    print()
    print(f"[FAIL] Missing environment variables: {', '.join(missing_vars)}")
    print("   Create a .env file with these variables")
    sys.exit(1)

print()

# Test 2: Check dependencies
print("2. Checking dependencies...")
try:
    import pipecat
    print(f"   [OK] pipecat: {pipecat.__version__}")
except ImportError:
    print("   [FAIL] pipecat not installed")
    print("   Run: pip install -r requirements.txt")
    sys.exit(1)

try:
    import google.generativeai as genai
    print(f"   [OK] google-generativeai: installed")
except ImportError:
    print("   [FAIL] google-generativeai not installed")
    print("   Run: pip install -r requirements.txt")
    sys.exit(1)

try:
    from pipecat.services.deepgram import DeepgramSTTService
    print(f"   [OK] Deepgram service: available")
except ImportError:
    print("   [FAIL] Deepgram service not available")
    print("   Run: pip install pipecat-ai[daily]")
    sys.exit(1)

try:
    from pipecat.services.cartesia import CartesiaTTSService
    print(f"   [OK] Cartesia service: available")
except ImportError:
    print("   [FAIL] Cartesia service not available")
    print("   Run: pip install pipecat-ai[daily]")
    sys.exit(1)

print()

# Test 3: Test LLM
print("3. Testing Gemini LLM...")
try:
    import google.generativeai as genai
    from receptionist_prompt import get_system_prompt
    
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=get_system_prompt(),
    )
    
    # Quick test
    response = model.generate_content("Hi")
    
    if response.text:
        print(f"   [OK] LLM response: {response.text[:50]}...")
    else:
        print(f"   [FAIL] LLM returned empty response")
        sys.exit(1)
        
except Exception as e:
    print(f"   [FAIL] LLM test failed: {e}")
    sys.exit(1)

print()

# Test 4: Check prompt
print("4. Checking receptionist prompt...")
try:
    from receptionist_prompt import get_system_prompt
    prompt = get_system_prompt()
    print(f"   [OK] Prompt loaded: {len(prompt)} characters")
    print(f"   First line: {prompt.split('\\n')[0][:60]}...")
except Exception as e:
    print(f"   [FAIL] Prompt check failed: {e}")
    sys.exit(1)

print()
print("=" * 60)
print("[SUCCESS] ALL PRE-FLIGHT CHECKS PASSED")
print("=" * 60)
print()
print("Next steps:")
print("1. Start the server:")
print("   python bot_runner.py")
print()
print("2. Test with Daily.co:")
print("   - Create a room at https://dashboard.daily.co")
print("   - Call POST /start_call with room URL and token")
print("   - Join the room and talk to the bot")
print()
print("3. If it crashes, check:")
print("   - Server logs (console output)")
print("   - API key validity")
print("   - Daily.co room is active")
print()
