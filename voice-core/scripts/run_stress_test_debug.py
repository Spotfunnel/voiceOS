import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv


async def main() -> None:
    load_dotenv(".env")
    if not os.getenv("ANTHROPIC_API_KEY"):
        env_path = Path(".env")
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())

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
        conversation_count=1,
        min_turns=5,
        max_turns=10,
    )

    result = await _stress_test_conversation(payload)
    print("PASS" if result.passed else "FAIL")
    print("Failures:", result.failures)
    print("Evaluation:", result.evaluation)


if __name__ == "__main__":
    asyncio.run(main())
