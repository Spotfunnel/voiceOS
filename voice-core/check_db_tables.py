#!/usr/bin/env python
"""Check which database tables exist."""

import sys
sys.path.insert(0, '.')

from src.database.db_service import get_db_service

db = get_db_service()
conn = db.get_connection()
try:
    cur = conn.cursor()
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
    tables = [row[0] for row in cur.fetchall()]
    
    print(f"Found {len(tables)} tables:\n")
    for table in tables:
        print(f"  ✓ {table}")
    
    # Check for key tables
    required_tables = [
        'tenant_onboarding_settings',
        'call_logs',
        'sessions',
        'system_errors',
        'users'
    ]
    
    print("\nRequired tables check:")
    for table in required_tables:
        status = "✓" if table in tables else "✗"
        print(f"  {status} {table}")
    
    cur.close()
except Exception as e:
    print(f"Error: {e}")
finally:
    db.put_connection(conn)
