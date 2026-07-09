# db/storage/object_key.py
"""
Pure object key builder — provider-agnostic.

WHY: Key scheme is defined in CONTRACT.md §6. Extracting it here keeps
providers and callers free of key-construction logic (SRP).

Key scheme (blog_agent):
    thumbnail:   {user_id}/{folder_path}/{slug}/{slug}.webp
    body image:  {user_id}/{folder_path}/{slug}/{slug}-{index}.webp
"""

__all__ = ["build_object_key"]


def build_object_key(
    user_id: int | str,
    folder_path: str,
    slug: str,
    *,
    index: int | None = None,
) -> str:
    """Build the storage object key for a blog image.

    Args:
        user_id: Owner user ID.
        folder_path: Category hierarchy path, e.g. ``technology/ai``.
                     Empty string is allowed (no category).
        slug: URL-friendly post slug.
        index: When provided, builds a body-image key (``{slug}-{index}.webp``).
               When None, builds the thumbnail key (``{slug}.webp``).

    Returns:
        Object key string without leading slash.

    Examples:
        >>> build_object_key(1, "tech/ai", "my-post")
        '1/tech/ai/my-post/my-post.webp'
        >>> build_object_key(1, "tech/ai", "my-post", index=2)
        '1/tech/ai/my-post/my-post-2.webp'
        >>> build_object_key(1, "", "my-post")
        '1/my-post/my-post.webp'
    """
    stored_name = f"{slug}-{index}.webp" if index is not None else f"{slug}.webp"

    parts = [str(user_id)]
    if folder_path:
        parts.append(folder_path.strip("/"))
    parts.append(slug)
    parts.append(stored_name)

    return "/".join(parts)
