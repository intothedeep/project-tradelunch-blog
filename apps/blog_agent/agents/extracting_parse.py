"""
Markdown parsing and asset-discovery helpers for ExtractingAgent.

Pure / IO-minimal functions:
- _parse_markdown        : reads one file, returns dict (IO at boundary)
- _map_status            : pure enum mapping
- _extract_title_from_content : pure string scan
- _extract_categories_from_path : reads filesystem metadata only
- _detect_article_assets : reads directory listing only
- _extract_images        : pure regex scan of content string
- _excerpt_from_content  : pure text transformation
"""

import os
import re
from pathlib import Path
from typing import Any

import frontmatter

from schema import PostStatusEnum


def parse_markdown(file_path: str) -> dict[str, Any]:
    """
    마크다운 파일 파싱 (frontmatter 기반).

    Extracts metadata from YAML frontmatter and returns data compatible
    with PostSchema. Supports fields: title, userId, tags, desc, date,
    author, status, priority.

    Args:
        file_path: Absolute or relative path to the .md file.

    Returns:
        Dict with keys: file_path, title, user_id, username, description,
        status, author, date, tags, category, content, raw_frontmatter,
        priority.
    """
    with open(file_path, encoding="utf-8") as f:
        post = frontmatter.load(f)

    metadata = post.metadata
    title = metadata.get("title", extract_title_from_content(post.content))

    try:
        priority = int(metadata.get("priority", 100))
    except (TypeError, ValueError):
        priority = 100

    return {
        "file_path": file_path,
        "title": title,
        "user_id": metadata.get("userId", 1),
        "username": metadata.get("username", ""),
        "description": metadata.get("desc", ""),
        "status": map_status(metadata.get("status")),
        "author": metadata.get("author") or metadata.get("username", "Unknown"),
        "date": metadata.get("date", ""),
        "tags": metadata.get("tags", []),
        "category": metadata.get("category", ""),
        "content": post.content,
        "raw_frontmatter": metadata,
        "priority": priority,
    }


def map_status(status_value: Any) -> str:
    """
    Map frontmatter status to PostStatusEnum values.

    SQL Schema: CREATE TYPE post_status_enum AS ENUM ('public', 'private', 'follower');

    Supported frontmatter formats:
    1. String (recommended): status: 'public', status: 'private', status: 'follower'
    2. Boolean (backward compat): status: true (-> 'public'), status: false (-> 'private')
    3. Missing/None: defaults to 'public'

    Args:
        status_value: Value from frontmatter (str, bool, or None)

    Returns:
        One of: 'public', 'private', 'follower' (matches PostStatusEnum)

    Examples:
        >>> map_status('public')    # 'public'
        >>> map_status('private')   # 'private'
        >>> map_status('follower')  # 'follower'
        >>> map_status(True)        # 'public'
        >>> map_status(False)       # 'private'
        >>> map_status(None)        # 'public' (default)
        >>> map_status('invalid')   # 'public' (fallback)
    """
    if status_value is None:
        return PostStatusEnum.PUBLIC

    if isinstance(status_value, bool):
        return PostStatusEnum.PUBLIC if status_value else PostStatusEnum.PRIVATE

    status_str = str(status_value).lower().strip()
    if status_str in ["public", "private", "follower"]:
        return status_str

    return PostStatusEnum.PUBLIC


def extract_title_from_content(content: str) -> str:
    """본문에서 제목 추출 (frontmatter에 없을 경우).

    Args:
        content: Raw markdown body.

    Returns:
        First H1 heading text, or 'Untitled'.
    """
    match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return "Untitled"


def extract_categories_from_path(file_path: str) -> list[str]:
    """
    Extract category hierarchy from folder path structure.

    Folder structure convention:
        posts/category1/category2/.../categoryN/[article-slug]/[article-slug].md

    Example:
        posts/technology/ai/langchain-guide/langchain-guide.md
        -> categories: ['technology', 'ai']

    Args:
        file_path: Full path to the markdown file.

    Returns:
        List of category names (excluding the article folder itself).
    """
    from config import POSTS_DIR

    if not file_path:
        return []

    try:
        path = Path(file_path).resolve()
        article_folder = path.parent

        try:
            relative_path = article_folder.relative_to(POSTS_DIR)
            path_parts = list(relative_path.parts)
        except ValueError:
            from config import PROJECT_ROOT
            docs_dir = PROJECT_ROOT / "docs"
            try:
                relative_path = article_folder.relative_to(docs_dir)
                path_parts = list(relative_path.parts)
            except ValueError:
                return []

        # path_parts[-1] is the article folder (same name as .md file).
        # Categories are everything before that.
        return path_parts[:-1] if len(path_parts) > 1 else []

    except Exception:
        return []


