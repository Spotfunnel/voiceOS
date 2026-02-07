import sys
import json

sys.path.insert(0, ".")

from src.database.db_service import get_db_service
import psycopg2.extras


def main() -> None:
    db = get_db_service()
    conn = db.get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
            """
        )
        tables = [row["tablename"] for row in cur.fetchall()]
        print("Tables:")
        print(json.dumps(tables, indent=2))

        for table in ("tenants", "objective_configs", "phone_routing", "tenant_onboarding_settings"):
            cur.execute(
                """
                SELECT column_name, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = %s
                ORDER BY ordinal_position
                """,
                (table,),
            )
            rows = cur.fetchall()
            print(f"\n{table} schema:")
            print(json.dumps(rows, indent=2))
        cur.close()
    finally:
        db.put_connection(conn)


if __name__ == "__main__":
    main()
