#!/usr/bin/env python3
"""
Migration Runner for Voice AI Platform
Runs SQL migration files in order from the migrations/ directory.
"""

import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from pathlib import Path
from typing import List, Tuple
import argparse

# Migration tracking table
MIGRATIONS_TABLE = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
"""


def get_db_connection(database_url: str):
    """Create database connection from DATABASE_URL."""
    try:
        conn = psycopg2.connect(database_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        return conn
    except psycopg2.Error as e:
        print(f"❌ Failed to connect to database: {e}")
        sys.exit(1)


def ensure_migrations_table(conn):
    """Create migrations tracking table if it doesn't exist."""
    with conn.cursor() as cur:
        cur.execute(MIGRATIONS_TABLE)


def get_applied_migrations(conn) -> List[str]:
    """Get list of already applied migration versions."""
    with conn.cursor() as cur:
        cur.execute("SELECT version FROM schema_migrations ORDER BY version")
        return [row[0] for row in cur.fetchall()]


def get_migration_files(migrations_dir: Path) -> List[Tuple[str, Path]]:
    """Get migration files sorted by version number."""
    migrations = []
    for file in sorted(migrations_dir.glob("*.sql")):
        # Extract version from filename (e.g., "001_initial_schema.sql" -> "001")
        version = file.stem.split("_")[0]
        migrations.append((version, file))
    return migrations


def run_migration(conn, version: str, name: str, file_path: Path):
    """Run a single migration file."""
    print(f"📦 Running migration {version}: {name}...")
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            sql = f.read()
        
        with conn.cursor() as cur:
            # Run migration in a transaction
            cur.execute("BEGIN")
            try:
                cur.execute(sql)
                # Record migration
                cur.execute(
                    "INSERT INTO schema_migrations (version, name) VALUES (%s, %s)",
                    (version, name)
                )
                cur.execute("COMMIT")
                print(f"✅ Migration {version} applied successfully")
            except Exception as e:
                cur.execute("ROLLBACK")
                raise e
                
    except Exception as e:
        print(f"❌ Failed to apply migration {version}: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Run database migrations")
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL"),
        help="PostgreSQL connection string (or set DATABASE_URL env var)"
    )
    parser.add_argument(
        "--migrations-dir",
        default=Path(__file__).parent / "migrations",
        type=Path,
        help="Directory containing migration files"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be run without executing"
    )
    
    args = parser.parse_args()
    
    if not args.database_url:
        print("❌ DATABASE_URL not provided. Set it via --database-url or DATABASE_URL env var.")
        sys.exit(1)
    
    if not args.migrations_dir.exists():
        print(f"❌ Migrations directory not found: {args.migrations_dir}")
        sys.exit(1)
    
    print(f"🔌 Connecting to database...")
    conn = get_db_connection(args.database_url)
    
    try:
        print(f"📋 Ensuring migrations table exists...")
        ensure_migrations_table(conn)
        
        applied = get_applied_migrations(conn)
        migrations = get_migration_files(args.migrations_dir)
        
        print(f"📊 Found {len(migrations)} migration(s), {len(applied)} already applied")
        
        pending = [(v, f) for v, f in migrations if v not in applied]
        
        if not pending:
            print("✅ All migrations are up to date!")
            return
        
        print(f"🚀 Applying {len(pending)} pending migration(s)...")
        
        for version, file_path in pending:
            name = file_path.stem
            if args.dry_run:
                print(f"[DRY RUN] Would run: {version} - {name}")
            else:
                run_migration(conn, version, name, file_path)
        
        print("✅ All migrations completed successfully!")
        
    finally:
        conn.close()


if __name__ == "__main__":
    main()
