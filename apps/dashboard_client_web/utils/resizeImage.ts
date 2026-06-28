// utils/resizeImage.ts
// Purpose: shrink an editor image in the browser BEFORE upload so the multipart
// body stays under the Vercel 4.5MB request limit and bakes EXIF orientation.
// Invariants: never upscales (long edge capped at 2000px); always returns a
// .webp File; a non-image File is returned untouched (the server re-validates).
// Constraints: TRANSPORT-ONLY, NOT a security boundary — the server re-validates
// and re-transforms. Browser-only (uses createImageBitmap / canvas); callers
// must be "use client".

const MAX_EDGE = 2000;
const MAX_BYTES = 4 * 1024 * 1024; // 4MB headroom under Vercel's 4.5MB limit
const PRIMARY_QUALITY = 0.9;
const FALLBACK_QUALITY = 0.7;

// Encode a canvas to a webp Blob at the given quality (Promise wrapper).
function encodeWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) =>
                blob ? resolve(blob) : reject(new Error('toBlob failed')),
            'image/webp',
            quality
        );
    });
}

// Strip the extension from a filename so we can append `.webp`.
function stripExt(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
}

export async function resizeImage(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;

    const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
    });

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        bitmap.close();
        return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let blob = await encodeWebp(canvas, PRIMARY_QUALITY);
    if (blob.size > MAX_BYTES) {
        blob = await encodeWebp(canvas, FALLBACK_QUALITY);
    }

    return new File([blob], `${stripExt(file.name)}.webp`, {
        type: 'image/webp',
    });
}
