# configs/routes.py
"""
Reserved URL segments under /@<handle>/.

Python mirror of packages/types/src/routes.ts (RESERVED_HANDLE_SEGMENTS,
isReservedSlug). Keep both lists identical. Static folders under /@<handle>/
win over the dynamic [slug] route, so a post with one of these slugs could
never be opened.
"""

RESERVED_HANDLE_SEGMENTS: tuple[str, ...] = (
    "posts",
    "projects",
    "about",
    "resume",
    "saved",
    "logs",
)


def assert_slug_not_reserved(slug: str) -> None:
    """Raise ValueError when slug (trimmed, case-insensitive) is a reserved segment."""
    if slug.strip().lower() in RESERVED_HANDLE_SEGMENTS:
        raise ValueError(f"slug is reserved: {slug}")
