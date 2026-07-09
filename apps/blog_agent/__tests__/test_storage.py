# __tests__/test_storage.py
"""Unit tests for db/storage package (N2/N3 — pure functions + OCI provider).

Covers:
    - build_public_url: CDN URL construction (pure, no network).
    - build_object_key: key scheme per CONTRACT.md §6 (pure, no network).
    - OciProvider.put with upsert=False emulation (mock boto3 client):
        - key exists → FileExistsError raised before PutObject.
        - key absent  → PutObject proceeds.
    - OciProvider.exists: True on 200, False on 404, re-raise on other errors.
    - OciProvider.remove: passes through delete_object (idempotent).

WHY: These tests verify the two pure helpers and the cross-provider footgun
(CONTRACT.md §3) without live buckets or real credentials.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

from db.storage.object_key import build_object_key  # noqa: E402
from db.storage.public_url import build_public_url  # noqa: E402


# ---------------------------------------------------------------------------
# build_public_url — pure function
# ---------------------------------------------------------------------------

class TestBuildPublicUrl:
    def test_basic_url(self) -> None:
        result = build_public_url(
            "https://assets.prettylog.com",
            "blog.prettylog",
            "1/tech/ai/my-post/my-post.webp",
        )
        assert result == "https://assets.prettylog.com/blog.prettylog/1/tech/ai/my-post/my-post.webp"

    def test_strips_trailing_slash_from_cdn_base(self) -> None:
        result = build_public_url(
            "https://assets.prettylog.com///",
            "blog.prettylog",
            "key.webp",
        )
        assert result == "https://assets.prettylog.com/blog.prettylog/key.webp"

    def test_empty_cdn_base_produces_relative_url(self) -> None:
        result = build_public_url("", "blog.prettylog", "key.webp")
        assert result == "/blog.prettylog/key.webp"

    def test_key_with_nested_path(self) -> None:
        result = build_public_url(
            "https://cdn.example.com",
            "my-bucket",
            "a/b/c/d.webp",
        )
        assert result == "https://cdn.example.com/my-bucket/a/b/c/d.webp"


# ---------------------------------------------------------------------------
# build_object_key — pure function
# ---------------------------------------------------------------------------

class TestBuildObjectKey:
    def test_thumbnail_key_no_index(self) -> None:
        key = build_object_key(1, "tech/ai", "my-post")
        assert key == "1/tech/ai/my-post/my-post.webp"

    def test_body_image_key_with_index(self) -> None:
        key = build_object_key(1, "tech/ai", "my-post", index=2)
        assert key == "1/tech/ai/my-post/my-post-2.webp"

    def test_first_body_image_index_1(self) -> None:
        key = build_object_key(42, "cats", "funny-cat", index=1)
        assert key == "42/cats/funny-cat/funny-cat-1.webp"

    def test_empty_folder_path(self) -> None:
        key = build_object_key(1, "", "my-post")
        assert key == "1/my-post/my-post.webp"

    def test_user_id_as_string(self) -> None:
        key = build_object_key("99", "tech", "slug")
        assert key == "99/tech/slug/slug.webp"

    def test_no_double_slash_when_folder_path_has_leading_slash(self) -> None:
        key = build_object_key(1, "/tech/ai", "slug")
        assert "//" not in key
        assert key == "1/tech/ai/slug/slug.webp"


# ---------------------------------------------------------------------------
# OciProvider — upsert=False emulation + exists + remove
# ---------------------------------------------------------------------------

def _make_oci_provider(mock_client: MagicMock):
    """Build an OciProvider with an injected mock boto3 client."""
    from db.storage.oci_provider import OciProvider

    provider = OciProvider.__new__(OciProvider)
    provider._bucket_name = "test-bucket"
    provider._client = mock_client
    return provider


class TestOciProviderUpsert:
    def _client_with_head(self, *, key_exists: bool) -> MagicMock:
        """Return a mock boto3 client whose head_object behaves as specified."""
        from botocore.exceptions import ClientError

        client = MagicMock()
        if key_exists:
            client.head_object.return_value = {"ContentLength": 100}
        else:
            err = ClientError(
                {"Error": {"Code": "404", "Message": "Not Found"}},
                "HeadObject",
            )
            client.head_object.side_effect = err
        return client

    def test_upsert_true_skips_head_and_calls_put_object(self) -> None:
        client = MagicMock()
        provider = _make_oci_provider(client)

        provider.put("some/key.webp", b"data", "image/webp", upsert=True)

        client.head_object.assert_not_called()
        client.put_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="some/key.webp",
            Body=b"data",
            ContentType="image/webp",
        )

    def test_upsert_false_raises_when_key_exists(self) -> None:
        client = self._client_with_head(key_exists=True)
        provider = _make_oci_provider(client)

        with pytest.raises(FileExistsError, match="upsert=False"):
            provider.put("existing/key.webp", b"data", "image/webp", upsert=False)

        client.put_object.assert_not_called()

    def test_upsert_false_proceeds_when_key_absent(self) -> None:
        client = self._client_with_head(key_exists=False)
        provider = _make_oci_provider(client)

        provider.put("new/key.webp", b"data", "image/webp", upsert=False)

        client.put_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="new/key.webp",
            Body=b"data",
            ContentType="image/webp",
        )


class TestOciProviderExists:
    def test_returns_true_when_head_succeeds(self) -> None:
        client = MagicMock()
        client.head_object.return_value = {"ContentLength": 10}
        provider = _make_oci_provider(client)

        assert provider.exists("some/key.webp") is True

    def test_returns_false_on_404(self) -> None:
        from botocore.exceptions import ClientError

        client = MagicMock()
        client.head_object.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}}, "HeadObject"
        )
        provider = _make_oci_provider(client)

        assert provider.exists("missing/key.webp") is False

    def test_reraises_non_404_errors(self) -> None:
        from botocore.exceptions import ClientError

        client = MagicMock()
        client.head_object.side_effect = ClientError(
            {"Error": {"Code": "403", "Message": "Forbidden"}}, "HeadObject"
        )
        provider = _make_oci_provider(client)

        with pytest.raises(ClientError):
            provider.exists("some/key.webp")


class TestOciProviderRemove:
    def test_calls_delete_object(self) -> None:
        client = MagicMock()
        provider = _make_oci_provider(client)

        provider.remove("some/key.webp")

        client.delete_object.assert_called_once_with(
            Bucket="test-bucket", Key="some/key.webp"
        )
