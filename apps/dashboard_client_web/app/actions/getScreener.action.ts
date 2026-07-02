'use server';

// app/actions/getScreener.action.ts
// Purpose: Server Action returning 13F consensus screener candidates.
// Cache: next.revalidate=86400 (24h) — must match Express s-maxage.
// Invariant: a null data response (absent views) passes through as
//   { ok:true, data:null } — NOT an error. Raw throws are typed network
//   errors AND forwarded to error_log (source='ssr'). NO mock fallback.
// Access: public read-only data — no Clerk token forwarded.
// DEFERRED: momentum + lowVol score terms always null (see types/screener.ts).
// Side effects: one network fetch; a best-effort error POST on failure.

import { API_BASE } from '@/env.schema';
import { reportSsrError } from '@/apis/reportSsrError.server';
import { screenerDataSchema } from '@/app/actions/getScreener.schema';
import type { ScreenerData } from '@/types/screener';

const SCREEN_ENDPOINT = '/v1/api/securities/screen';
const REVALIDATE_SECONDS = 86400; // 24h — must match Express s-maxage

export type ScreenerErrorKind = 'network' | 'parse';

export interface ScreenerError {
    kind: ScreenerErrorKind;
    message: string;
}

export type ScreenerResult =
    | { ok: true; data: ScreenerData | null }
    | { ok: false; error: ScreenerError };

export interface ScreenerParams {
    minActiveHolders?: number;
    maxRank?: number;
    limit?: number;
}

export async function getScreener(
    params?: ScreenerParams
): Promise<ScreenerResult> {
    const qs = new URLSearchParams();
    if (params?.minActiveHolders != null)
        qs.set('minActiveHolders', String(params.minActiveHolders));
    if (params?.maxRank != null) qs.set('maxRank', String(params.maxRank));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    const query = qs.toString();
    const fullPath = `${SCREEN_ENDPOINT}${query ? `?${query}` : ''}`;

    let payload: unknown;
    try {
        const res = await fetch(`${API_BASE}${fullPath}`, {
            next: { revalidate: REVALIDATE_SECONDS },
        });
        if (!res.ok) {
            await reportSsrError(
                `screener HTTP ${res.status}`,
                SCREEN_ENDPOINT
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
        await reportSsrError(`screener ${message}`, SCREEN_ENDPOINT);
        return { ok: false, error: { kind: 'network', message } };
    }

    // Backend explicitly returns null when views absent.
    if (payload === null) {
        return { ok: true, data: null };
    }

    const parsed = screenerDataSchema.safeParse(payload);
    if (!parsed.success) {
        await reportSsrError(
            `screener parse: ${parsed.error.message}`,
            SCREEN_ENDPOINT
        );
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
