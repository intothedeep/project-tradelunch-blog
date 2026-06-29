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

# Yahoo polite rate limit (requests/min) — token bucket in lib.rate_limit.
YAHOO_RPM = int(os.getenv("YAHOO_RPM", "30"))


def database_url() -> str | None:
    """Supabase session-pooler DSN (read at call time). None when unset."""
    return os.getenv("DATABASE_URL") or None


def supabase_storage() -> tuple[str | None, str | None]:
    """(SUPABASE_URL, SUPABASE_SERVICE_ROLE) for the Phase-1.5 Parquet archive."""
    return os.getenv("SUPABASE_URL") or None, os.getenv("SUPABASE_SERVICE_ROLE") or None


def parquet_archive_enabled() -> bool:
    """Phase-1.5 local Parquet archive toggle (default OFF until the bucket exists)."""
    return os.getenv("COLLECTOR_ARCHIVE_PARQUET", "").strip().lower() in ("1", "true", "yes")


def parquet_dir() -> Path:
    """Local Parquet archive root (gitignored; CI uploads it to Storage separately)."""
    return Path(os.getenv("COLLECTOR_PARQUET_DIR", str(APP_ROOT / "data" / "parquet")))


def parquet_bucket() -> str:
    """PRIVATE Supabase Storage bucket for the Parquet archive (I1.5.1b, analytics-only)."""
    return os.getenv("COLLECTOR_PARQUET_BUCKET", "market-archive")
