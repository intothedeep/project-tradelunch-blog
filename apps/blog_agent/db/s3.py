# db/s3.py
"""
Supabase Storage File Upload Module (S3-compatible API)

Provides async-compatible object operations for file uploads via boto3 pointed
at the Supabase Storage S3 endpoint (`endpoint_url`). Bucket: `blog-images`.

Functions:
- load_local_file: Read file from local filesystem
- upload_file_s3: Upload file to storage with metadata
- get_signed_url: Generate presigned URL for an object

Side effects: network I/O against Supabase Storage; module-level client singleton.
"""

import mimetypes
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import boto3
from botocore.config import Config as BotoConfig

# Import config - use try/except for flexibility
try:
    from config import (
        CDN_ASSET_POSTS,
        S3_BUCKET,
        S3_REGION,
        SUPABASE_S3_ACCESS_KEY_ID,
        SUPABASE_S3_ENDPOINT,
        SUPABASE_S3_SECRET_ACCESS_KEY,
    )
except ImportError:
    S3_BUCKET = os.getenv("SUPABASE_S3_BUCKET", "blog-images")
    S3_REGION = os.getenv("SUPABASE_S3_REGION", "us-east-1")
    CDN_ASSET_POSTS = os.getenv("CDN_ASSET_POSTS", "https://posts.prettylog.com")
    SUPABASE_S3_ENDPOINT = os.getenv("SUPABASE_S3_ENDPOINT", "")
    SUPABASE_S3_ACCESS_KEY_ID = os.getenv("SUPABASE_S3_ACCESS_KEY_ID", "")
    SUPABASE_S3_SECRET_ACCESS_KEY = os.getenv("SUPABASE_S3_SECRET_ACCESS_KEY", "")


# ===========================
# Storage Client (Singleton)
# ===========================

_s3_client: Any = None


def get_s3_client() -> Any:
    """Get or create the Supabase Storage (S3-compatible) client singleton.

    Targets the Supabase S3 endpoint via ``endpoint_url`` using the Supabase S3
    access keys (not AWS IAM credentials).

    Returns:
        A boto3 S3 client bound to the Supabase Storage endpoint.
    """
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=SUPABASE_S3_ENDPOINT or None,
            region_name=S3_REGION,
            aws_access_key_id=SUPABASE_S3_ACCESS_KEY_ID or None,
            aws_secret_access_key=SUPABASE_S3_SECRET_ACCESS_KEY or None,
            config=BotoConfig(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )
    return _s3_client


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
        s3_key: Object key path (set after upload)
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

    # Read file
    buffer = full_path.read_bytes()
    file_size = full_path.stat().st_size

    # Determine content type
    content_type, _ = mimetypes.guess_type(str(full_path))
    content_type = content_type or "application/octet-stream"

    return {
        "buffer": buffer,
        "content_type": content_type,
        "full_path": str(full_path),
        "file_size": file_size,
    }


def get_signed_url(key: str, expires_in: int = 3600) -> str:
    """
    Generate presigned URL for a storage object.

    Args:
        key: Object key
        expires_in: URL expiration time in seconds (default: 1 hour)

    Returns:
        Presigned URL string
    """
    client = get_s3_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": S3_BUCKET,
            "Key": key,
        },
        ExpiresIn=expires_in,
    )
    return url


def upload_file_s3(meta: FileMetadata) -> FileMetadata:
    """
    Upload file to storage with metadata.

    Key format: {user_id}/{folder_path}/{slug}/{slug}.{ext}

    Args:
        meta: FileMetadata with buffer and required fields

    Returns:
        Updated FileMetadata with s3_key, stored_name, stored_uri

    Example:
        >>> meta = FileMetadata(
        ...     id=123456,
        ...     user_id=2,
        ...     folder_path="technology/ai",
        ...     slug="my-article",
        ...     filename="cover.png",
        ...     ext="png",
        ...     buffer=file_bytes,
        ...     content_type="image/png",
        ... )
        >>> result = upload_file_s3(meta)
        >>> print(result.s3_key)  # "2/technology/ai/my-article/my-article.png"
    """
    if meta.buffer is None:
        raise ValueError("FileMetadata.buffer is required for upload")

    # Build object key
    key = f"{meta.user_id}/{meta.folder_path}/{meta.slug}/{meta.slug}.{meta.ext}"

    # Upload to storage
    client = get_s3_client()
    client.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=meta.buffer,
        ContentType=meta.content_type or "application/octet-stream",
        Metadata={
            "id": str(meta.id),
            "original_filename": meta.filename,
            "content_type": meta.content_type or "",
            "ext": meta.ext,
            "is_thumbnail": str(meta.is_thumbnail).lower(),
        },
    )

    # Update metadata with storage info
    meta.s3_key = key
    meta.stored_name = f"{meta.slug}.{meta.ext}"
    meta.stored_uri = f"{CDN_ASSET_POSTS}/{key}"

    return meta


def delete_file_s3(key: str) -> bool:
    """
    Delete file from storage.

    Args:
        key: Object key

    Returns:
        True if deleted successfully
    """
    client = get_s3_client()
    client.delete_object(Bucket=S3_BUCKET, Key=key)
    return True


def file_exists_s3(key: str) -> bool:
    """
    Check if file exists in storage.

    Args:
        key: Object key

    Returns:
        True if exists, False otherwise
    """
    client = get_s3_client()
    try:
        client.head_object(Bucket=S3_BUCKET, Key=key)
        return True
    except client.exceptions.ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        raise


# ===========================
# Async Wrappers (Optional)
# ===========================

async def async_upload_file_s3(meta: FileMetadata) -> FileMetadata:
    """
    Async wrapper for upload_file_s3.

    Uses asyncio.to_thread for non-blocking upload.
    """
    import asyncio
    return await asyncio.to_thread(upload_file_s3, meta)


async def async_load_local_file(
    base: str,
    folder_path: str,
    slug: str,
    file_ext: str,
) -> dict:
    """
    Async wrapper for load_local_file.
    """
    import asyncio
    return await asyncio.to_thread(load_local_file, base, folder_path, slug, file_ext)


async def async_get_signed_url(key: str, expires_in: int = 3600) -> str:
    """
    Async wrapper for get_signed_url.
    """
    import asyncio
    return await asyncio.to_thread(get_signed_url, key, expires_in)
