# db/storage/public_url.py
"""
Pure CDN URL builder — provider-agnostic.

WHY: Public URL is CDN-CNAME fronted and identical for all providers
(CONTRACT.md §2). Keeping it outside any provider ensures swapping the
backend rewrites zero `files.stored_uri` rows.
"""

__all__ = ["build_public_url"]


def build_public_url(cdn_base: str, bucket: str, key: str) -> str:
    """Build the CDN public URL for a stored object.

    Mirrors TS ``buildPublicUrl``:
        ``${cdnBase.replace(/\\/+$/,'')}/${bucket}/${key}``

    Args:
        cdn_base: CDN base URL, e.g. ``https://assets.prettylog.com``.
        bucket: Bucket name, e.g. ``blog.prettylog``.
        key: Object key inside the bucket.

    Returns:
        Full public URL string.

    Examples:
        >>> build_public_url("https://assets.prettylog.com", "blog.prettylog", "1/tech/post/post.webp")
        'https://assets.prettylog.com/blog.prettylog/1/tech/post/post.webp'
    """
    return f"{cdn_base.rstrip('/')}/{bucket}/{key}"
