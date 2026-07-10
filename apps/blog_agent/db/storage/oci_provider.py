# db/storage/oci_provider.py
"""
OCI Object Storage provider — implements StorageProvider via boto3 S3-compat API.

WHY: OCI exposes an S3-compatible endpoint. boto3 with path-style addressing
and SigV4 works identically for both OCI and AWS S3; only env values differ
(CONTRACT.md §4 — "they differ only by env values, not by code").

upsert semantics (CONTRACT.md §3):
    upsert=True  → plain PutObject (S3 PUT overwrites silently).
    upsert=False → HeadObject first; raise KeyError if key already exists,
                   then PutObject.
"""

from typing import Any

__all__ = ["OciProvider"]


class OciProvider:
    """StorageProvider backed by boto3 S3-compatible client (OCI or AWS S3).

    Args:
        endpoint_url: S3-compatible endpoint, e.g.
            ``https://{ns}.compat.objectstorage.{region}.oraclecloud.com``.
        access_key: S3 access key id (OCI Customer Secret Key ID).
        secret_key: S3 secret access key (OCI Customer Secret Key).
        region: Region string, e.g. ``ap-osaka-1``.
        bucket: Target bucket name.
    """

    def __init__(
        self,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        region: str,
        bucket: str,
    ) -> None:
        self._bucket_name = bucket
        self._client = self._make_client(endpoint_url, access_key, secret_key, region)

    @staticmethod
    def _make_client(
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        region: str,
    ) -> Any:
        """Build a boto3 S3 client with path-style addressing and SigV4.

        Raises:
            ImportError: If boto3 is not installed.
        """
        import boto3  # lazy import so supabase-only installs don't fail
        from botocore.config import Config

        return boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                # botocore >=1.36 adds a default CRC32 checksum that uses
                # Content-Encoding: aws-chunked, which OCI's S3-compat endpoint
                # rejects ("NotImplemented: AWS chunked encoding not supported").
                # Only checksum when a request actually requires it.
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
        )

    def put(self, key: str, body: bytes, content_type: str, *, upsert: bool) -> None:
        """Upload bytes to the OCI/S3 bucket.

        When upsert=False, performs a HeadObject check first. If the key
        already exists, raises ``FileExistsError`` (CONTRACT.md §3 "emulate").

        Args:
            key: Object key inside the bucket.
            body: Raw bytes.
            content_type: MIME type.
            upsert: True to overwrite silently; False to raise on collision.

        Raises:
            FileExistsError: If upsert=False and the key already exists.
            Exception: Propagated from boto3 on other failures.
        """
        if not upsert and self.exists(key):
            raise FileExistsError(f"Object already exists at key '{key}' (upsert=False)")

        self._client.put_object(
            Bucket=self._bucket_name,
            Key=key,
            Body=body,
            ContentType=content_type,
        )

    def remove(self, key: str) -> None:
        """Delete object at key. Idempotent — S3 delete_object is a no-op if absent.

        Args:
            key: Object key.
        """
        self._client.delete_object(Bucket=self._bucket_name, Key=key)

    def exists(self, key: str) -> bool:
        """Check existence via HeadObject.

        Args:
            key: Object key.

        Returns:
            True if the object exists, False on 404.

        Raises:
            Exception: Re-raised for non-404 errors (permissions, network, etc.).
        """
        from botocore.exceptions import ClientError

        try:
            self._client.head_object(Bucket=self._bucket_name, Key=key)
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] in ("404", "NoSuchKey"):
                return False
            raise
