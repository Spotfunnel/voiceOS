"""Fix Telnyx phone number to use existing Call Control app with correct webhook."""
import json
import os
import urllib.request
import urllib.error


ENV_PATH = r"C:\Users\leoge\OneDrive\Documents\AI Activity\Cursor\VoiceAIProduction\voice-core\.env"
PHONE_NUMBER = "+61240675354"


def _read_env_value(key: str) -> str | None:
    if not os.path.exists(ENV_PATH):
        return None
    with open(ENV_PATH, "r", encoding="utf-8") as fh:
        for line in fh:
            if line.startswith(f"{key}="):
                return line.strip().split("=", 1)[1].strip('"').strip("'")
    return None


def _get_ngrok_url() -> str | None:
    try:
        with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels") as resp:
            data = json.load(resp)
        for tunnel in data.get("tunnels", []):
            public_url = tunnel.get("public_url", "")
            if public_url.startswith("https://"):
                return public_url
        return None
    except Exception:
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

    ngrok_url = _get_ngrok_url() or _read_env_value("NGROK_URL")
    if not ngrok_url:
        raise SystemExit("NGROK_URL not found (ngrok not running and not in .env)")

    base = "https://api.telnyx.com/v2"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    webhook_url = f"{ngrok_url}/api/telnyx/webhook"

    print(f"=== Fixing Telnyx Configuration for {PHONE_NUMBER} ===\n")
    print(f"Target webhook URL: {webhook_url}\n")

    # Step 1: List all TeXML applications
    print("STEP 1: Listing all TeXML/Call Control applications...")
    apps_response = _request_json("GET", f"{base}/texml_applications", headers)
    apps = apps_response.get("data", [])
    
    print(f"Found {len(apps)} applications:")
    for app in apps:
        print(f"  - {app.get('friendly_name')} (ID: {app.get('id')})")
        print(f"    Voice URL: {app.get('voice_url')}")
    
    # Find or use the voiceOS-CallControl app
    target_app = None
    for app in apps:
        if app.get("friendly_name") == "voiceOS-CallControl":
            target_app = app
            break
    
    if not target_app:
        print("\nNo 'voiceOS-CallControl' app found. Creating one...")
        texml_payload = {
            "friendly_name": "voiceOS-CallControl",
            "voice_url": webhook_url,
            "voice_method": "POST",
            "status_callback": webhook_url,
            "status_callback_method": "POST",
        }
        create_response = _request_json("POST", f"{base}/texml_applications", headers, texml_payload)
        target_app = create_response.get("data", {})
        print(f"Created application: {target_app.get('id')}")
    
    app_id = target_app.get("id")
    print(f"\nSTEP 2: Using application ID: {app_id}")
    
    # Step 3: Update the application's webhook URL if needed
    current_voice_url = target_app.get("voice_url")
    if current_voice_url != webhook_url:
        print(f"\nSTEP 3: Updating webhook URL...")
        print(f"  Current: {current_voice_url}")
        print(f"  New:     {webhook_url}")
        
        update_payload = {
            "voice_url": webhook_url,
            "voice_method": "POST",
            "status_callback": webhook_url,
            "status_callback_method": "POST",
        }
        _request_json("PATCH", f"{base}/texml_applications/{app_id}", headers, update_payload)
        print("  Updated!")
    else:
        print(f"\nSTEP 3: Webhook URL already correct: {webhook_url}")
    
    # Step 4: Associate phone number with this application
    print(f"\nSTEP 4: Associating phone number {PHONE_NUMBER} with application...")
    patch_payload = {"connection_id": app_id}
    patch_response = _request_json(
        "PATCH",
        f"{base}/phone_numbers/{PHONE_NUMBER}",
        headers,
        patch_payload,
    )
    print("  Done!")
    
    # Step 5: Verify
    print(f"\nSTEP 5: Verifying configuration...")
    phone_response = _request_json("GET", f"{base}/phone_numbers/{PHONE_NUMBER}", headers)
    phone_data = phone_response.get("data", {})
    
    print(f"  Phone Number: {phone_data.get('phone_number')}")
    print(f"  Connection ID: {phone_data.get('connection_id')}")
    print(f"  Connection Name: {phone_data.get('connection_name')}")
    
    if phone_data.get("connection_id") == app_id:
        print(f"\n SUCCESS! Phone number is now configured with Call Control application.")
        print(f"  Webhooks will be sent to: {webhook_url}")
        print(f"\n  Try calling {PHONE_NUMBER} now - you should see call.initiated webhook!")
    else:
        print(f"\n ERROR: Phone number connection_id doesn't match!")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "ignore")
        print(f"\nHTTPError {exc.code}: {exc.reason}")
        if body:
            print(body)
        raise
