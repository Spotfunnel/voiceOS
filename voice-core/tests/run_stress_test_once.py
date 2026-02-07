"""
Run the stress-test endpoint using a temporary admin session.
Requires an active operator/admin user in the database.
"""
from __future__ import annotations

import datetime
import hashlib
import os
import secrets
import sys

import httpx
import psycopg2


def main() -> int:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set")
        return 1

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    cur.execute(
        "SELECT user_id FROM users WHERE role IN ('operator','admin') AND is_active = true "
        "ORDER BY created_at DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        print("NO_OPERATOR_USER")
        cur.close()
        conn.close()
        return 0

    user_id = row[0]
    session_token = secrets.token_urlsafe(32)
    session_hash = hashlib.sha256(session_token.encode()).hexdigest()
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
    cur.execute(
        "INSERT INTO sessions (user_id, session_hash, expires_at) VALUES (%s, %s, %s)",
        (user_id, session_hash, expires_at),
    )
    conn.commit()
    cur.close()
    conn.close()

    body = {
        "industry": "HVAC",
        "purpose": "Stress test",
        "system_prompt": (
            "You are a helpful HVAC receptionist. "
            "Answer questions about service appointments, pricing, and availability."
        ),
        "knowledge_base": (
            "Service call fee: $95. "
            "Available Monday-Friday 8am-6pm. "
            "Emergency service available 24/7 at $150/hour."
        ),
        "conversation_count": 10,
        "min_turns": 5,
        "max_turns": 10,
    }

    try:
        response = httpx.post(
            "http://localhost:8000/api/stress-test/run",
            headers={"x-session-token": session_token},
            json=body,
            timeout=600.0,
        )
        print(response.status_code)
        print(response.text[:2000])
    finally:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE session_hash = %s", (session_hash,))
        conn.commit()
        cur.close()
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
