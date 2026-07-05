# __tests__/test_upload_webp.py
"""Regression tests for the webp upload path in UploadingAgent.

WHY: After Phase F2, every stored image must land as `.webp` (stored_name,
s3_key, files.content_type) and body markdown must be rewritten to the webp CDN
URL. These tests mock the Supabase upload + file-record boundaries so the
codec/extension contract is verified without network or DB access.
"""

import sys
from io import BytesIO
from pathlib import Path
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, MagicMock, patch

from PIL import Image

project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

from agents.uploading_agent import UploadingAgent  # noqa: E402
from db.storage import FileMetadata  # noqa: E402


def _write_png(path: Path, size: tuple[int, int] = (64, 48)) -> None:
    """Write a small RGB PNG to disk for use as an upload source."""
    buf = BytesIO()
    Image.new("RGB", size, "orange").save(buf, format="PNG")
    path.write_bytes(buf.getvalue())


class TestUploadWebp(IsolatedAsyncioTestCase):
    """Asserts the upload pipeline normalises stored objects to webp."""

    def setUp(self) -> None:
        self.agent = UploadingAgent()
        self.context = {"user_id": 2, "categories": ["tech"], "slug": "my-post"}

    async def test_upload_images_stores_webp_name_and_key(self, ) -> None:
        """Body images get .webp stored_name/s3_key while keeping source filename."""
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "diagram.png"
            _write_png(src)

            cdn = "https://assets.example.com/bucket/2/tech/my-post/my-post-1.webp"
            mock_result = FileMetadata(
                id=1, user_id=2, folder_path="tech", slug="my-post-1",
                filename="diagram.png", ext="webp", stored_uri=cdn,
            )

            with patch(
                "db.storage.async_upload_file",
                new=AsyncMock(return_value=mock_result),
            ):
                result = await self.agent._upload_images(
                    [{"local_path": str(src), "alt": "d"}], None, self.context
                )

        img = result["data"]["images"][0]
        self.assertEqual(img["stored_name"], "my-post-1.webp")
        self.assertTrue(img["s3_key"].endswith("/my-post-1.webp"))
        # Source filename preserved so markdown matching still works.
        self.assertEqual(img["original_filename"], "diagram.png")
        self.assertEqual(img["s3_url"], cdn)

    def test_replace_content_urls_rewrites_to_webp_cdn(self) -> None:
        """Markdown body image is rewritten to the webp CDN URL."""
        cdn = "https://assets.example.com/bucket/2/tech/my-post/my-post-1.webp"
        content = "Intro\n\n![diagram](./images/diagram.png)\n"
        images = [
            {
                "local_path": "./images/diagram.png",
                "original_filename": "diagram.png",
                "stored_name": "my-post-1.webp",
                "s3_key": "2/tech/my-post/my-post-1.webp",
                "s3_url": cdn,
            }
        ]

        new_content, updated = self.agent._replace_content_urls(content, images, None)

        self.assertIn(f"![diagram]({cdn})", new_content)
        self.assertNotIn("./images/diagram.png", new_content)
        self.assertEqual(updated[0]["cdn_url"], cdn)

    async def test_save_file_records_persists_webp_content_type(self) -> None:
        """files row records ext=webp / content_type=image/webp from stored_name."""
        captured: dict = {}

        async def _capture(**kwargs: object) -> int:
            captured.update(kwargs)
            return 999

        fake_repo = MagicMock()
        fake_repo.upsert_file_record = AsyncMock(side_effect=_capture)

        images = [
            {
                "local_path": "./images/diagram.png",
                "original_filename": "diagram.png",
                "stored_name": "my-post-1.webp",
                "s3_key": "2/tech/my-post/my-post-1.webp",
                "s3_url": "https://assets.example.com/bucket/2/tech/my-post/my-post-1.webp",
            }
        ]

        with patch(
            "db.repositories.file.FileRepository", return_value=fake_repo
        ):
            file_ids = await self.agent._save_file_records(
                session=MagicMock(), post_id=123, images=images,
                thumbnail=None, user_id=1,
            )

        self.assertEqual(file_ids, [999])
        self.assertEqual(captured["ext"], "webp")
        self.assertEqual(captured["content_type"], "image/webp")
        self.assertEqual(captured["stored_name"], "my-post-1.webp")
