# db/storage/__init__.py
"""
Storage package — provider-swappable object storage for blog_agent.

Stable public surface:
    get_provider()      → StorageProvider  (from factory)
    build_public_url()  → str              (from public_url)
    build_object_key()  → str              (from object_key)
    StorageProvider     → Protocol         (from base)

All other symbols (SupabaseProvider, OciProvider, _reset_provider) are
internal; import them directly from their modules when needed (e.g., tests).
"""

from db.storage.base import StorageProvider
from db.storage.factory import get_provider
from db.storage.object_key import build_object_key
from db.storage.public_url import build_public_url

__all__ = [
    "StorageProvider",
    "get_provider",
    "build_public_url",
    "build_object_key",
]
