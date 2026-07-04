// app/actions/getRankingsFlow.action.ts
// Purpose: Server Action returning rank-flow data for market_rankings from Express.
// Cache: next.revalidate=86400 (24h) — weekly rankings update once per week.
// Invariant: data:null (no DB data) is NOT an error — passes through as { ok:true, data:null }.
//   Throws are typed network errors and forwarded to error_log (source='ssr').
// Access: endpoint is public read-only data — no Clerk token forwarded.
// Side effects: one network fetch; best-effort error POST on failure.

'use server';

import { API_BASE } from '@/env.schema';
import { reportSsrError } from '@/apis/reportSsrError.server';
import { rankingsFlowSchema } from '@/app/actions/getRankingsFlow.schema';
import type { RankingsFlow } from '@/types/rankingsFlow';

const FLOW_ENDPOINT = '/v1/api/rankings/flow';
const REVALIDATE_SECONDS = 86400; // 24h — matches Express s-maxage

export type RankingsFlowErrorKind = 'network' | 'parse';

export interface RankingsFlowError {
    kind: RankingsFlowErrorKind;
    message: string;
}

export type RankingsFlowResult =
    | { ok: true; data: RankingsFlow | null }
    | { ok: false; error: RankingsFlowError };

export async function getRankingsFlow(
    granularity: 'week' | 'month' | 'quarter' | 'year' = 'week',
    periods = 26,
    k = 25
): Promise<RankingsFlowResult> {
    const path = FLOW_ENDPOINT;
    let payload: unknown;
    try {
        const url = new URL(`${API_BASE}${path}`);
        url.searchParams.set('granularity', granularity);
        url.searchParams.set('periods', String(periods));
        url.searchParams.set('k', String(k));
        const res = await fetch(url.toString(), {
            next: { revalidate: REVALIDATE_SECONDS },
        });
        if (!res.ok) {
            await reportSsrError(`rankings flow HTTP ${res.status}`, path);
            return {
                ok: false,
                error: { kind: 'network', message: `HTTP ${res.status}` },
            };
        }
        const body: unknown = await res.json();
        payload = (body as { data?: unknown }).data;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'fetch failed';
        await reportSsrError(`rankings flow ${message}`, path);
        return { ok: false, error: { kind: 'network', message } };
    }

    // Backend explicitly returns null when there is insufficient data.
    if (payload === null || payload === undefined) {
        return { ok: true, data: null };
    }

    const parsed = rankingsFlowSchema.safeParse(payload);
    if (!parsed.success) {
        await reportSsrError(
            `rankings flow parse: ${parsed.error.message}`,
            path
        );
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
