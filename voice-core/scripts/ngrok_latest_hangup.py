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
        if payload.get("data", {}).get("event_type") != "call.hangup":
            continue
        print(json.dumps(payload.get("data", {}).get("payload", {}), indent=2))
        return
    print("No call.hangup events found")


if __name__ == "__main__":
    main()
