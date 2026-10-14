"""Print which DB and storage target publish_oneshot.py would use.

Purpose:
    Check the resolved publish target before writing anything. Never prints
    secret values: hosts, provider names and set/UNSET flags only.

Usage:
    uv run python scripts/check_publish_env.py
"""

import sys
from pathlib import Path
from urllib.parse import urlparse

# add blog_agent root (parent of scripts/) to sys.path so `configs` imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from configs import storage as s  # noqa: E402
from configs.database import DATABASE_URL  # noqa: E402


def host(url: str) -> str:
    """Return ``host:port`` of a URL, or ``(unset)``."""
    u = urlparse(url)
    return f"{u.hostname}:{u.port}" if u.hostname else "(unset)"


def flag(value: str) -> str:
    """Return ``set`` or ``UNSET`` without exposing the value."""
    return "set" if value else "UNSET"


def main() -> None:
    """Print the resolved DB and storage targets."""
    db = host(DATABASE_URL)
    is_local_db = db.startswith(("127.0.0.1", "localhost"))
    print(f"DB target        : {db}  -> {'LOCAL' if is_local_db else 'REMOTE (prod?)'}")
    print(f"STORAGE_PROVIDER : {s.STORAGE_PROVIDER}")
    if s.STORAGE_PROVIDER == "supabase":
        print(f"SUPABASE_URL     : {host(s.SUPABASE_URL)}")
        print(f"SUPABASE_SECRET  : {flag(s.SUPABASE_SECRET_KEY)}")
        print(f"bucket           : {s.SUPABASE_STORAGE_BUCKET}")
    else:
        print(f"STORAGE_ENDPOINT : {host(s.STORAGE_ENDPOINT)}")
        print(f"ACCESS/SECRET    : {flag(s.STORAGE_ACCESS_KEY)}/{flag(s.STORAGE_SECRET_KEY)}")
        print(f"bucket           : {s.STORAGE_BUCKET}")
    print(f"CDN_ASSETS       : {s.CDN_ASSETS}")


if __name__ == "__main__":
    main()
