// Purpose: Server Action returning rank-flow holdings for one fund from Express.
// Cache: ISR revalidate=3600 (1h) — quarterly 13F filings update monthly; 1h is ample.
// Params: quarters (default 8), k (default 25 top holdings per quarter).
// Invariant: a null data response (unknown CIK) passes through as { ok:true, data:null }
//   — this is NOT an error. Raw throws are returned as typed network errors AND
//   forwarded to error_log (source='ssr'). NO mock fallback.
// Access: endpoint is public read-only data — no Clerk token forwarded.
// Side effects: one network fetch; a best-effort error POST on failure.

'use server';

import { API_BASE } from '@/env.schema';
import { reportSsrError } from '@/apis/reportSsrError.server';
import { rankFlowSchema } from '@/app/actions/getFundRankFlow.schema';
import type { RankFlow } from '@/types/rankFlow';

const FUNDS_ENDPOINT = '/v1/api/funds';
const REVALIDATE_SECONDS = 3600; // 1h ISR — data is daily-refreshed; caps repeat-hit Supabase egress

export type RankFlowErrorKind = 'network' | 'parse';

export interface RankFlowError {
    kind: RankFlowErrorKind;
    message: string;
}

export type RankFlowResult =
    | { ok: true; data: RankFlow | null }
    | { ok: false; error: RankFlowError };

export async function getFundRankFlow(
    cik: string,
    quarters = 8,
    k = 25
): Promise<RankFlowResult> {
    const path = `${FUNDS_ENDPOINT}/${cik}/rankflow`;
    let payload: unknown;
    try {
        const url = new URL(`${API_BASE}${path}`);
        url.searchParams.set('quarters', String(quarters));
        url.searchParams.set('k', String(k));
        const res = await fetch(url.toString(), {
            next: { revalidate: REVALIDATE_SECONDS },
        });
        if (!res.ok) {
            await reportSsrError(`fund rankflow HTTP ${res.status}`, path);
            return {
                ok: false,
                error: { kind: 'network', message: `HTTP ${res.status}` },
            };
        }
        const body: unknown = await res.json();
        payload = (body as { data?: unknown }).data;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'fetch failed';
        await reportSsrError(`fund rankflow ${message}`, path);
        return { ok: false, error: { kind: 'network', message } };
    }

    // Backend explicitly returns null for an unknown CIK — pass it through.
    if (payload === null) {
        return { ok: true, data: null };
    }

    const parsed = rankFlowSchema.safeParse(payload);
    if (!parsed.success) {
        await reportSsrError(
            `fund rankflow parse: ${parsed.error.message}`,
            path
        );
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
