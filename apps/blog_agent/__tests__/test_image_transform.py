# __tests__/test_image_transform.py
"""Unit tests for utils.image_transform.to_webp.

WHY: Lock the Phase F transform contract (1600px fit-inside, no enlarge, no
crop, webp q80, metadata stripped, alpha preserved) so regressions surface
immediately. Fixtures are built in-memory with Pillow to keep tests hermetic.
"""

import sys
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

from utils.image_transform import NotAnImageError, to_webp  # noqa: E402


def _encode(img: Image.Image, fmt: str = "PNG", **save_kwargs) -> bytes:
    """Encode a Pillow image to raw bytes for use as a transform input."""
    buf = BytesIO()
    img.save(buf, format=fmt, **save_kwargs)
    return buf.getvalue()


def _decode(buffer: bytes) -> Image.Image:
    """Decode transform output back into a Pillow image for assertions."""
    return Image.open(BytesIO(buffer))


def test_to_webp_downscales_long_edge_to_1600_preserving_aspect() -> None:
    """A >1600px image is downscaled so the long edge is exactly 1600, uncropped."""
    src = _encode(Image.new("RGB", (3200, 1600), "red"))

    out = _decode(to_webp(src))

    assert max(out.size) == 1600
    # 3200x1600 -> 1600x800: aspect (2:1) preserved, not cropped to a square.
    assert out.size == (1600, 800)


def test_to_webp_does_not_enlarge_small_image() -> None:
    """An image below the max long edge keeps its original dimensions."""
    src = _encode(Image.new("RGB", (800, 400), "blue"))

    out = _decode(to_webp(src))

    assert out.size == (800, 400)


def test_to_webp_outputs_webp_magic_bytes() -> None:
    """Output container is WEBP (RIFF....WEBP magic bytes)."""
    src = _encode(Image.new("RGB", (100, 100), "green"))

    out = to_webp(src)

    assert out[:4] == b"RIFF"
    assert out[8:12] == b"WEBP"


def test_to_webp_preserves_alpha_for_rgba_png() -> None:
    """An RGBA PNG keeps its alpha channel in the webp output."""
    img = Image.new("RGBA", (120, 120), (255, 0, 0, 0))  # fully transparent
    src = _encode(img, "PNG")

    out = _decode(to_webp(src))

    assert out.mode in ("RGBA", "LA")
    # The transparent pixel must remain transparent after re-encode.
    assert out.convert("RGBA").getpixel((0, 0))[3] == 0


def test_to_webp_rejects_non_image_bytes() -> None:
    """Non-image input raises NotAnImageError (single typed failure)."""
    with pytest.raises(NotAnImageError):
        to_webp(b"not an image")


def test_to_webp_applies_exif_orientation_and_strips_metadata() -> None:
    """EXIF orientation is baked into pixels and no EXIF survives in output."""
    # Build a 200x100 landscape image, tag it orientation=6 (rotate 90 CW on view).
    img = Image.new("RGB", (200, 100), "white")
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation tag
    src = _encode(img, "JPEG", exif=exif)

    out_bytes = to_webp(src)
    out = _decode(out_bytes)

    # Orientation 6 means the stored 200x100 should be presented as 100x200.
    assert out.size == (100, 200)
    # Metadata stripped: no EXIF block carried into the webp output.
    assert not out.getexif()
