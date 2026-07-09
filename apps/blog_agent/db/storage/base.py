# db/storage/base.py
"""
StorageProvider Protocol — byte-movement contract only.

WHY: Isolates the interface from any specific backend so factory + callers
never import provider implementation details. Method names mirror the TS
contract (CONTRACT.md §1): put / remove / exists.
"""

from typing import Protocol, runtime_checkable

__all__ = ["StorageProvider"]


@runtime_checkable
class StorageProvider(Protocol):
    """Byte-movement interface for object storage backends.

    All providers MUST implement exactly these three methods.
    URL building, key construction, and image transforms are caller concerns.

    Args (put):
        key: Object key (path inside bucket).
        body: Raw bytes to store.
        content_type: MIME type string.
        upsert: If True, overwrite an existing object. If False, raise on collision.

    Raises (put):
        Exception: On upload failure or upsert=False collision.
    """

    def put(self, key: str, body: bytes, content_type: str, *, upsert: bool) -> None:
        """Upload bytes to the given key."""
        ...

    def remove(self, key: str) -> None:
        """Delete the object at key. Idempotent — no-op if absent."""
        ...

    def exists(self, key: str) -> bool:
        """Return True if an object at key exists, False otherwise."""
        ...
