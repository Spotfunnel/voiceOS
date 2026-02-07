import os
import sys
from pathlib import Path
import asyncio

sys.path.insert(0, ".")

from dotenv import load_dotenv


def load_env() -> None:
    env_path = Path(".env")
    if env_path.exists():
        load_dotenv(env_path)


async def main() -> None:
    load_env()
    from tests.run_stress_test_direct import main as run

    await run()


if __name__ == "__main__":
    asyncio.run(main())
