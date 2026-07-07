// Purpose: Server Action returning the list of 13F funds from the Express backend.
// Cache: ISR revalidate=3600 (1h) — monthly 13F filings; 1h is more than fresh enough.
//   Collapses repeat-hit Supabase egress to ~1 query per hour.
// Invariant: never throws raw — failures are returned as a typed error result
//   AND forwarded to the error_log sink (source='ssr'). NO mock fallback.
// Access: endpoint is public read-only data — no Clerk token forwarded.
// Side effects: one network fetch; a best-effort error POST on failure.

'use server';

import { API_BASE } from '@/env.schema';
import { reportSsrError } from '@/apis/reportSsrError.server';
import { fundsListSchema } from '@/app/actions/getFunds.schema';
import type { Fund } from '@/types/funds';

const FUNDS_ENDPOINT = '/v1/api/funds';
const REVALIDATE_SECONDS = 3600; // 1h ISR — data is daily-refreshed; caps repeat-hit Supabase egress

export type FundsErrorKind = 'network' | 'parse';

export interface FundsError {
    kind: FundsErrorKind;
    message: string;
}

export type FundsResult =
    | { ok: true; data: Fund[] }
    | { ok: false; error: FundsError };

export async function getFunds(): Promise<FundsResult> {
    let payload: unknown;
    try {
        const res = await fetch(`${API_BASE}${FUNDS_ENDPOINT}`, {
            next: { revalidate: REVALIDATE_SECONDS },
        });
        if (!res.ok) {
            await reportSsrError(`funds HTTP ${res.status}`, FUNDS_ENDPOINT);
            return {
                ok: false,
                error: { kind: 'network', message: `HTTP ${res.status}` },
            };
        }
        const body: unknown = await res.json();
        payload = (body as { data?: unknown }).data;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'fetch failed';
        await reportSsrError(`funds ${message}`, FUNDS_ENDPOINT);
        return { ok: false, error: { kind: 'network', message } };
    }

    const parsed = fundsListSchema.safeParse(payload);
    if (!parsed.success) {
        await reportSsrError(
            `funds parse: ${parsed.error.message}`,
            FUNDS_ENDPOINT
        );
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
