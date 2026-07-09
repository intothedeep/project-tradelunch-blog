// Purpose: TStorageProvider implementation backed by Supabase Storage REST API.
//          Uses native fetch (no supabase-js) with the service-role secret key.
// Invariants:
//   * put respects opts.upsert via the x-upsert header (false = 409 on conflict).
//   * remove is idempotent — a 404 on DELETE is silently ignored.
//   * exists uses a HEAD request; 200 = true, 404 = false.
//   * Config is injected (DI) — no global env reads inside this module.
// Side effects: network I/O (Supabase Storage REST).

import type { TStorageProvider } from './provider.type';

export type TSupabaseProviderConfig = {
    supabaseUrl: string;
    secretKey: string;
    bucket: string;
};

export class SupabaseProvider implements TStorageProvider {
    private readonly base: string;
    private readonly authHeader: string;
    private readonly bucket: string;

    constructor(config: TSupabaseProviderConfig) {
        this.base = `${config.supabaseUrl}/storage/v1/object`;
        this.authHeader = `Bearer ${config.secretKey}`;
        this.bucket = config.bucket;
    }

    private objectUrl(key: string): string {
        return `${this.base}/${this.bucket}/${key}`;
    }

    async put(
        key: string,
        body: Buffer,
        contentType: string,
        opts: { upsert: boolean }
    ): Promise<void> {
        const response = await fetch(this.objectUrl(key), {
            method: 'PUT',
            headers: {
                Authorization: this.authHeader,
                'Content-Type': contentType,
                'x-upsert': String(opts.upsert),
            },
            body: new Uint8Array(body),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(
                `supabase put failed (${response.status}): ${text}`
            );
        }
    }

    async remove(key: string): Promise<void> {
        const response = await fetch(this.objectUrl(key), {
            method: 'DELETE',
            headers: { Authorization: this.authHeader },
        });
        // 404 = already absent — idempotent, swallow.
        if (!response.ok && response.status !== 404) {
            const text = await response.text().catch(() => '');
            throw new Error(
                `supabase remove failed (${response.status}): ${text}`
            );
        }
    }

    async exists(key: string): Promise<boolean> {
        const response = await fetch(this.objectUrl(key), {
            method: 'HEAD',
            headers: { Authorization: this.authHeader },
        });
        if (response.status === 404) return false;
        if (response.ok) return true;
        throw new Error(`supabase exists check failed (${response.status})`);
    }
}
