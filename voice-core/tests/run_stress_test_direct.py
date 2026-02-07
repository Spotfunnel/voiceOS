"""
Run stress test directly without HTTP, bypassing auth.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path


async def main() -> None:
    if not os.getenv("ANTHROPIC_API_KEY"):
        env_path = Path("voice-core/.env")
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set")
        return

    from src.api.stress_test import StressTestRunRequest, _stress_test_conversation

    payload = StressTestRunRequest(
        industry="HVAC",
        purpose="Stress test",
        system_prompt=(
            "You are a helpful HVAC receptionist. "
            "Answer questions about service appointments, pricing, and availability."
        ),
        knowledge_base=(
            "Service call fee: $95. "
            "Available Monday-Friday 8am-6pm. "
            "Emergency service available 24/7 at $150/hour."
        ),
        conversation_count=10,
        min_turns=5,
        max_turns=10,
    )

    tasks = [_stress_test_conversation(payload) for _ in range(payload.conversation_count)]
    results = await asyncio.gather(*tasks)
    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed
    print(f"Total: {len(results)} Passed: {passed} Failed: {failed}")


if __name__ == "__main__":
    asyncio.run(main())
