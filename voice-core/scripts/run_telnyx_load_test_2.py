import asyncio

from tests.load_test_concurrent_calls import run_concurrent_call_test


async def main() -> None:
    await run_concurrent_call_test(
        num_concurrent=2,
        tenant_id="e37f48fd-b5ec-4490-b8ea-9d5115f97d44",
        test_phone="+61478737917",
    )


if __name__ == "__main__":
    asyncio.run(main())
