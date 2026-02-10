"""Remove Voice API (SIP Connection) from phone number, keeping only Call Control."""
import json
import os
import urllib.request
import urllib.error


ENV_PATH = r"C:\Users\leoge\OneDrive\Documents\AI Activity\Cursor\VoiceAIProduction\voice-core\.env"
PHONE_NUMBER = "+61240675354"
CALL_CONTROL_APP_ID = "2891398791343113498"  # The TeXML/Call Control app we want to keep


def _read_env_value(key: str) -> str | None:
    if not os.path.exists(ENV_PATH):
        return None
    with open(ENV_PATH, "r", encoding="utf-8") as fh:
        for line in fh:
            if line.startswith(f"{key}="):
                return line.strip().split("=", 1)[1].strip('"').strip("'")
    return None


def _request_json(method: str, url: str, headers: dict, payload: dict | None = None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def main():
    api_key = _read_env_value("TELNYX_API_KEY")
    if not api_key:
        raise SystemExit("TELNYX_API_KEY not found in .env")

    base = "https://api.telnyx.com/v2"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    print(f"=== Removing Voice API Connection from {PHONE_NUMBER} ===\n")

    # Step 1: Check current configuration
    print("STEP 1: Checking current phone number configuration...")
    phone_response = _request_json("GET", f"{base}/phone_numbers/{PHONE_NUMBER}", headers)
    phone_data = phone_response.get("data", {})
    
    current_connection_id = phone_data.get("connection_id")
    current_connection_name = phone_data.get("connection_name")
    
    print(f"  Phone Number: {phone_data.get('phone_number')}")
    print(f"  Current Connection ID: {current_connection_id}")
    print(f"  Current Connection Name: {current_connection_name}")
    
    if current_connection_id == CALL_CONTROL_APP_ID:
        print(f"\n  Already configured correctly with Call Control app!")
        print(f"  No Voice API connection to remove.")
        return
    
    # Step 2: Set connection to Call Control app only
    print(f"\nSTEP 2: Setting phone number to use ONLY Call Control application...")
    print(f"  Target Connection ID: {CALL_CONTROL_APP_ID}")
    
    patch_payload = {
        "connection_id": CALL_CONTROL_APP_ID
    }
    
    patch_response = _request_json(
        "PATCH",
        f"{base}/phone_numbers/{PHONE_NUMBER}",
        headers,
        patch_payload,
    )
    
    print("  Done!")
    
    # Step 3: Verify the change
    print(f"\nSTEP 3: Verifying configuration...")
    verify_response = _request_json("GET", f"{base}/phone_numbers/{PHONE_NUMBER}", headers)
    verify_data = verify_response.get("data", {})
    
    new_connection_id = verify_data.get("connection_id")
    new_connection_name = verify_data.get("connection_name")
    
    print(f"  Phone Number: {verify_data.get('phone_number')}")
    print(f"  Connection ID: {new_connection_id}")
    print(f"  Connection Name: {new_connection_name}")
    
    if new_connection_id == CALL_CONTROL_APP_ID:
        print(f"\n SUCCESS!")
        print(f"  Phone number is now ONLY assigned to Call Control application.")
        print(f"  Voice API (SIP Connection) has been removed.")
        print(f"\n  Try calling {PHONE_NUMBER} now - webhooks should work!")
    else:
        print(f"\n ERROR: Connection ID doesn't match expected value!")
        print(f"  Expected: {CALL_CONTROL_APP_ID}")
        print(f"  Got: {new_connection_id}")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "ignore")
        print(f"\nHTTPError {exc.code}: {exc.reason}")
        if body:
            print(body)
        raise
