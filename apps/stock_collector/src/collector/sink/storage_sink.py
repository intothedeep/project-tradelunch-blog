"""IO boundary: upsert Parquet objects into Supabase Storage (Phase 1.5).

Analytics archive ONLY (PRIVATE bucket), never serving. Uses the Storage REST
API (``POST .../storage/v1/object/{bucket}/{path}`` with ``x-upsert: true``) and
the service-role key. Object-upsert is eventually consistent (CDN-stale) — fine
for a cold archive.

Side effects: network (HTTP). Graceful: any non-2xx / network error -> False
(the caller logs and continues; archive upload must never abort collection).
"""

from __future__ import annotations

from pathlib import Path

import requests


def object_key(base: Path, path: Path) -> str:
    """POSIX object path relative to the archive root (pure)."""
    return path.relative_to(base).as_posix()


def upload_object(
    base_url: str,
    service_role: str,
    bucket: str,
    object_path: str,
    data: bytes,
    *,
    timeout: int = 30,
) -> bool:
    """Upsert one object into ``bucket`` at ``object_path``. True on 2xx, else False."""
    url = f"{base_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}"
    headers = {
        "Authorization": f"Bearer {service_role}",
        "Content-Type": "application/octet-stream",
        "x-upsert": "true",
    }
    try:
        resp = requests.post(url, headers=headers, data=data, timeout=timeout)
        return 200 <= resp.status_code < 300
    except requests.RequestException:
        return False
