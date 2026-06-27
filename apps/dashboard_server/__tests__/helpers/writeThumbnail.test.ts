import { parseThumbnailUrl } from '../../src/helpers/writeThumbnail';

const cfg = {
    cdnBase: 'https://assets.prettylog.com',
    bucket: 'blog.prettylog',
};

describe('parseThumbnailUrl', () => {
    it('derives key/storedName/ext/contentType from a valid CDN url', () => {
        const url =
            'https://assets.prettylog.com/blog.prettylog/42/my-image-1719475200-abc123.png';
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
                'https://assets.prettylog.com/blog.prettylog/7/a.jpg',
                cfg
            )?.contentType
        ).toBe('image/jpeg');
        expect(
            parseThumbnailUrl(
                'https://assets.prettylog.com/blog.prettylog/7/a.webp',
                cfg
            )?.contentType
        ).toBe('image/webp');
        expect(
            parseThumbnailUrl(
                'https://assets.prettylog.com/blog.prettylog/7/a.gif',
                cfg
            )?.contentType
        ).toBe('image/gif');
    });

    it('tolerates a trailing slash on cdnBase', () => {
        const url = 'https://assets.prettylog.com/blog.prettylog/9/z.png';
        expect(
            parseThumbnailUrl(url, {
                cdnBase: 'https://assets.prettylog.com/',
                bucket: 'blog.prettylog',
            })?.key
        ).toBe('9/z.png');
    });

    it('returns null for a url not under the cdnBase/bucket prefix', () => {
        expect(
            parseThumbnailUrl('https://evil.example.com/x.png', cfg)
        ).toBeNull();
        expect(
            parseThumbnailUrl(
                'https://assets.prettylog.com/other-bucket/x.png',
                cfg
            )
        ).toBeNull();
    });

    it('returns null when the prefix is present but no key follows', () => {
        expect(
            parseThumbnailUrl(
                'https://assets.prettylog.com/blog.prettylog/',
                cfg
            )
        ).toBeNull();
    });

    it('falls back to octet-stream for an unknown extension', () => {
        expect(
            parseThumbnailUrl(
                'https://assets.prettylog.com/blog.prettylog/1/x.bmp',
                cfg
            )?.contentType
        ).toBe('application/octet-stream');
    });
});
