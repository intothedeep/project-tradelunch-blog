#!/usr/bin/env python
"""Ad-hoc DB connectivity check.

Runs `SELECT 1` against a Postgres DSN to confirm the connection works.

DSN resolution (first wins):
    1. CLI arg:  uv run python scripts/db_ping.py "postgresql://..."
    2. env var:  DB_PING_DSN
    3. project:  configs.database.get_database_url() (POSTGRES_URL* from .env)

Uses psycopg2 (sync) so it works against the DIRECT Supabase host without the
async engine. TLS is enabled but non-verifying, mirroring the TS server's
`rejectUnauthorized: false`.

Example:
    uv run python scripts/db_ping.py \
        "postgresql://postgres:<pwwd>@db.<ref>.supabase.co:5432/postgres"
"""

import os
import sys

import psycopg2

import configs.env  # noqa: F401  # loads .env before DSN resolution


def resolve_dsn() -> str:
    """Return the DSN from CLI arg, DB_PING_DSN, or the project's env config."""
    if len(sys.argv) > 1 and sys.argv[1].strip():
        return sys.argv[1].strip()
    env_dsn = os.getenv("DB_PING_DSN", "").strip()
    if env_dsn:
        return env_dsn
    from configs.database import get_database_url

    return get_database_url(async_driver=False).replace(
        "postgresql+psycopg2://", "postgresql://"
    )


def main() -> None:
    """Connect with the resolved DSN and print the result of SELECT 1."""
    dsn = resolve_dsn()
    conn = psycopg2.connect(dsn, sslmode="require")
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1")
        print(cur.fetchone())
    finally:
        conn.close()


if __name__ == "__main__":
    main()
