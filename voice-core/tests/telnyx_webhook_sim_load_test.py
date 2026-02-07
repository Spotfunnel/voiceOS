import asyncio
import base64
import json
import time
import uuid
import audioop
from typing import Dict

import httpx

try:
    import websockets
except Exception as exc:  # pragma: no cover
    websockets = None
    _WEBSOCKETS_IMPORT_ERROR = exc
else:
    _WEBSOCKETS_IMPORT_ERROR = None


async def _send_silence_audio(ws, duration_seconds: float = 1.0, sample_rate: int = 8000):
    frame_duration_ms = 20
    samples_per_frame = int(sample_rate * (frame_duration_ms / 1000.0))
    silence_pcm = b"\x00\x00" * samples_per_frame  # 16-bit PCM silence
    ulaw = audioop.lin2ulaw(silence_pcm, 2)
    payload = base64.b64encode(ulaw).decode("utf-8")
    frame = json.dumps({"event": "media", "media": {"payload": payload}})

    frames = int(duration_seconds * 1000 / frame_duration_ms)
    for _ in range(frames):
        await ws.send(frame)
        await asyncio.sleep(frame_duration_ms / 1000.0)


async def simulate_call(call_num: int, tenant_phone: str) -> Dict:
    start_time = time.time()
    call_control_id = f"SIM-{uuid.uuid4()}"

    if websockets is None:
        return {
            "call_num": call_num,
            "status": "error",
            "error": f"websockets not installed: {_WEBSOCKETS_IMPORT_ERROR}",
            "duration": 0,
        }

    webhook_payload = {
        "data": {
            "event_type": "call.initiated",
            "payload": {
                "call_control_id": call_control_id,
                "from": "+10000000000",
                "to": tenant_phone,
                "direction": "incoming",
                "state": "ringing",
            },
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            webhook_response = await client.post(
                "http://localhost:8000/api/telnyx/webhook",
                json=webhook_payload,
            )
            if webhook_response.status_code != 200:
                return {
                    "call_num": call_num,
                    "status": "failed",
                    "error": f"Webhook failed: {webhook_response.status_code}",
                    "duration": time.time() - start_time,
                }

        ws_url = f"ws://localhost:8000/ws/media-stream/{call_control_id}"
        async with websockets.connect(ws_url) as ws:
            await _send_silence_audio(ws, duration_seconds=1.0)
            await asyncio.sleep(0.2)

        return {
            "call_num": call_num,
            "status": "success",
            "duration": time.time() - start_time,
            "call_id": call_control_id,
        }
    except Exception as exc:
        return {
            "call_num": call_num,
            "status": "error",
            "error": str(exc),
            "duration": time.time() - start_time,
        }


async def run_concurrent_webhook_sim_test(num_concurrent: int, tenant_phone: str) -> None:
    print("=" * 60)
    print(f"TELNYX WEBHOOK SIM LOAD TEST ({num_concurrent} calls)")
    print("=" * 60)
    print(f"\nTarget number: {tenant_phone}")

    tasks = [simulate_call(i + 1, tenant_phone) for i in range(num_concurrent)]
    results = await asyncio.gather(*tasks)

    successful = [r for r in results if r["status"] == "success"]
    failed = [r for r in results if r["status"] == "failed"]
    errors = [r for r in results if r["status"] == "error"]

    total_duration = sum(r["duration"] for r in results)
    avg_duration = total_duration / len(results) if results else 0

    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"\nTotal calls: {num_concurrent}")
    print(f"✅ Successful: {len(successful)}")
    print(f"❌ Failed: {len(failed)}")
    print(f"🔥 Errors: {len(errors)}")
    print(f"\nAverage call duration: {avg_duration:.2f}s")

    if failed or errors:
        print("\n⚠️  Failed/Error calls:")
        for r in failed + errors:
            print(f"  Call #{r['call_num']}: {r.get('error', 'Unknown error')}")


if __name__ == "__main__":
    asyncio.run(run_concurrent_webhook_sim_test(num_concurrent=5, tenant_phone="+61478737917"))
