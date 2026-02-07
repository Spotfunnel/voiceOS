#!/usr/bin/env python
"""Quick script to check if any tenants exist in the database."""

import sys
sys.path.insert(0, '.')

from src.database.db_service import get_db_service
import psycopg2.extras

db = get_db_service()
conn = db.get_connection()
try:
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    # First check what columns exist
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'tenant_onboarding_settings'")
    columns = [row['column_name'] for row in cur.fetchall()]
    print(f"Available columns: {', '.join(columns)}\n")
    
    cur.execute('SELECT tenant_id, system_prompt FROM tenant_onboarding_settings LIMIT 10')
    rows = cur.fetchall()
    
    if rows:
        print(f"Found {len(rows)} tenant(s):\n")
        for row in rows:
            print(f"  Tenant ID: {row['tenant_id']}")
            print(f"  Has Prompt: {'Yes' if row.get('system_prompt') else 'No'}")
            print()
    else:
        print("No tenants found in database.")
        print("\nYou need to create a tenant/agent before testing calls.")
    
    cur.close()
except Exception as e:
    print(f"Error: {e}")
finally:
    db.put_connection(conn)
