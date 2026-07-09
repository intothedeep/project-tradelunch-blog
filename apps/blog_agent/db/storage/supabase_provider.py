# db/storage/supabase_provider.py
"""
Supabase Storage provider — implements StorageProvider via supabase-py.

WHY: Isolates Supabase-specific upload semantics (upsert header, list-based
exists) so factory and callers never reference supabase-py directly.
"""

from typing import Any

from db.storage.base import StorageProvider

__all__ = ["SupabaseProvider"]


class SupabaseProvider:
    """StorageProvider backed by native supabase-py / storage3 client.

    upsert semantics (CONTRACT.md §3):
        upsert=True  → ``{"upsert": "true"}`` header (overwrite).
        upsert=False → ``{"upsert": "false"}`` (Supabase 409s on collision).
    """

    def __init__(self, client: Any, bucket: str) -> None:
        """
        Args:
            client: Configured ``supabase.Client`` instance.
            bucket: Target bucket name.
        """
        self._client = client
        self._bucket_name = bucket

    def _bucket(self) -> Any:
        return self._client.storage.from_(self._bucket_name)

    def put(self, key: str, body: bytes, content_type: str, *, upsert: bool) -> None:
        """Upload bytes to Supabase Storage.

        Args:
            key: Object key inside the bucket.
            body: Raw bytes.
            content_type: MIME type.
            upsert: True to overwrite; False to fail on collision (409).

        Raises:
            Exception: Propagated from supabase-py on failure.
        """
        self._bucket().upload(
            key,
            body,
            {"content-type": content_type, "upsert": str(upsert).lower()},
        )

    def remove(self, key: str) -> None:
        """Delete object at key. Idempotent — supabase remove is a no-op if absent.

        Args:
            key: Object key.
        """
        self._bucket().remove([key])

    def exists(self, key: str) -> bool:
        """Check existence via parent-dir listing (no native head-object call).

        Args:
            key: Object key.

        Returns:
            True if a matching entry is found, False otherwise.
        """
        parent, _, filename = key.rpartition("/")
        entries = self._bucket().list(parent)
        return any(entry.get("name") == filename for entry in (entries or []))


# Runtime isinstance check requires the Protocol to be @runtime_checkable.
# Verify at import time only in dev — omit in prod to avoid the overhead.
def _assert_protocol_satisfied() -> None:
    assert isinstance(SupabaseProvider.__new__(SupabaseProvider), StorageProvider)  # type: ignore[arg-type]
