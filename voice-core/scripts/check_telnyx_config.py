"""Check and configure Telnyx phone number webhook settings."""
import json
import os
import urllib.request
import urllib.error


ENV_PATH = r"C:\Users\leoge\OneDrive\Documents\AI Activity\Cursor\VoiceAIProduction\voice-core\.env"
PHONE_NUMBER = "+61240675354"  # The actual number you're calling


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

    print(f"=== Checking Telnyx Configuration for {PHONE_NUMBER} ===\n")
    print(f"Expected webhook URL: {webhook_url}\n")

    # Step 1: Check current phone number configuration
    print("STEP 1: Checking phone number configuration...")
    try:
        phone_response = _request_json("GET", f"{base}/phone_numbers/{PHONE_NUMBER}", headers)
        phone_data = phone_response.get("data", {})
        
        connection_id = phone_data.get("connection_id")
        connection_name = phone_data.get("connection_name")
        
        print(f"  Phone Number: {phone_data.get('phone_number')}")
        print(f"  Status: {phone_data.get('status')}")
        print(f"  Connection ID: {connection_id}")
        print(f"  Connection Name: {connection_name}")
        
        if not connection_id:
            print("\n❌ ERROR: Phone number has NO connection_id!")
            print("   This is why webhooks aren't being sent.")
            print("\n   You need to:")
            print("   1. Create a Call Control Application in Telnyx Portal")
            print("   2. Associate this phone number with that application")
            return
        
        # Step 2: Check if connection is a Call Control app
        print(f"\nSTEP 2: Checking connection {connection_id}...")
        try:
            # Try to get it as a TeXML application
            app_response = _request_json("GET", f"{base}/texml_applications/{connection_id}", headers)
            app_data = app_response.get("data", {})
            
            print(f"  Application Type: TeXML/Call Control")
            print(f"  Friendly Name: {app_data.get('friendly_name')}")
            print(f"  Voice URL: {app_data.get('voice_url')}")
            print(f"  Status Callback: {app_data.get('status_callback')}")
            
            voice_url = app_data.get("voice_url")
            if voice_url == webhook_url:
                print(f"\n✅ Configuration is CORRECT!")
                print(f"   Webhook URL matches: {webhook_url}")
            else:
                print(f"\n⚠️  WARNING: Webhook URL mismatch!")
                print(f"   Expected: {webhook_url}")
                print(f"   Actual:   {voice_url}")
                print(f"\n   Do you want to update it? (This will fix the webhook)")
                
        except urllib.error.HTTPError as e:
            if e.code == 404:
                # Not a TeXML app, might be a SIP connection
                print(f"  Connection {connection_id} is not a TeXML/Call Control application")
                print(f"  It might be a SIP Connection (which doesn't support Call Control webhooks)")
                print(f"\n❌ ERROR: You need to use a Call Control Application, not a SIP Connection!")
            else:
                raise
                
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"❌ ERROR: Phone number {PHONE_NUMBER} not found in your Telnyx account!")
        else:
            raise


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "ignore")
        print(f"\nHTTPError {exc.code}: {exc.reason}")
        if body:
            print(body)
        raise
