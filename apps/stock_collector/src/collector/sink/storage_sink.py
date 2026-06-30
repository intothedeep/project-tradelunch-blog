"""IO boundary: upsert Parquet objects into Supabase Storage (Phase 1.5).

Analytics archive ONLY (PRIVATE bucket), never serving. Uses the Storage REST
API (``POST .../storage/v1/object/{bucket}/{path}`` with ``x-upsert: true``) and
the Supabase secret key (``sb_secret_…``). Object-upsert is eventually consistent
(CDN-stale) — fine for a cold archive.

Side effects: network (HTTP). Graceful: any non-2xx / network error -> False
(the caller logs and continues; archive upload must never abort collection).
"""

from __future__ import annotations

from pathlib import Path

import requests

__all__ = ["object_key", "upload_object", "object_exists"]


def object_key(base: Path, path: Path) -> str:
    """POSIX object path relative to the archive root (pure)."""
    return path.relative_to(base).as_posix()


def upload_object(
    base_url: str,
    secret_key: str,
    bucket: str,
    object_path: str,
    data: bytes,
    *,
    timeout: int = 30,
) -> bool:
    """Upsert one object into ``bucket`` at ``object_path``. True on 2xx, else False."""
    url = f"{base_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}"
    # Supabase 2024+ keys (sb_secret_…) are NOT JWTs — the gateway needs the key in
    # the `apikey` header (Bearer alone -> 400 "Invalid Compact JWS"). Send both.
    headers = {
        "apikey": secret_key,
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/octet-stream",
        "x-upsert": "true",
    }
    try:
        resp = requests.post(url, headers=headers, data=data, timeout=timeout)
        return 200 <= resp.status_code < 300
    except requests.RequestException:
        return False


def object_exists(
    base_url: str,
    secret_key: str,
    bucket: str,
    object_path: str,
    *,
    timeout: int = 30,
) -> bool:
    """Probe whether a Storage object exists. True only on 2xx; any exception or
    non-2xx -> False (network-graceful; never raises).

    Uses the same auth headers as ``upload_object`` (apikey + Bearer).
    The Storage REST endpoint for a HEAD-check is:
    ``{base_url}/storage/v1/object/{bucket}/{object_path}``.
    """
    url = f"{base_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}"
    headers = {
        "apikey": secret_key,
        "Authorization": f"Bearer {secret_key}",
    }
    try:
        resp = requests.head(url, headers=headers, timeout=timeout)
        return 200 <= resp.status_code < 300
    except requests.RequestException:
        return False
