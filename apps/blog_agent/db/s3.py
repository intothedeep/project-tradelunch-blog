# db/s3.py
"""
AWS S3 File Upload Module

Provides async-compatible S3 operations for file uploads.
Translates TypeScript upload_image.ts logic to Python.

Functions:
- load_local_file: Read file from local filesystem
- upload_file_s3: Upload file to S3 with metadata
- get_signed_url: Generate presigned URL for S3 object
"""

import os
import mimetypes
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig

# Import config - use try/except for flexibility
try:
    from config import S3_BUCKET, S3_REGION, CDN_ASSET_POSTS
except ImportError:
    import os
    S3_BUCKET = os.getenv("S3_BUCKET", "my-blog-bucket")
    S3_REGION = os.getenv("S3_REGION", "us-east-1")
    CDN_ASSET_POSTS = os.getenv("CDN_ASSET_POSTS", "https://posts.prettylog.com")


# ===========================
# S3 Client (Singleton)
# ===========================

_s3_client = None


def get_s3_client():
    """
    Get or create the S3 client singleton.
    
    Uses environment variables for AWS credentials:
    - AWS_ACCESS_KEY_ID
    - AWS_SECRET_ACCESS_KEY
    - AWS_DEFAULT_REGION (or S3_REGION from config)
    """
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            region_name=S3_REGION,
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
    File metadata for S3 upload.
    
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
        s3_key: S3 key path (set after upload)
        stored_uri: Full CDN URL (set after upload)
    """
    id: int
    user_id: int
    folder_path: str
    slug: str
    filename: str
    ext: str
    content_type: Optional[str] = None
    buffer: Optional[bytes] = None
    file_size: Optional[int] = None
    is_thumbnail: bool = False
    stored_name: Optional[str] = None
    s3_key: Optional[str] = None
    stored_uri: Optional[str] = None


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
    Generate presigned URL for S3 object.
    
    Args:
        key: S3 object key
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
    Upload file to S3 with metadata.
    
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
    
    # Build S3 key
    key = f"{meta.user_id}/{meta.folder_path}/{meta.slug}/{meta.slug}.{meta.ext}"
    
    # Upload to S3
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
    
    # Update metadata with S3 info
    meta.s3_key = key
    meta.stored_name = f"{meta.slug}.{meta.ext}"
    meta.stored_uri = f"{CDN_ASSET_POSTS}/{key}"
    
    return meta


def delete_file_s3(key: str) -> bool:
    """
    Delete file from S3.
    
    Args:
        key: S3 object key
    
    Returns:
        True if deleted successfully
    """
    client = get_s3_client()
    client.delete_object(Bucket=S3_BUCKET, Key=key)
    return True


def file_exists_s3(key: str) -> bool:
    """
    Check if file exists in S3.
    
    Args:
        key: S3 object key
    
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
