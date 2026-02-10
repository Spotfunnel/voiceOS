import base64
import json
import time
import urllib.request
import urllib.error

ENV_PATH = r"C:\Users\leoge\OneDrive\Documents\AI Activity\Cursor\VoiceAIProduction\voice-core\.env"
REQS_URL = "http://127.0.0.1:4040/api/requests/http"


def _read_key() -> str:
    with open(ENV_PATH, "r", encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("TELNYX_API_KEY="):
                return line.strip().split("=", 1)[1]
    raise SystemExit("TELNYX_API_KEY not found")


def _latest_call_control_id() -> str:
    data = json.load(urllib.request.urlopen(REQS_URL))
    for req in data.get("requests", []):
        rid = req.get("id")
        detail = json.load(urllib.request.urlopen(f"{REQS_URL}/{rid}"))
        raw = detail.get("request", {}).get("raw", "")
        decoded = base64.b64decode(raw)
        body = decoded.split(b"\r\n\r\n", 1)[1]
        payload = json.loads(body.decode("utf-8", "ignore"))
        if payload.get("data", {}).get("event_type") != "call.initiated":
            continue
        return payload.get("data", {}).get("payload", {}).get("call_control_id")
    raise SystemExit("No call.initiated events found")


def _telnyx_request(url: str, method: str, key: str, body: bytes | None = None) -> tuple[int, str]:
    headers = {"Authorization": f"Bearer {key}", "Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, headers=headers, data=body, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, resp.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "ignore")


def main() -> None:
    key = _read_key()
    call_id = _latest_call_control_id()
    print("call_control_id", call_id)
    status_code, status_body = _telnyx_request(
        f"https://api.telnyx.com/v2/calls/{call_id}",
        "GET",
        key,
    )
    print("CALL_STATUS", status_code, status_body)
    time.sleep(0.5)
    answer_code, answer_body = _telnyx_request(
        f"https://api.telnyx.com/v2/calls/{call_id}/actions/answer",
        "POST",
        key,
        body=b"{}",
    )
    print("ANSWER", answer_code, answer_body)


if __name__ == "__main__":
    main()
