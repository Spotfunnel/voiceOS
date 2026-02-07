"""
Manual stress test runner for adversarial conversation testing.
Uses existing /api/stress-test/run endpoint.
"""
import asyncio
from datetime import datetime

import httpx


async def run_adversarial_stress_test() -> None:
    print("=" * 60)
    print("ADVERSARIAL STRESS TEST")
    print("=" * 60)

    tenant_id = input("Enter tenant ID to test: ").strip()
    if not tenant_id:
        print("Tenant ID is required.")
        return

    test_config = {
        "tenant_id": tenant_id,
        "num_conversations": 20,
        "industry": "HVAC",
        "system_prompt": (
            "You are a helpful HVAC receptionist. "
            "Answer questions about service appointments, pricing, and availability."
        ),
        "knowledge_base": (
            "Service call fee: $95. "
            "Available Monday-Friday 8am-6pm. "
            "Emergency service available 24/7 at $150/hour."
        ),
    }

    print(f"\nStarting test with {test_config['num_conversations']} conversations...")
    print(f"Tenant: {tenant_id}")
    print(f"Industry: {test_config['industry']}")

    start_time = datetime.now()

    async with httpx.AsyncClient(timeout=600.0) as client:
        try:
            response = await client.post(
                "http://localhost:8000/api/stress-test/run",
                json=test_config,
            )
            response.raise_for_status()
            result = response.json()
        except httpx.TimeoutException:
            print("\n❌ Test timed out (>10 minutes)")
            return
        except Exception as exc:
            print(f"\n❌ Test failed: {exc}")
            return

    duration = (datetime.now() - start_time).total_seconds()

    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)

    summary = result.get("summary", {})
    print(f"\nTotal conversations: {summary.get('total_conversations', 0)}")
    print(f"Passed: {summary.get('passed_count', 0)}")
    print(f"Failed: {summary.get('failed_count', 0)}")
    print(f"Pass rate: {summary.get('pass_rate', 0):.1f}%")
    print(f"Duration: {duration:.1f}s")

    failed_convos = [
        c
        for c in result.get("conversations", [])
        if c.get("result", {}).get("overallResult") == "FAIL"
    ]

    if failed_convos:
        print(f"\n⚠️  {len(failed_convos)} conversations failed:")
        for i, convo in enumerate(failed_convos, 1):
            print(f"\n--- Failed Conversation {i} ---")
            print("Transcript:")
            print(convo.get("transcript", "N/A"))
            print("\nReason:")
            result_obj = convo.get("result", {})
            print(f"  - Politeness: {result_obj.get('politeness', 'N/A')}")
            print(f"  - Accuracy: {result_obj.get('accuracy', 'N/A')}")
            print(f"  - Escalation: {result_obj.get('escalation', 'N/A')}")
    else:
        print("\n✅ All conversations passed!")

    print("\n" + "=" * 60)
    print("PASS CRITERIA")
    print("=" * 60)

    pass_rate = summary.get("pass_rate", 0)

    if pass_rate >= 85:
        print(f"✅ PASS: {pass_rate:.1f}% pass rate (target: ≥85%)")
    else:
        print(f"❌ FAIL: {pass_rate:.1f}% pass rate (target: ≥85%)")

    if duration < 120:
        print(f"✅ PASS: {duration:.1f}s duration (target: <120s)")
    else:
        print(f"⚠️  SLOW: {duration:.1f}s duration (target: <120s)")


if __name__ == "__main__":
    asyncio.run(run_adversarial_stress_test())
