import base64
import json
import urllib.request
from datetime import datetime

REQS_URL = "http://127.0.0.1:4040/api/requests/http"


def main() -> None:
    data = json.load(urllib.request.urlopen(REQS_URL))
    print(f"Total requests: {len(data.get('requests', []))}\n")
    for req in data.get("requests", [])[:15]:
        rid = req.get("id")
        detail = json.load(urllib.request.urlopen(f"{REQS_URL}/{rid}"))
        raw = detail.get("request", {}).get("raw", "")
        decoded = base64.b64decode(raw)
        body = decoded.split(b"\r\n\r\n", 1)[1]
        try:
            payload = json.loads(body.decode("utf-8", "ignore"))
        except json.JSONDecodeError:
            print(f"  Non-JSON request: {detail.get('request', {}).get('uri', 'unknown')}")
            continue
        event_type = payload.get("data", {}).get("event_type")
        occurred_at = payload.get("data", {}).get("occurred_at", "")
        duration_ms = detail.get("duration", 0) / 1000
        print(f"{event_type:20} | occurred: {occurred_at} | duration: {duration_ms:.0f}ms")


if __name__ == "__main__":
    main()
