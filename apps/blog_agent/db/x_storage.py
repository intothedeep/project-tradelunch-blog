# db/storage.py
"""
Supabase Storage File Upload Module (native supabase-py / storage3 client)

Provides async-compatible object operations for file uploads via the native
Supabase Storage client. Bucket: `blog.prettylog`.

Public functions:
- load_local_file: Read file from local filesystem (storage-agnostic)
- upload_file: Upload file to storage (idempotent via upsert)
- get_signed_url: Generate a signed URL for an object
- delete_file: Remove an object
- file_exists: Check object existence via parent-dir listing

Invariants:
- `upload()` is made idempotent with ``upsert: "true"`` (native upload 409s on
  an existing key, unlike S3 PUT which overwrites).
- Public object URLs resolve as `${CDN_ASSETS}/<key>`, never the raw
  `*.supabase.co` path.

Side effects: network I/O against Supabase Storage; module-level client singleton.
"""

import asyncio
import mimetypes
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from supabase import Client, create_client

# Import config - use try/except for flexibility
try:
    from config import (
        CDN_ASSETS,
        SUPABASE_SECRET_KEY,
        SUPABASE_STORAGE_BUCKET,
        SUPABASE_URL,
    )
except ImportError:
    import os

    CDN_ASSETS = os.getenv("CDN_ASSETS", "https://assets.prettylog.com")
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")
    SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "blog.prettylog")


# ===========================
# Storage Client (Singleton)
# ===========================

_client: Client | None = None


def get_storage_client() -> Client:
    """Get or create the native Supabase client singleton.

    Uses the project URL + secret (service-role) key for privileged Storage
    operations.

    Returns:
        A configured supabase ``Client``.
    """
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    return _client


def _bucket() -> Any:
    """Return the configured storage bucket handle.

    Returns:
        The storage bucket API object for ``SUPABASE_STORAGE_BUCKET``.
    """
    return get_storage_client().storage.from_(SUPABASE_STORAGE_BUCKET)


# ===========================
# Data Classes
# ===========================

@dataclass
class FileMetadata:
    """
    File metadata for storage upload.

    Attributes:
        id: Snowflake ID for the file
        user_id: Owner user ID
        folder_path: Category path (e.g., "technology/ai")
        slug: URL-friendly slug
        filename: Original filename
        ext: File extension (without dot)
        content_type: MIME type
        buffer: File contents as bytes
        file_size: Size in bytes
        is_thumbnail: Whether this is a thumbnail image
        stored_name: Generated storage name (set after upload)
        s3_key: Object key path (set after upload); maps to DB files.s3_key
        stored_uri: Full CDN URL (set after upload)
    """
    id: int
    user_id: int
    folder_path: str
    slug: str
    filename: str
    ext: str
    content_type: str | None = None
    buffer: bytes | None = None
    file_size: int | None = None
    is_thumbnail: bool = False
    stored_name: str | None = None
    s3_key: str | None = None
    stored_uri: str | None = None


# ===========================
# Functions
# ===========================

def load_local_file(
    base: str,
    folder_path: str,
    slug: str,
    file_ext: str,
) -> dict:
    """
    Load file from local filesystem.

    Constructs path as: base/folder_path/slug/slug.ext

    Args:
        base: Base directory (e.g., "posts")
        folder_path: Folder path (e.g., "technology/ai")
        slug: Article slug
        file_ext: File extension without dot

    Returns:
        Dict with buffer, content_type, full_path, file_size

    Raises:
        FileNotFoundError: If file doesn't exist
    """
    full_path = Path(base) / folder_path / slug / f"{slug}.{file_ext}"
    full_path = full_path.resolve()

    if not full_path.exists():
        raise FileNotFoundError(f"File not found: {full_path}")

    buffer = full_path.read_bytes()
    file_size = full_path.stat().st_size

    content_type, _ = mimetypes.guess_type(str(full_path))
    content_type = content_type or "application/octet-stream"

    return {
        "buffer": buffer,
        "content_type": content_type,
        "full_path": str(full_path),
        "file_size": file_size,
    }


def upload_file(meta: FileMetadata) -> FileMetadata:
    """
    Upload file to Supabase Storage with idempotent upsert.

    Key format: {user_id}/{folder_path}/{slug}/{slug}.{ext}

    The native ``upload`` 409s when the key exists, so ``upsert: "true"`` is
    passed to preserve idempotent re-runs (parity with the prior S3 PUT).

    Args:
        meta: FileMetadata with buffer and required fields

    Returns:
        Updated FileMetadata with s3_key, stored_name, stored_uri

    Raises:
        ValueError: If meta.buffer is None

    Examples:
        >>> result = upload_file(meta)
        >>> result.s3_key  # "2/technology/ai/my-article/my-article.png"
    """
    if meta.buffer is None:
        raise ValueError("FileMetadata.buffer is required for upload")

    key = f"{meta.user_id}/{meta.folder_path}/{meta.slug}/{meta.slug}.{meta.ext}"
    content_type = meta.content_type or "application/octet-stream"

    _bucket().upload(
        key,
        meta.buffer,
        {"content-type": content_type, "upsert": "true"},
    )

    meta.s3_key = key
    meta.stored_name = f"{meta.slug}.{meta.ext}"
    meta.stored_uri = f"{CDN_ASSETS}/{SUPABASE_STORAGE_BUCKET}/{key}"

    return meta


def delete_file(key: str) -> bool:
    """
    Delete an object from storage.

    Args:
        key: Object key

    Returns:
        True if the remove call completed.
    """
    _bucket().remove([key])
    return True


def get_signed_url(key: str, expires_in: int = 3600) -> str:
    """
    Generate a signed URL for a storage object.

    ``create_signed_url`` returns a dict; the URL field is named ``signedURL``
    or ``signedUrl`` depending on the client version, so extract defensively.

    Args:
        key: Object key
        expires_in: URL expiration time in seconds (default: 1 hour)

    Returns:
        Signed URL string (empty string if absent from the response).
    """
    result = _bucket().create_signed_url(key, expires_in)
    if isinstance(result, dict):
        return result.get("signedURL") or result.get("signedUrl") or ""
    return str(result)


def file_exists(key: str) -> bool:
    """
    Check if an object exists in storage.

    Emulated via a listing of the object's parent directory plus a filename
    match (the native client has no head-object call).

    Args:
        key: Object key

    Returns:
        True if a matching object exists, False otherwise.
    """
    parent, _, filename = key.rpartition("/")
    entries = _bucket().list(parent)
    return any(entry.get("name") == filename for entry in entries)


# ===========================
# Async Wrappers
# ===========================

async def async_upload_file(meta: FileMetadata) -> FileMetadata:
    """Async wrapper for upload_file (non-blocking via asyncio.to_thread)."""
    return await asyncio.to_thread(upload_file, meta)


async def async_load_local_file(
    base: str,
    folder_path: str,
    slug: str,
    file_ext: str,
) -> dict:
    """Async wrapper for load_local_file."""
    return await asyncio.to_thread(load_local_file, base, folder_path, slug, file_ext)


async def async_get_signed_url(key: str, expires_in: int = 3600) -> str:
    """Async wrapper for get_signed_url."""
    return await asyncio.to_thread(get_signed_url, key, expires_in)
