import json
import os
import urllib.request
import urllib.error


ENV_PATH = r"C:\Users\leoge\OneDrive\Documents\AI Activity\Cursor\VoiceAIProduction\voice-core\.env"
PHONE_NUMBER = "+61240675354"  # Updated to the correct phone number


def _read_env_value(key: str) -> str | None:
    if not os.path.exists(ENV_PATH):
        return None
    with open(ENV_PATH, "r", encoding="utf-8") as fh:
        for line in fh:
            if line.startswith(f"{key}="):
                return line.strip().split("=", 1)[1]
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

    voice_url = f"{ngrok_url}/api/telnyx/webhook"

    print("STEP 1: Create TeXML Application")
    texml_payload = {
        "friendly_name": "voiceOS-CallControl",
        "voice_url": voice_url,
        "voice_method": "POST",
        "status_callback": voice_url,
        "status_callback_method": "POST",
    }
    texml_response = _request_json("POST", f"{base}/texml_applications", headers, texml_payload)
    print(json.dumps(texml_response, indent=2))

    app_id = (texml_response.get("data") or {}).get("id")
    if not app_id:
        raise SystemExit("TeXML application id not found in response")

    print("\nSTEP 2: TeXML App ID")
    print(app_id)

    print("\nSTEP 3: Update Phone Number")
    patch_payload = {"connection_id": app_id}
    patch_response = _request_json(
        "PATCH",
        f"{base}/phone_numbers/{PHONE_NUMBER}",
        headers,
        patch_payload,
    )
    print(json.dumps(patch_response, indent=2))

    print("\nSTEP 4: Verify Phone Number")
    get_response = _request_json("GET", f"{base}/phone_numbers/{PHONE_NUMBER}", headers)
    print(json.dumps(get_response, indent=2))


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "ignore")
        print(f"HTTPError {exc.code}: {exc.reason}")
        if body:
            print(body)
        raise
