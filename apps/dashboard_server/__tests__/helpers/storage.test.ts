// Unit tests for the storage module pure functions and OciS3Provider upsert logic.
// No live buckets — S3Client is fully mocked.
import { buildPublicUrl } from '../../src/lib/storage/publicUrl';
import { OciS3Provider } from '../../src/lib/storage/ociS3Provider';
import {
    S3Client,
    HeadObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';

jest.mock('@aws-sdk/client-s3', () => {
    const mockSend = jest.fn();
    return {
        S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
        PutObjectCommand: jest.fn(),
        DeleteObjectCommand: jest.fn(),
        HeadObjectCommand: jest.fn(),
    };
});

function getMockSend(): jest.Mock {
    // Access the send mock on the first S3Client instance constructed.
    const MockS3 = S3Client as jest.MockedClass<typeof S3Client>;
    return MockS3.mock.results[MockS3.mock.results.length - 1]?.value
        .send as jest.Mock;
}

// ---------------------------------------------------------------------------
// buildPublicUrl — pure function
// ---------------------------------------------------------------------------

describe('buildPublicUrl', () => {
    it('joins cdnBase and key with no double slashes', () => {
        expect(
            buildPublicUrl('https://blog-assets.prettylog.com', 'user/img.webp')
        ).toBe('https://blog-assets.prettylog.com/user/img.webp');
    });

    it('strips trailing slash(es) from cdnBase before joining', () => {
        expect(
            buildPublicUrl('https://blog-assets.prettylog.com/', 'a/b.webp')
        ).toBe('https://blog-assets.prettylog.com/a/b.webp');
    });

    it('strips multiple trailing slashes from cdnBase', () => {
        expect(
            buildPublicUrl('https://blog-assets.prettylog.com///', 'a/b.webp')
        ).toBe('https://blog-assets.prettylog.com/a/b.webp');
    });

    it('handles a key with a sub-path', () => {
        expect(
            buildPublicUrl('https://cdn.example.com', '2/photo-123-abc.webp')
        ).toBe('https://cdn.example.com/2/photo-123-abc.webp');
    });
});

// ---------------------------------------------------------------------------
// OciS3Provider — upsert emulation
// ---------------------------------------------------------------------------

const providerConfig = {
    endpoint: 'https://fake.compat.objectstorage.region.oraclecloud.com',
    region: 'ap-osaka-1',
    accessKeyId: 'fake-access',
    secretAccessKey: 'fake-secret',
    bucket: 'blog-assets.prettylog.com',
};

describe('OciS3Provider.put', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('upsert:false — throws when key already exists (HeadObject resolves)', async () => {
        const provider = new OciS3Provider(providerConfig);
        const mockSend = getMockSend();
        // HeadObject resolves = key exists.
        mockSend.mockResolvedValueOnce({});

        await expect(
            provider.put('user/img.webp', Buffer.from('data'), 'image/webp', {
                upsert: false,
            })
        ).rejects.toThrow('key already exists');

        expect(HeadObjectCommand).toHaveBeenCalledTimes(1);
        expect(PutObjectCommand).not.toHaveBeenCalled();
    });

    it('upsert:false — succeeds when key is absent (HeadObject throws NotFound)', async () => {
        const provider = new OciS3Provider(providerConfig);
        const mockSend = getMockSend();
        // HeadObject throws NotFound = key absent.
        const notFound = Object.assign(new Error('Not Found'), {
            name: 'NotFound',
        });
        mockSend
            .mockRejectedValueOnce(notFound) // HeadObject
            .mockResolvedValueOnce({}); // PutObject

        await expect(
            provider.put('user/img.webp', Buffer.from('data'), 'image/webp', {
                upsert: false,
            })
        ).resolves.toBeUndefined();

        expect(HeadObjectCommand).toHaveBeenCalledTimes(1);
        expect(PutObjectCommand).toHaveBeenCalledTimes(1);
    });

    it('upsert:true — skips HeadObject and calls PutObject directly', async () => {
        const provider = new OciS3Provider(providerConfig);
        const mockSend = getMockSend();
        mockSend.mockResolvedValueOnce({});

        await provider.put('user/img.webp', Buffer.from('data'), 'image/webp', {
            upsert: true,
        });

        expect(HeadObjectCommand).not.toHaveBeenCalled();
        expect(PutObjectCommand).toHaveBeenCalledTimes(1);
    });
});

describe('OciS3Provider.remove', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('resolves when DeleteObject succeeds', async () => {
        const provider = new OciS3Provider(providerConfig);
        const mockSend = getMockSend();
        mockSend.mockResolvedValueOnce({});
        await expect(provider.remove('user/img.webp')).resolves.toBeUndefined();
        expect(DeleteObjectCommand).toHaveBeenCalledTimes(1);
    });

    it('is idempotent — swallows NoSuchKey on DeleteObject', async () => {
        const provider = new OciS3Provider(providerConfig);
        const mockSend = getMockSend();
        const noSuchKey = Object.assign(new Error('NoSuchKey'), {
            name: 'NoSuchKey',
        });
        mockSend.mockRejectedValueOnce(noSuchKey);
        await expect(provider.remove('user/img.webp')).resolves.toBeUndefined();
    });

    it('re-throws non-404 errors from DeleteObject', async () => {
        const provider = new OciS3Provider(providerConfig);
        const mockSend = getMockSend();
        mockSend.mockRejectedValueOnce(new Error('AccessDenied'));
        await expect(provider.remove('user/img.webp')).rejects.toThrow(
            'AccessDenied'
        );
    });
});

describe('OciS3Provider.exists', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns true when HeadObject resolves', async () => {
        const provider = new OciS3Provider(providerConfig);
        const mockSend = getMockSend();
        mockSend.mockResolvedValueOnce({});
        await expect(provider.exists('user/img.webp')).resolves.toBe(true);
    });

    it('returns false when HeadObject throws NotFound', async () => {
        const provider = new OciS3Provider(providerConfig);
        const mockSend = getMockSend();
        const notFound = Object.assign(new Error('Not Found'), {
            name: 'NotFound',
        });
        mockSend.mockRejectedValueOnce(notFound);
        await expect(provider.exists('user/img.webp')).resolves.toBe(false);
    });
});
