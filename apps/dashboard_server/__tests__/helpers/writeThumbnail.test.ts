import { parseThumbnailUrl } from '../../src/helpers/writeThumbnail';

const cfg = {
    cdnBase: 'https://blog-assets.prettylog.com',
};

describe('parseThumbnailUrl', () => {
    it('derives key/storedName/ext/contentType from a valid CDN url', () => {
        const url =
            'https://blog-assets.prettylog.com/42/my-image-1719475200-abc123.png';
        expect(parseThumbnailUrl(url, cfg)).toEqual({
            key: '42/my-image-1719475200-abc123.png',
            storedName: 'my-image-1719475200-abc123.png',
            ext: 'png',
            contentType: 'image/png',
        });
    });

    it('maps jpg/webp/gif extensions to their mime types', () => {
        expect(
            parseThumbnailUrl(
                'https://blog-assets.prettylog.com/7/a.jpg',
                cfg
            )?.contentType
        ).toBe('image/jpeg');
        expect(
            parseThumbnailUrl(
                'https://blog-assets.prettylog.com/7/a.webp',
                cfg
            )?.contentType
        ).toBe('image/webp');
        expect(
            parseThumbnailUrl(
                'https://blog-assets.prettylog.com/7/a.gif',
                cfg
            )?.contentType
        ).toBe('image/gif');
    });

    it('tolerates a trailing slash on cdnBase', () => {
        const url = 'https://blog-assets.prettylog.com/9/z.png';
        expect(
            parseThumbnailUrl(url, {
                cdnBase: 'https://blog-assets.prettylog.com/',
            })?.key
        ).toBe('9/z.png');
    });

    it('returns null for a url not under the cdnBase prefix', () => {
        expect(
            parseThumbnailUrl('https://evil.example.com/x.png', cfg)
        ).toBeNull();
        expect(
            parseThumbnailUrl('http://blog-assets.prettylog.com/x.png', cfg)
        ).toBeNull();
    });

    it('returns null when the prefix is present but no key follows', () => {
        expect(
            parseThumbnailUrl(
                'https://blog-assets.prettylog.com/',
                cfg
            )
        ).toBeNull();
    });

    it('falls back to octet-stream for an unknown extension', () => {
        expect(
            parseThumbnailUrl(
                'https://blog-assets.prettylog.com/1/x.bmp',
                cfg
            )?.contentType
        ).toBe('application/octet-stream');
    });
});
