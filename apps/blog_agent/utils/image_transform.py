# utils/image_transform.py
"""
Image transform: resize -> webp (bytes in, bytes out).

WHY: The blog frontend (Phase F) standardises every stored image on a single
codec/size so CDN payloads stay small and predictable. This module is the pure
functional core for that transform; all filesystem and network I/O stays at the
upload boundary (agents/db layer) so this stays deterministic and unit-testable.

Standard transform (Phase F parity):
    long edge 1600px, fit-inside, never enlarge, never crop
    -> WEBP quality 80
    -> EXIF/metadata stripped (no exif=/icc_profile= on save)

Invariants:
    - input bytes -> output bytes, no side effects, no hidden state
    - aspect ratio is preserved; the image is never cropped
    - images at or below max_long_edge are never enlarged
    - orientation is normalised via EXIF before metadata is dropped
"""

from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

__all__ = ["to_webp", "NotAnImageError"]


class NotAnImageError(Exception):
    """Raised when the input buffer cannot be decoded as an image.

    WHY: callers (the upload boundary) need a single typed failure to log/skip
    non-image inputs instead of leaking Pillow-internal exception types.
    """


def _needs_alpha(img: Image.Image) -> bool:
    """Return True when the image carries transparency that must be preserved.

    Args:
        img: Source image (already orientation-normalised).

    Returns:
        True for RGBA/LA modes or palette images with a transparency entry.
    """
    if img.mode in ("RGBA", "LA"):
        return True
    return img.mode == "P" and "transparency" in img.info


def _fit_inside(img: Image.Image, max_long_edge: int) -> Image.Image:
    """Downscale so the longest edge equals max_long_edge; never enlarge/crop.

    Args:
        img: Source image.
        max_long_edge: Upper bound for the longer dimension in pixels.

    Returns:
        A resized copy when downscaling applies, else the original image.
    """
    width, height = img.size
    if max(width, height) <= max_long_edge:
        return img

    scale = max_long_edge / max(width, height)
    new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return img.resize(new_size, Image.Resampling.LANCZOS)


def to_webp(buffer: bytes, *, max_long_edge: int = 1600, quality: int = 80) -> bytes:
    """Resize an image buffer and re-encode it as metadata-stripped WEBP.

    Args:
        buffer: Raw image bytes (any Pillow-decodable format).
        max_long_edge: Maximum length of the longer edge in pixels (fit-inside).
        quality: WEBP quality (0-100); 80 matches Phase F parity.

    Returns:
        WEBP-encoded bytes with EXIF/ICC metadata dropped.

    Raises:
        NotAnImageError: When the buffer cannot be decoded as an image.

    Examples:
        >>> out = to_webp(png_bytes)
        >>> out[:4] == b"RIFF" and out[8:12] == b"WEBP"
        True
    """
    try:
        img: Image.Image = Image.open(BytesIO(buffer))
        img.load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise NotAnImageError("input buffer is not a decodable image") from exc

    # Apply EXIF orientation before we drop metadata, otherwise the visual
    # rotation encoded only in EXIF would be lost on re-encode. exif_transpose
    # returns None only when given None, so the guard is purely for the type.
    transposed = ImageOps.exif_transpose(img)
    if transposed is not None:
        img = transposed

    img = _fit_inside(img, max_long_edge)

    target_mode = "RGBA" if _needs_alpha(img) else "RGB"
    if img.mode != target_mode:
        img = img.convert(target_mode)

    out = BytesIO()
    # No exif=/icc_profile= args => metadata stripped. method=6 = best compression.
    img.save(out, format="WEBP", quality=quality, method=6)
    return out.getvalue()
