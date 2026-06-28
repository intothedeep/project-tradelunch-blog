// Purpose: authoritative server-side image normalization (functional core).
//          Decodes an arbitrary upload buffer, auto-rotates per EXIF, downscales
//          the long edge, and re-encodes to webp. This is the SECURITY boundary:
//          a decode failure is a magic-byte reject, and EXIF is stripped because
//          we do NOT call .withMetadata().
// Invariants:
//   * deterministic input → output (same buffer + opts ⇒ same result class).
//   * no network/DB I/O — buffer in, buffer out.
//   * a non-image buffer yields { ok:false, reason:'not_an_image' }.
//   * an output exceeding opts.maxBytes yields { ok:false, reason:'too_large' }.
// Side effects: none (sharp runs in-process on the buffer).
import sharp from 'sharp';

export type TTransformOptions = {
    longEdge: number;
    quality: number;
    maxBytes: number;
};

export type TTransformResult =
    | {
          ok: true;
          value: { buffer: Buffer; width: number; height: number; bytes: number };
      }
    | { ok: false; reason: 'not_an_image' | 'too_large' };

export async function transformImage(
    input: Buffer,
    opts: TTransformOptions
): Promise<TTransformResult> {
    let output;
    try {
        output = await sharp(input, { failOn: 'error' })
            .rotate()
            .resize(opts.longEdge, opts.longEdge, {
                fit: 'inside',
                withoutEnlargement: true,
            })
            .webp({ quality: opts.quality })
            .toBuffer({ resolveWithObject: true });
    } catch {
        return { ok: false, reason: 'not_an_image' };
    }

    const { data, info } = output;
    if (info.size > opts.maxBytes) {
        return { ok: false, reason: 'too_large' };
    }

    return {
        ok: true,
        value: {
            buffer: data,
            width: info.width,
            height: info.height,
            bytes: info.size,
        },
    };
}
