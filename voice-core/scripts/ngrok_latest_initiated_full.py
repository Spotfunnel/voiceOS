import base64
import json
import urllib.request

REQS_URL = "http://127.0.0.1:4040/api/requests/http"


def main() -> None:
    data = json.load(urllib.request.urlopen(REQS_URL))
    for req in data.get("requests", []):
        rid = req.get("id")
        detail = json.load(urllib.request.urlopen(f"{REQS_URL}/{rid}"))
        raw = detail.get("request", {}).get("raw", "")
        decoded = base64.b64decode(raw)
        body = decoded.split(b"\r\n\r\n", 1)[1]
        try:
            payload = json.loads(body.decode("utf-8", "ignore"))
        except json.JSONDecodeError:
            continue
        if payload.get("data", {}).get("event_type") != "call.initiated":
            continue
        
        # Show request
        print("=== INCOMING WEBHOOK ===")
        print(json.dumps(payload, indent=2))
        
        # Show our response
        response_raw = detail.get("response", {}).get("raw", "")
        response_decoded = base64.b64decode(response_raw).decode("utf-8", "ignore")
        response_body = response_decoded.split("\r\n\r\n", 1)[1] if "\r\n\r\n" in response_decoded else ""
        print("\n=== OUR RESPONSE ===")
        print(response_body)
        
        # Show timing
        print(f"\n=== TIMING ===")
        print(f"Duration: {detail.get('duration', 0) / 1000:.0f}ms")
        return
    print("No call.initiated events found")


if __name__ == "__main__":
    main()
