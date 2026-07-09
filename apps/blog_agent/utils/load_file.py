# utils/load_file.py
"""
Local filesystem file loader — provider-agnostic.

WHY: Filesystem I/O is a utility concern separate from storage provider logic.
Extracted from the old db/storage.py (SRP split).
"""

import mimetypes
from pathlib import Path

__all__ = ["load_local_file"]


def load_local_file(
    base: str,
    folder_path: str,
    slug: str,
    file_ext: str,
) -> dict:
    """Load a file from the local filesystem.

    Constructs the path as: ``{base}/{folder_path}/{slug}/{slug}.{file_ext}``

    Args:
        base: Base directory, e.g. ``posts``.
        folder_path: Sub-folder path, e.g. ``technology/ai``.
        slug: Article slug.
        file_ext: File extension without dot.

    Returns:
        Dict with keys: ``buffer`` (bytes), ``content_type`` (str),
        ``full_path`` (str), ``file_size`` (int).

    Raises:
        FileNotFoundError: If the constructed path does not exist.
    """
    full_path = (Path(base) / folder_path / slug / f"{slug}.{file_ext}").resolve()

    if not full_path.exists():
        raise FileNotFoundError(f"File not found: {full_path}")

    buffer = full_path.read_bytes()
    content_type, _ = mimetypes.guess_type(str(full_path))

    return {
        "buffer": buffer,
        "content_type": content_type or "application/octet-stream",
        "full_path": str(full_path),
        "file_size": full_path.stat().st_size,
    }
