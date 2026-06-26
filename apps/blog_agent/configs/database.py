# configs/database.py
"""
Database Configuration

Single-source PostgreSQL connection via DATABASE_URL (Supabase pooler).

The TS server connects to Supabase with `rejectUnauthorized: false`; this module
mirrors that by stripping any `sslmode` query param from DATABASE_URL and letting
the connection layer (db/connection.py) attach a non-verifying SSL context.

Invariants:
- DATABASE_URL is the only source of connection parameters.
- No DB_PG_* / EC2_* / RDS-CA logic.
Side effects: none (pure env read + string transforms).
"""

import os
from urllib.parse import urlparse, urlunparse

# ==================== PostgreSQL Database ====================
# Single connection string (Supabase pooler).
# Example: postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres
DATABASE_URL = os.getenv("DATABASE_URL", "")


def _strip_sslmode(url: str) -> str:
    """Remove any `sslmode` query param so the asyncpg SSL context wins.

    Args:
        url: Raw connection URL.

    Returns:
        URL with the `sslmode` query parameter removed (other params kept).
    """
    if "sslmode" not in url:
        return url
    parts = urlparse(url)
    kept = [
        kv
        for kv in parts.query.split("&")
        if kv and not kv.lower().startswith("sslmode=")
    ]
    return urlunparse(parts._replace(query="&".join(kept)))


def _with_driver(url: str, driver: str) -> str:
    """Force a SQLAlchemy driver scheme on a postgres URL.

    Args:
        url: Connection URL (any `postgresql*`/`postgres` scheme).
        driver: Target scheme (e.g. ``postgresql+asyncpg``).

    Returns:
        URL whose scheme is replaced with ``driver``.
    """
    parts = urlparse(url)
    return urlunparse(parts._replace(scheme=driver))


def get_database_url(async_driver: bool = True) -> str:
    """Build the SQLAlchemy connection URL from DATABASE_URL.

    Args:
        async_driver: Use asyncpg (True) or psycopg2 (False).

    Returns:
        Driver-qualified PostgreSQL connection URL with `sslmode` stripped.

    Raises:
        ValueError: If DATABASE_URL is not set.
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is required")
    driver = "postgresql+asyncpg" if async_driver else "postgresql+psycopg2"
    return _with_driver(_strip_sslmode(DATABASE_URL), driver)
