"""
Load test for concurrent voice calls.
Simulates multiple simultaneous callers to test system capacity.
"""
import asyncio
import time
from datetime import datetime
from typing import Dict

import httpx


async def simulate_call(call_num: int, tenant_id: str | None, test_phone: str) -> Dict:
    """Simulate a single call via start_call endpoint."""
    start_time = time.time()

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            payload = {
                "call_id": f"TEST-CALL-{call_num}-{int(time.time())}",
                "transport": "telnyx",
                "caller_phone": test_phone,
                "system_prompt": "SpotFunnel load test (basic pipeline)",
                "to_number": test_phone,
            }
            if tenant_id:
                payload["tenant_id"] = tenant_id
            response = await client.post(
                "http://localhost:8000/start_call",
                json=payload,
            )

            if response.status_code != 200:
                return {
                    "call_num": call_num,
                    "status": "failed",
                    "error": f"Start failed: {response.status_code}",
                    "duration": time.time() - start_time,
                }

            await asyncio.sleep(5)

            call_id = response.json().get("call_id")
            await client.post(
                "http://localhost:8000/stop_call",
                json={"call_id": call_id},
            )

            duration = time.time() - start_time

            return {
                "call_num": call_num,
                "status": "success",
                "duration": duration,
                "call_id": call_id,
            }

    except asyncio.TimeoutError:
        return {
            "call_num": call_num,
            "status": "timeout",
            "duration": time.time() - start_time,
        }
    except Exception as exc:
        return {
            "call_num": call_num,
            "status": "error",
            "error": str(exc),
            "duration": time.time() - start_time,
        }


async def run_concurrent_call_test(
    num_concurrent: int = 10,
    tenant_id: str | None = None,
    test_phone: str = "+15555551234",
) -> None:
    """Run concurrent call load test."""
    print("=" * 60)
    print(f"CONCURRENT CALL LOAD TEST ({num_concurrent} calls)")
    print("=" * 60)

    # tenant_id may be None for basic pipeline testing

    print(f"\nTenant: {tenant_id or 'basic'}")
    print(f"Concurrent calls: {num_concurrent}")
    print(f"Test phone: {test_phone}")

    start_time = datetime.now()

    print(f"\n🚀 Launching {num_concurrent} concurrent calls...")

    tasks = [
        simulate_call(i + 1, tenant_id, test_phone)
        for i in range(num_concurrent)
    ]

    results = await asyncio.gather(*tasks)

    total_duration = (datetime.now() - start_time).total_seconds()

    successful = [r for r in results if r["status"] == "success"]
    failed = [r for r in results if r["status"] == "failed"]
    timeouts = [r for r in results if r["status"] == "timeout"]
    errors = [r for r in results if r["status"] == "error"]

    avg_duration = (
        sum(r["duration"] for r in successful) / len(successful)
        if successful
        else 0
    )

    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)

    print(f"\nTotal calls: {num_concurrent}")
    print(f"✅ Successful: {len(successful)}")
    print(f"❌ Failed: {len(failed)}")
    print(f"⏱️  Timeouts: {len(timeouts)}")
    print(f"🔥 Errors: {len(errors)}")

    print(f"\nTotal test duration: {total_duration:.2f}s")
    print(f"Average call duration: {avg_duration:.2f}s")

    if failed or errors:
        print("\n⚠️  Failed/Error calls:")
        for r in failed + errors:
            print(f"  Call #{r['call_num']}: {r.get('error', 'Unknown error')}")

    print("\n" + "=" * 60)
    print("PASS CRITERIA")
    print("=" * 60)

    success_rate = len(successful) / num_concurrent * 100

    if success_rate >= 90:
        print(f"✅ PASS: {success_rate:.1f}% success rate (target: ≥90%)")
    else:
        print(f"❌ FAIL: {success_rate:.1f}% success rate (target: ≥90%)")

    if avg_duration < 10:
        print(f"✅ PASS: {avg_duration:.2f}s avg duration (target: <10s)")
    else:
        print(f"⚠️  SLOW: {avg_duration:.2f}s avg duration (target: <10s)")

    if len(timeouts) == 0:
        print("✅ PASS: No timeouts")
    else:
        print(f"❌ FAIL: {len(timeouts)} timeouts")


async def run_load_test_suite() -> None:
    """Run full load test suite with increasing concurrency."""
    tenant_input = input("Enter tenant ID (blank for basic pipeline): ").strip()
    tenant_id = tenant_input or None
    test_phone = input("Enter test phone number (default: +15555551234): ").strip() or "+15555551234"

    print("\n" + "=" * 60)
    print("LOAD TEST SUITE")
    print("=" * 60)

    test_levels = [5, 10, 20]

    for num_concurrent in test_levels:
        print(f"\n\n{'=' * 60}")
        print(f"Testing with {num_concurrent} concurrent calls")
        print("=" * 60)

        await run_concurrent_call_test(
            num_concurrent=num_concurrent,
            tenant_id=tenant_id,
            test_phone=test_phone,
        )

        if num_concurrent < test_levels[-1]:
            print("\n⏳ Resting 30s before next test...")
            await asyncio.sleep(30)

    print("\n\n" + "=" * 60)
    print("LOAD TEST SUITE COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        asyncio.run(run_concurrent_call_test(num_concurrent=int(sys.argv[1])))
    else:
        asyncio.run(run_load_test_suite())
