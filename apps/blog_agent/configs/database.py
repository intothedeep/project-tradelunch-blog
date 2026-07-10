# configs/database.py
"""
Database Configuration

PostgreSQL connection resolved purely from the Supabase ↔ Vercel integration env
vars (POSTGRES_*); there is NO DATABASE_URL* fallback. blog_agent runs as an
asyncpg CLI and PREFERS the DIRECT (non-pooling) connection: it issues long-lived,
multi-statement sessions that the PgBouncer transaction pooler does not suit.

Resolution precedence (first non-empty wins):
    1. POSTGRES_URL_NON_POOLING  — direct (port 5432)  [preferred]
    2. POSTGRES_URL              — pooled (port 6543)  [fallback]

POSTGRES_PRISMA_URL is intentionally ignored: it is Prisma-only and carries
`?pgbouncer=true&connect_timeout=...`, which breaks node-pg/asyncpg.
The discrete POSTGRES_USER/HOST/PASSWORD/DATABASE vars are likewise ignored —
redundant with the URLs and never assembled into a DSN here.

The TS server connects to Supabase with `rejectUnauthorized: false`; this module
mirrors that by stripping incompatible query params from the resolved URL and
letting the connection layer (db/connection.py) attach a non-verifying SSL context.
asyncpg forwards unrecognized DSN query params as server settings, so `sslmode`,
`pgbouncer`, and `connect_timeout` are all stripped (otherwise asyncpg raises
`unrecognized configuration parameter`).

Invariants:
- DATABASE_URL holds the RESOLVED connection URL (POSTGRES_* names above, in order).
- No DB_PG_* / EC2_* / RDS-CA logic.
Side effects: none (pure env read + string transforms).
"""

import os
from urllib.parse import urlparse, urlunparse

# ==================== PostgreSQL Database ====================
# Direct (non-pooling) connection preferred; pooled is fallback only.
# Example direct: postgresql://postgres.<ref>:<pw>@aws-[0|1..]-<region>.pooler.supabase.com:5432/postgres
# Example pooled: postgresql://postgres.<ref>:<pw>@aws-[0|1..]-<region>.pooler.supabase.com:6543/postgres

# Query-param keys that node-pg/asyncpg cannot accept (case-insensitive).
_INCOMPATIBLE_PARAMS = {"sslmode", "pgbouncer", "connect_timeout"}


def _resolve_database_url() -> str:
    """Resolve the connection URL from the POSTGRES_* env var names.

    Picks the first non-empty value, preferring the DIRECT (non-pooling)
    connection because blog_agent uses long-lived asyncpg sessions.

    Returns:
        The first non-empty connection URL, or "" if none are set.
    """
    for name in (
        "POSTGRES_URL_NON_POOLING",
        "POSTGRES_URL",
    ):
        value = os.getenv(name, "")
        if value:
            return value
    return ""


# Resolved connection URL (exported symbol kept as DATABASE_URL for compatibility).
DATABASE_URL = _resolve_database_url()


def _strip_incompatible_params(url: str) -> str:
    """Remove query params asyncpg/node-pg reject so the SSL context wins.

    Drops any `key=value` token whose key (case-insensitive) is in
    ``_INCOMPATIBLE_PARAMS`` (``sslmode``, ``pgbouncer``, ``connect_timeout``);
    all other params are preserved. asyncpg forwards unknown DSN query params as
    server settings, so leaving these in raises `unrecognized configuration
    parameter`.

    Args:
        url: Raw connection URL.

    Returns:
        URL with incompatible query parameters removed (other params kept).
    """
    parts = urlparse(url)
    if not parts.query:
        return url
    kept = [
        kv
        for kv in parts.query.split("&")
        if kv and kv.split("=", 1)[0].lower() not in _INCOMPATIBLE_PARAMS
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
    """Build the SQLAlchemy connection URL from the resolved Postgres URL.

    Args:
        async_driver: Use asyncpg (True) or psycopg2 (False).

    Returns:
        Driver-qualified PostgreSQL connection URL with incompatible query
        params (`sslmode`, `pgbouncer`, `connect_timeout`) stripped.

    Raises:
        ValueError: If neither POSTGRES_URL_NON_POOLING nor POSTGRES_URL is set.
    """
    if not DATABASE_URL:
        raise ValueError(
            "No database URL set; provide one of "
            "POSTGRES_URL_NON_POOLING or POSTGRES_URL"
        )
    driver = "postgresql+asyncpg" if async_driver else "postgresql+psycopg2"
    return _with_driver(_strip_incompatible_params(DATABASE_URL), driver)
