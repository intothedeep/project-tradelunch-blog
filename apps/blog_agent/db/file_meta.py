# db/file_meta.py
"""
FileMetadata domain object.

WHY: Separated from storage provider logic (SRP). FileMetadata is a domain
model describing a file pending upload; it is not a storage-provider concern.
"""

from dataclasses import dataclass

__all__ = ["FileMetadata"]


@dataclass
class FileMetadata:
    """Domain model for a file pending storage upload.

    Attributes:
        id: Snowflake ID for the file record.
        user_id: Owner user ID.
        folder_path: Category path, e.g. ``technology/ai``.
        slug: URL-friendly slug.
        filename: Original local filename.
        ext: File extension without dot (stored format, typically ``webp``).
        content_type: MIME type string.
        buffer: File bytes (required before upload).
        file_size: Size in bytes.
        is_thumbnail: True when this is the post's thumbnail image.
        stored_name: Generated storage filename (set after upload).
        s3_key: Object key path inside the bucket (set after upload).
        stored_uri: Full CDN public URL (set after upload).
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
