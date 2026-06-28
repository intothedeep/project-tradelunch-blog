// Pure unit test for the functional-core image transform. No DB, no network —
// sharp generates a valid raster in-process so the test is deterministic.
import sharp from 'sharp';
import { transformImage } from '../../src/helpers/transformImage';

describe('transformImage', () => {
    const opts = { longEdge: 1600, quality: 80, maxBytes: 3 * 1024 * 1024 };

    it('returns ok webp output for a valid raster input', async () => {
        const png = await sharp({
            create: {
                width: 10,
                height: 10,
                channels: 3,
                background: '#fff',
            },
        })
            .png()
            .toBuffer();

        const result = await transformImage(png, opts);
        expect(result.ok).toBe(true);
        if (result.ok === false) return;

        // Output is webp (magic bytes: RIFF....WEBP).
        const head = result.value.buffer.subarray(0, 4).toString('ascii');
        const tag = result.value.buffer.subarray(8, 12).toString('ascii');
        expect(head).toBe('RIFF');
        expect(tag).toBe('WEBP');
        expect(result.value.width).toBeLessThanOrEqual(1600);
        expect(result.value.height).toBeLessThanOrEqual(1600);
        expect(result.value.bytes).toBeGreaterThan(0);
    });

    it('returns not_an_image for a non-image buffer', async () => {
        const result = await transformImage(Buffer.from('not an image'), opts);
        expect(result.ok).toBe(false);
        if (result.ok === true) return;
        expect(result.reason).toBe('not_an_image');
    });
});
