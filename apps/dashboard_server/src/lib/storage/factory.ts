// Purpose: resolve the active TStorageProvider from env and memoize it.
//          This is the ONLY module that reads env vars for storage config —
//          all side-effects (env reads) are isolated here.
// Invariants:
//   * getStorageProvider() returns the same instance across calls (memoized).
//   * isStorageConfigured() checks the selected provider has its required env set.
//   * STORAGE_PROVIDER defaults to 'supabase' (backward-compat if env is absent).
// Side effects: reads process.env via the env module (once, at first call).

import {
    STORAGE_PROVIDER,
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    SUPABASE_STORAGE_BUCKET,
    STORAGE_BUCKET,
    STORAGE_ENDPOINT,
    STORAGE_ACCESS_KEY,
    STORAGE_SECRET_KEY,
    STORAGE_REGION,
} from '../../config/env.schema';
import type { TStorageProvider } from './provider.type';
import { SupabaseProvider } from './supabaseProvider';
import { OciS3Provider } from './ociS3Provider';

let _provider: TStorageProvider | null = null;

/**
 * Returns the memoized storage provider selected by STORAGE_PROVIDER.
 * Throws if required config for the selected provider is missing.
 */
export function getStorageProvider(): TStorageProvider {
    if (_provider !== null) return _provider;

    const selected = STORAGE_PROVIDER;

    if (selected === 'supabase') {
        if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
            throw new Error(
                'supabase provider requires SUPABASE_URL and SUPABASE_SECRET_KEY'
            );
        }
        _provider = new SupabaseProvider({
            supabaseUrl: SUPABASE_URL,
            secretKey: SUPABASE_SECRET_KEY,
            bucket: SUPABASE_STORAGE_BUCKET,
        });
        return _provider;
    }

    // 'oci' and 's3' both use the same S3-compatible client.
    if (selected === 'oci' || selected === 's3') {
        if (
            !STORAGE_ENDPOINT ||
            !STORAGE_ACCESS_KEY ||
            !STORAGE_SECRET_KEY ||
            !STORAGE_REGION
        ) {
            throw new Error(
                `${selected} provider requires STORAGE_ENDPOINT, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, STORAGE_REGION`
            );
        }
        _provider = new OciS3Provider({
            endpoint: STORAGE_ENDPOINT,
            region: STORAGE_REGION,
            accessKeyId: STORAGE_ACCESS_KEY,
            secretAccessKey: STORAGE_SECRET_KEY,
            bucket: STORAGE_BUCKET,
        });
        return _provider;
    }

    // TypeScript exhaustiveness guard — should never reach here.
    throw new Error(`unknown STORAGE_PROVIDER: ${String(selected)}`);
}

/**
 * Returns true iff the selected provider has its required env vars set.
 * Used to gate the /images route with a 503 instead of a runtime throw.
 */
export function isStorageConfigured(): boolean {
    const selected = STORAGE_PROVIDER;
    if (selected === 'supabase') {
        return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
    }
    if (selected === 'oci' || selected === 's3') {
        return Boolean(
            STORAGE_ENDPOINT &&
            STORAGE_ACCESS_KEY &&
            STORAGE_SECRET_KEY &&
            STORAGE_REGION
        );
    }
    return false;
}
