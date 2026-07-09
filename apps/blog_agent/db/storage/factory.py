# db/storage/factory.py
"""
Provider factory — reads STORAGE_PROVIDER env and returns a memoized instance.

WHY: Single creation point keeps provider construction side effects isolated
and prevents multiple clients from being instantiated during one process run.
"""

from db.storage.base import StorageProvider

__all__ = ["get_provider"]

_provider: StorageProvider | None = None


def get_provider() -> StorageProvider:
    """Return the process-level StorageProvider singleton.

    Provider is chosen from the ``STORAGE_PROVIDER`` env var:
        - ``supabase`` (default) → SupabaseProvider
        - ``oci`` → OciProvider (boto3 S3-compat, path-style)
        - ``s3``  → OciProvider (same class, different env values)

    Returns:
        A StorageProvider instance.

    Raises:
        ValueError: For unrecognised ``STORAGE_PROVIDER`` values.
        ImportError: If required packages (boto3 / supabase) are missing.
    """
    global _provider
    if _provider is not None:
        return _provider

    from configs.storage import (
        STORAGE_BUCKET,
        STORAGE_PROVIDER,
        SUPABASE_SECRET_KEY,
        SUPABASE_URL,
    )

    provider_name = STORAGE_PROVIDER.lower()

    if provider_name == "supabase":
        from supabase import create_client

        from db.storage.supabase_provider import SupabaseProvider

        client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
        _provider = SupabaseProvider(client=client, bucket=STORAGE_BUCKET)

    elif provider_name in ("oci", "s3"):
        from configs.storage import (
            STORAGE_ACCESS_KEY,
            STORAGE_ENDPOINT,
            STORAGE_REGION,
            STORAGE_SECRET_KEY,
        )
        from db.storage.oci_provider import OciProvider

        _provider = OciProvider(
            endpoint_url=STORAGE_ENDPOINT,
            access_key=STORAGE_ACCESS_KEY,
            secret_key=STORAGE_SECRET_KEY,
            region=STORAGE_REGION,
            bucket=STORAGE_BUCKET,
        )

    else:
        raise ValueError(
            f"Unknown STORAGE_PROVIDER '{STORAGE_PROVIDER}'. "
            "Expected 'supabase', 'oci', or 's3'."
        )

    return _provider


def _reset_provider() -> None:
    """Reset the singleton. Intended for use in tests only."""
    global _provider
    _provider = None
