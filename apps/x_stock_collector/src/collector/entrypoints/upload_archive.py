"""Entrypoint: upload the local Parquet archive to Supabase Storage (Phase 1.5).

Runs AFTER ``run_daily --archive`` in the daily workflow. BEST-EFFORT: when
``SUPABASE_URL`` / ``SUPABASE_SECRET_KEY`` are unset (bucket not provisioned
yet — I1.5.1b is a USER gate), or any object fails, it still exits 0 so the
already-succeeded daily collection is never failed by a cold-archive upload.

Side effects: filesystem read + network (delegated to sink/storage_sink).
"""

from __future__ import annotations

import sys

from collector.config.settings import parquet_bucket, parquet_dir, supabase_storage
from collector.sink.storage_sink import object_key, upload_object


def main(argv: list[str] | None = None) -> int:
    url, secret_key = supabase_storage()
    if not url or not secret_key:
        print("[upload_archive] SUPABASE_URL/SECRET_KEY unset — skip (no bucket yet)")
        return 0

    base = parquet_dir()
    if not base.exists():
        print(f"[upload_archive] no archive at {base} — nothing to upload")
        return 0

    bucket = parquet_bucket()
    files = sorted(base.rglob("*.parquet"))
    ok = 0
    for path in files:
        key = object_key(base, path)
        if upload_object(url, secret_key, bucket, key, path.read_bytes()):
            ok += 1
        else:
            print(f"[upload_archive] FAILED {key}")
    print(f"[upload_archive] uploaded {ok}/{len(files)} objects to bucket '{bucket}'")
    return 0  # best-effort: never fail the daily job on archive upload


if __name__ == "__main__":
    sys.exit(main())
