// Purpose: TStorageProvider implementation backed by S3-compatible object stores
//          (OCI Object Storage, AWS S3, MinIO). Uses @aws-sdk/client-s3 with
//          path-style addressing for OCI compatibility.
// Invariants:
//   * put with opts.upsert=false emulates S3's missing "fail on exist" via a prior
//     HeadObject check; throws if the key already exists.
//   * put with opts.upsert=true calls PutObject directly (S3 overwrites silently).
//   * remove is idempotent — NoSuchKey on DeleteObject is silently ignored.
//   * exists: HeadObject → true; NoSuchKey → false; other errors re-thrown.
//   * Config is injected (DI) — no global env reads inside this module.
// Side effects: network I/O (S3-compatible storage endpoint).

import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
} from '@aws-sdk/client-s3';
import type { TStorageProvider } from './provider.type';

export type TOciS3ProviderConfig = {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
};

export class OciS3Provider implements TStorageProvider {
    private readonly client: S3Client;
    private readonly bucket: string;

    constructor(config: TOciS3ProviderConfig) {
        this.client = new S3Client({
            endpoint: config.endpoint,
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
            forcePathStyle: true,
            // aws-sdk-js v3 adds a default CRC32 checksum that sends
            // Content-Encoding: aws-chunked, which OCI's S3-compat endpoint
            // rejects ("NotImplemented: AWS chunked encoding not supported").
            // Only checksum when the operation actually requires it.
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
        });
        this.bucket = config.bucket;
    }

    async put(
        key: string,
        body: Buffer,
        contentType: string,
        opts: { upsert: boolean }
    ): Promise<void> {
        if (!opts.upsert) {
            // S3 has no native "fail if exists" — emulate with HeadObject.
            const alreadyExists = await this.exists(key);
            if (alreadyExists) {
                throw new Error(
                    `oci-s3 put rejected: key already exists (${key})`
                );
            }
        }
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
            })
        );
    }

    async remove(key: string): Promise<void> {
        try {
            await this.client.send(
                new DeleteObjectCommand({
                    Bucket: this.bucket,
                    Key: key,
                })
            );
        } catch (err: unknown) {
            // NoSuchKey = already absent — idempotent, swallow.
            if (isNotFoundError(err)) return;
            throw err;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            await this.client.send(
                new HeadObjectCommand({
                    Bucket: this.bucket,
                    Key: key,
                })
            );
            return true;
        } catch (err: unknown) {
            if (isNotFoundError(err)) return false;
            throw err;
        }
    }
}

function isNotFoundError(err: unknown): boolean {
    if (err instanceof Error) {
        const name = (err as Error & { name?: string }).name ?? '';
        const code = (err as Error & { Code?: string }).Code ?? '';
        return (
            name === 'NotFound' ||
            name === 'NoSuchKey' ||
            code === 'NoSuchKey' ||
            code === '404'
        );
    }
    return false;
}
