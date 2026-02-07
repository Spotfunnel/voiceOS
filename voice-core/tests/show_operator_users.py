"""
Print operator users and their tenant IDs.
"""
import os
import psycopg2


def main() -> None:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL not set")

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    cur.execute(
        "SELECT email, tenant_id FROM users WHERE role IN ('operator','admin') ORDER BY created_at DESC"
    )
    rows = cur.fetchall()
    for email, tenant_id in rows:
        print(f"{email} -> {tenant_id}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
