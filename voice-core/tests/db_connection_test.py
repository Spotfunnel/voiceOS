"""
Test database connection pool under load.
Monitors for connection leaks and pool exhaustion.
"""
import asyncio
from datetime import datetime

from src.database.db_service import get_db_service


async def test_connection_pool(num_iterations: int = 100) -> None:
    print("=" * 60)
    print(f"DATABASE CONNECTION POOL TEST ({num_iterations} iterations)")
    print("=" * 60)

    db_service = get_db_service()

    start_time = datetime.now()
    errors: list[tuple[int, str]] = []

    print(f"\n🔄 Running {num_iterations} connection acquire/release cycles...")

    for i in range(num_iterations):
        try:
            conn = db_service.get_connection()
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
            cur.close()
            db_service.put_connection(conn)

            if (i + 1) % 10 == 0:
                print(f"  Completed {i + 1}/{num_iterations} cycles...")
        except Exception as exc:
            errors.append((i, str(exc)))
            print(f"  ❌ Error on iteration {i}: {exc}")

    duration = (datetime.now() - start_time).total_seconds()

    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)

    success_count = num_iterations - len(errors)
    success_rate = success_count / num_iterations * 100

    print(f"\nTotal iterations: {num_iterations}")
    print(f"✅ Successful: {success_count}")
    print(f"❌ Failed: {len(errors)}")
    print(f"Success rate: {success_rate:.1f}%")
    print(f"Duration: {duration:.2f}s")
    print(f"Avg time per cycle: {duration/num_iterations*1000:.2f}ms")

    if errors:
        print("\n⚠️  Errors encountered:")
        for idx, error in errors[:10]:
            print(f"  Iteration {idx}: {error}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more errors")

    print("\n" + "=" * 60)
    print("PASS CRITERIA")
    print("=" * 60)

    if success_rate == 100:
        print("✅ PASS: 100% success rate")
    elif success_rate >= 95:
        print(f"⚠️  WARNING: {success_rate:.1f}% success rate (target: 100%)")
    else:
        print(f"❌ FAIL: {success_rate:.1f}% success rate (target: 100%)")


if __name__ == "__main__":
    asyncio.run(test_connection_pool(num_iterations=100))
