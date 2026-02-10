import base64
import json
import urllib.request

REQS_URL = "http://127.0.0.1:4040/api/requests/http"


def main() -> None:
    data = json.load(urllib.request.urlopen(REQS_URL))
    found = False
    for req in data.get("requests", []):
        rid = req.get("id")
        detail = json.load(urllib.request.urlopen(f"{REQS_URL}/{rid}"))
        raw = detail.get("request", {}).get("raw", "")
        decoded = base64.b64decode(raw)
        body = decoded.split(b"\r\n\r\n", 1)[1]
        payload = json.loads(body.decode("utf-8", "ignore"))
        if payload.get("data", {}).get("event_type") != "call.initiated":
            continue
        found = True
        print("occurred_at", payload.get("data", {}).get("occurred_at"))
        print("to", payload.get("data", {}).get("payload", {}).get("to"))
        print("call_control_id", payload.get("data", {}).get("payload", {}).get("call_control_id"))
        break
    print("found", found)


if __name__ == "__main__":
    main()
