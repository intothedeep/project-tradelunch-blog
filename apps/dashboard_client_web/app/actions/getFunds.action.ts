// Purpose: Server Action returning the list of 13F funds from the Express backend.
// Cache: next.revalidate=86400 (24h) — matches Express s-maxage on /v1/api/funds.
//   Monthly filings change rarely; daily revalidation is more than sufficient.
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
const REVALIDATE_SECONDS = 86400; // 24h — must match Express s-maxage

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
