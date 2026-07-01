// Purpose: Server Action returning the weekly market-cap ranking from Express.
// Cache: next.revalidate=86400 (24h) — matches Express s-maxage on /v1/api/rankings.
//   The series only gains a new row once a week; daily revalidation is ample.
// Params: scope ('global'|'sector'), sector (name, when scope=sector), limit.
// Invariant: a null data response (table/weekly data absent) passes through as
//   { ok:true, data:null } — this is NOT an error. Raw throws are returned as
//   typed network errors AND forwarded to error_log (source='ssr'). NO mock.
// Access: endpoint is public read-only data — no Clerk token forwarded.
// Side effects: one network fetch; a best-effort error POST on failure.

'use server';

import { API_BASE } from '@/env.schema';
import { reportSsrError } from '@/apis/reportSsrError.server';
import { rankingsSnapshotSchema } from '@/app/actions/getRankings.schema';
import type { RankingScope, RankingsSnapshot } from '@/types/rankings';

const RANKINGS_ENDPOINT = '/v1/api/rankings';
const REVALIDATE_SECONDS = 86400; // 24h — must match Express s-maxage

export type RankingsErrorKind = 'network' | 'parse';

export interface RankingsError {
    kind: RankingsErrorKind;
    message: string;
}

export type RankingsResult =
    | { ok: true; data: RankingsSnapshot | null }
    | { ok: false; error: RankingsError };

export interface RankingsQuery {
    scope?: RankingScope;
    sector?: string;
    limit?: number;
}

export async function getRankings(
    query: RankingsQuery = {}
): Promise<RankingsResult> {
    let payload: unknown;
    try {
        const url = new URL(`${API_BASE}${RANKINGS_ENDPOINT}`);
        if (query.scope) url.searchParams.set('scope', query.scope);
        if (query.sector) url.searchParams.set('sector', query.sector);
        if (query.limit) url.searchParams.set('limit', String(query.limit));

        const res = await fetch(url.toString(), {
            next: { revalidate: REVALIDATE_SECONDS },
        });
        if (!res.ok) {
            await reportSsrError(
                `rankings HTTP ${res.status}`,
                RANKINGS_ENDPOINT
            );
            return {
                ok: false,
                error: { kind: 'network', message: `HTTP ${res.status}` },
            };
        }
        const body: unknown = await res.json();
        payload = (body as { data?: unknown }).data;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'fetch failed';
        await reportSsrError(`rankings ${message}`, RANKINGS_ENDPOINT);
        return { ok: false, error: { kind: 'network', message } };
    }

    // Backend returns null when the table/weekly data is absent — pass through.
    if (payload === null) {
        return { ok: true, data: null };
    }

    const parsed = rankingsSnapshotSchema.safeParse(payload);
    if (!parsed.success) {
        await reportSsrError(
            `rankings parse: ${parsed.error.message}`,
            RANKINGS_ENDPOINT
        );
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
