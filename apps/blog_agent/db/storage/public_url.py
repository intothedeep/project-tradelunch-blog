# db/storage/public_url.py
"""
Pure CDN URL builder — provider-agnostic.

WHY: Public URL is CDN-CNAME fronted and identical for all providers
(CONTRACT.md §2). Keeping it outside any provider ensures swapping the
backend rewrites zero `files.stored_uri` rows. Only a `CDN_ASSETS` domain
change rewrites stored_uri — a bucket rename does not.
"""

__all__ = ["build_public_url"]


def build_public_url(cdn_base: str, key: str) -> str:
    """Build the CDN public URL for a stored object.

    Mirrors TS ``buildPublicUrl``:
        ``${cdnBase.replace(/\\/+$/,'')}/${key}``

    Args:
        cdn_base: CDN base URL, e.g. ``https://blog-assets.prettylog.com``.
        key: Object key inside the bucket.

    Returns:
        Full public URL string.

    Examples:
        >>> build_public_url("https://blog-assets.prettylog.com", "1/tech/post/post.webp")
        'https://blog-assets.prettylog.com/1/tech/post/post.webp'
    """
    return f"{cdn_base.rstrip('/')}/{key}"
