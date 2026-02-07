"""
Create operator users and tenants for local testing.
Password must be provided via OPERATOR_PASSWORD env var.
"""
from __future__ import annotations

import json
import os
import uuid

import bcrypt
import psycopg2


USERS = [
    {
        "email": "spotfunnel@outlook.com",
        "first_name": "Kye",
        "last_name": "",
        "business_name": "SpotFunnel Internal Kye",
        "phone_number": "+61400000001",
    },
    {
        "email": "leo@getspotfunnel",
        "first_name": "Leo",
        "last_name": "",
        "business_name": "SpotFunnel Internal Leo",
        "phone_number": "+61400000002",
    },
]


def main() -> None:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL not set")

    password = os.getenv("OPERATOR_PASSWORD")
    if not password:
        raise SystemExit("OPERATOR_PASSWORD not set")

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    for user in USERS:
        tenant_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO tenants (
                tenant_id,
                business_name,
                phone_number,
                state,
                timezone,
                locale,
                status,
                metadata,
                created_at,
                updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            """,
            (
                tenant_id,
                user["business_name"],
                user["phone_number"],
                "NSW",
                "Australia/Sydney",
                "en-AU",
                "active",
                json.dumps({"internal": True}),
            ),
        )

        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        cur.execute(
            """
            INSERT INTO users (
                tenant_id,
                email,
                password_hash,
                first_name,
                last_name,
                role,
                email_verified,
                is_active,
                created_at,
                updated_at
            ) VALUES (%s, %s, %s, %s, %s, 'operator', TRUE, TRUE, NOW(), NOW())
            """,
            (
                tenant_id,
                user["email"],
                password_hash,
                user["first_name"],
                user["last_name"],
            ),
        )

    conn.commit()
    cur.close()
    conn.close()
    print("CREATED_OPERATOR_USERS")


if __name__ == "__main__":
    main()