def detect_article_assets(file_path: str) -> tuple[str | None, list[str]]:
    """
    Auto-detect thumbnail and content images from article folder.

    Convention:
        - Thumbnail: image with same name as article (e.g., langchain-guide.png)
        - Content images: all other images in the folder

    Args:
        file_path: Full path to the markdown file.

    Returns:
        Tuple of (thumbnail_path | None, sorted list of image paths).
    """
    if not file_path:
        return None, []

    try:
        path = Path(file_path)
        article_folder = path.parent
        article_name = path.stem

        if article_folder.name != article_name:
            return None, []

        image_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
        thumbnail: str | None = None
        images: list[str] = []

        for item in article_folder.iterdir():
            if not item.is_file():
                continue
            if item.suffix.lower() not in image_extensions:
                continue
            if item.stem == article_name:
                thumbnail = str(item)
            else:
                images.append(str(item))

        return thumbnail, sorted(images)

    except Exception:
        return None, []


def extract_images(
    content: str, base_dir: str | None = None
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    """
    본문에서 이미지 경로 추출 및 썸네일 감지.

    Detects images in markdown with ![alt](path) syntax.
    Identifies thumbnails when alt text contains "thumbnail".

    Args:
        content: Markdown content.
        base_dir: Base directory for resolving relative paths.

    Returns:
        Tuple of (list of image dicts, thumbnail dict | None).
        Each image dict: {alt, local_path, s3_url, is_thumbnail}.
    """
    pattern = r"!\[([^\]]*)\]\(([^\)]+)\)"
    matches = re.findall(pattern, content)

    images: list[dict[str, Any]] = []
    thumbnail: dict[str, Any] | None = None

    for alt, path in matches:
        if base_dir and not os.path.isabs(path):
            resolved_path = os.path.join(base_dir, path)
        else:
            resolved_path = path

        is_thumbnail = "thumbnail" in alt.lower()

        image_data: dict[str, Any] = {
            "alt": alt,
            "local_path": resolved_path,
            "s3_url": None,
            "is_thumbnail": is_thumbnail,
        }

        if is_thumbnail and thumbnail is None:
            thumbnail = image_data
        else:
            images.append(image_data)

    return images, thumbnail


def excerpt_from_content(content: str, max_len: int = 160) -> str:
    """Build a deterministic plain-text excerpt from markdown content.

    Selects the first non-empty line that is NOT a heading (``#``), image
    (``![``), fenced code block (```` ``` ````, the whole block is skipped),
    or table row (``|``), strips inline markdown (images, links, bold markers,
    backticks, stray leading hashes), normalizes whitespace, and truncates on a
    word boundary at most ``max_len`` characters with a trailing ellipsis.

    Args:
        content: Raw markdown body (frontmatter already removed).
        max_len: Maximum excerpt length before the trailing ellipsis.

    Returns:
        A plain-text excerpt, or an empty string if no suitable line exists.
    """
    in_fence = False
    for raw_line in content.splitlines():
        line = raw_line.strip()

        if line.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue

        if not line:
            continue
        if line.startswith("#") or line.startswith("![") or line.startswith("|"):
            continue

        text = re.sub(r"!\[[^\]]*\]\([^\)]*\)", "", line)
        text = re.sub(r"\[([^\]]*)\]\([^\)]*\)", r"\1", text)
        text = text.replace("**", "").replace("`", "")
        text = re.sub(r"^#+\s*", "", text)
        text = " ".join(text.split())
        if not text:
            continue

        if len(text) <= max_len:
            return text

        truncated = text[:max_len].rsplit(" ", 1)[0].rstrip()
        return f"{truncated}…"

    return ""
