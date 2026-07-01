"""Environment -> typed constants (loaded once at import).

Purpose: isolate all env reads behind named constants/getters so the rest of the
code depends on values, not ``os.getenv`` calls. Config precedence: env > default.

Side effects: reads process env + ``.env`` (via python-dotenv) at import.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # honor .env regardless of import order

# App root = apps/stock_collector/ (this file: src/collector/config/settings.py)
APP_ROOT = Path(__file__).resolve().parents[3]

WATCHLIST_PATH = Path(os.getenv("WATCHLIST_PATH", str(APP_ROOT / "configs" / "watchlist.yaml")))

# SEC 13F fund registry (Phase J).
FUNDS_PATH = Path(os.getenv("FUNDS_PATH", str(APP_ROOT / "configs" / "funds.yaml")))

# Yahoo polite rate limit (requests/min) — token bucket in lib.rate_limit.
YAHOO_RPM = int(os.getenv("YAHOO_RPM", "30"))


def sec_user_agent() -> str:
    """User-Agent for SEC EDGAR requests (Phase J).

    SEC's fair-access policy REQUIRES a descriptive UA declaring a contact
    ("Name email"); a missing/blank UA is the #1 cause of 403 + ~10-min IP
    blocks. Override per-deploy via ``SEC_USER_AGENT``; the default carries a
    real contact domain so dev smoke runs aren't blocked.
    """
    return os.getenv("SEC_USER_AGENT", "tradelunch-collector admin@prettylog.com")


def database_url() -> str | None:
    """Supabase SESSION-pooler DSN (read at call time). None when unset.

    Accepts the collector's own ``DATABASE_URL`` or the dashboard_server app's
    ``POSTGRES_URL_NON_POOLING`` (Vercel↔Supabase integration name) for naming
    consistency. The VALUE must be the Supavisor SESSION pooler
    (``aws-0-<region>.pooler.supabase.com:5432``) — NOT ``POSTGRES_URL`` (6543
    transaction pooler; breaks the ``-c timezone=UTC`` session option) and NOT the
    direct ``db.<ref>.supabase.co`` host (IPv6-only; fails on IPv4 GH runners).
    """
    return os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL_NON_POOLING") or None


def supabase_storage() -> tuple[str | None, str | None]:
    """(SUPABASE_URL, SUPABASE_SECRET_KEY) for the Phase-1.5 Parquet archive.

    ``SUPABASE_SECRET_KEY`` is the Supabase 2024+ secret API key (``sb_secret_…``)
    — the current replacement for the legacy ``service_role`` JWT (being phased
    out). Same server-side full-access role; matches the dashboard_server app.
    """
    url = os.getenv("SUPABASE_URL") or None
    secret_key = os.getenv("SUPABASE_SECRET_KEY") or None
    return url, secret_key


def parquet_archive_enabled() -> bool:
    """Phase-1.5 local Parquet archive toggle (default OFF until the bucket exists)."""
    return os.getenv("SHOULD_COLLECTOR_ARCHIVE_MARKET_PARQUET", "").strip().lower() in ("1", "true", "yes")


def parquet_dir() -> Path:
    """Local Parquet archive root (gitignored; CI uploads it to Storage separately)."""
    return Path(os.getenv("COLLECTOR_PARQUET_DIR", str(APP_ROOT / "data" / "parquet")))


def parquet_bucket() -> str:
    """PRIVATE Supabase Storage bucket for the Parquet archive (I1.5.1b, analytics-only)."""
    return os.getenv("COLLECTOR_MARKET_PARQUET_BUCKET") or "market-archive"


def sec_archive_enabled() -> bool:
    """Phase J raw 13F info-table archive toggle (default OFF until the bucket exists)."""
    return os.getenv("COLLECTOR_ARCHIVE_SEC", "").strip().lower() in ("1", "true", "yes")


def sec_bucket() -> str:
    """PRIVATE Supabase Storage bucket for raw 13F info-table XML (archive-only)."""
    return os.getenv("COLLECTOR_SEC_BUCKET") or "market-archive"


def sec_parquet_archive_enabled() -> bool:
    """Phase L15 13F Parquet cold-archive toggle (default OFF).

    Separate from ``sec_archive_enabled`` (raw XML). Controls whether
    run_monthly/run_backfill write holdings to local Parquet and upload to
    Storage after each fund's DB upsert. Best-effort: upload failures never
    abort collection. Enable via ``SHOULD_COLLECTOR_ARCHIVE_SEC_PARQUET=1``.
    """
    return os.getenv("SHOULD_COLLECTOR_ARCHIVE_SEC_PARQUET", "").strip().lower() in ("1", "true", "yes")


def sec_parquet_dir() -> Path:
    """Local 13F Parquet archive root (gitignored). Separate from OHLC parquet_dir."""
    return Path(
        os.getenv("COLLECTOR_SEC_PARQUET_DIR", str(APP_ROOT / "data" / "sec_parquet"))
    )


def sec_parquet_bucket() -> str:
    """PRIVATE Supabase Storage bucket for 13F Parquet files (L15, analytics-only)."""
    return os.getenv("COLLECTOR_SEC_PARQUET_BUCKET") or "sec-archive"
