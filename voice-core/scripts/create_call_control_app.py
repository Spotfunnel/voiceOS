"""Create a proper Call Control Application (not TeXML) for JSON webhooks."""
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

    print(f"=== Creating Call Control Application (NOT TeXML) ===\n")
    print(f"Webhook URL: {webhook_url}\n")

    # Step 1: Create a Call Control Application
    print("STEP 1: Creating Call Control Application...")
    
    # Note: Call Control apps are created via /call_control_applications endpoint
    # NOT /texml_applications (which expect XML responses)
    app_payload = {
        "application_name": "voiceOS-CallControl-JSON",
        "webhook_event_url": webhook_url,
        "webhook_event_failover_url": "",
        "webhook_api_version": "2",
        "first_command_timeout": True,
        "first_command_timeout_secs": 30,
    }
    
    try:
        app_response = _request_json("POST", f"{base}/call_control_applications", headers, app_payload)
        app_data = app_response.get("data", {})
        
        app_id = app_data.get("id")
        print(f"  Created Call Control Application!")
        print(f"  Application ID: {app_id}")
        print(f"  Application Name: {app_data.get('application_name')}")
        print(f"  Webhook URL: {app_data.get('webhook_event_url')}")
        
    except urllib.error.HTTPError as e:
        if e.code == 422:
            # App might already exist, try to find it
            print("  Application might already exist, searching...")
            apps_response = _request_json("GET", f"{base}/call_control_applications", headers)
            apps = apps_response.get("data", [])
            
            target_app = None
            for app in apps:
                if app.get("application_name") == "voiceOS-CallControl-JSON":
                    target_app = app
                    break
            
            if target_app:
                app_id = target_app.get("id")
                print(f"  Found existing application: {app_id}")
                
                # Update webhook URL if needed
                if target_app.get("webhook_event_url") != webhook_url:
                    print(f"  Updating webhook URL...")
                    update_payload = {
                        "webhook_event_url": webhook_url,
                        "webhook_api_version": "2",
                    }
                    _request_json("PATCH", f"{base}/call_control_applications/{app_id}", headers, update_payload)
                    print(f"  Updated!")
            else:
                raise SystemExit("Could not create or find Call Control application")
        else:
            raise
    
    # Step 2: Associate phone number with this application
    print(f"\nSTEP 2: Associating phone number {PHONE_NUMBER} with Call Control app...")
    patch_payload = {"connection_id": app_id}
    _request_json(
        "PATCH",
        f"{base}/phone_numbers/{PHONE_NUMBER}",
        headers,
        patch_payload,
    )
    print("  Done!")
    
    # Step 3: Verify
    print(f"\nSTEP 3: Verifying configuration...")
    phone_response = _request_json("GET", f"{base}/phone_numbers/{PHONE_NUMBER}", headers)
    phone_data = phone_response.get("data", {})
    
    print(f"  Phone Number: {phone_data.get('phone_number')}")
    print(f"  Connection ID: {phone_data.get('connection_id')}")
    print(f"  Connection Name: {phone_data.get('connection_name')}")
    
    if phone_data.get("connection_id") == app_id:
        print(f"\n SUCCESS!")
        print(f"  Phone number is now using Call Control Application (JSON webhooks)")
        print(f"  NOT TeXML (which requires XML responses)")
        print(f"\n  Try calling {PHONE_NUMBER} now!")
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
