// Purpose: Server Action returning 13F holdings for one fund from Express.
// Cache: next.revalidate=86400 (24h) — matches Express s-maxage on /v1/api/funds/:cik.
//   Monthly filings are immutable once filed; daily revalidation is sufficient.
// Param: period (YYYY-MM-DD) forwarded as ?period= to pin a specific filing date.
// Invariant: a null data response (unknown CIK) passes through as { ok:true, data:null }
//   — this is NOT an error. Raw throws are returned as typed network errors AND
//   forwarded to error_log (source='ssr'). NO mock fallback.
// Access: endpoint is public read-only data — no Clerk token forwarded.
// Side effects: one network fetch; a best-effort error POST on failure.

'use server';

import { API_BASE } from '@/env.schema';
import { reportSsrError } from '@/apis/reportSsrError.server';
import { fundHoldingsSchema } from '@/app/actions/getFundHoldings.schema';
import type { FundHoldings } from '@/types/funds';

const FUNDS_ENDPOINT = '/v1/api/funds';
const REVALIDATE_SECONDS = 86400; // 24h — must match Express s-maxage

export type HoldingsErrorKind = 'network' | 'parse';

export interface HoldingsError {
    kind: HoldingsErrorKind;
    message: string;
}

export type HoldingsResult =
    | { ok: true; data: FundHoldings | null }
    | { ok: false; error: HoldingsError };

export async function getFundHoldings(
    cik: string,
    period?: string
): Promise<HoldingsResult> {
    let payload: unknown;
    try {
        const url = new URL(`${API_BASE}${FUNDS_ENDPOINT}/${cik}`);
        if (period) {
            url.searchParams.set('period', period);
        }
        const res = await fetch(url.toString(), {
            next: { revalidate: REVALIDATE_SECONDS },
        });
        if (!res.ok) {
            await reportSsrError(
                `fund holdings HTTP ${res.status}`,
                `${FUNDS_ENDPOINT}/${cik}`
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
        await reportSsrError(
            `fund holdings ${message}`,
            `${FUNDS_ENDPOINT}/${cik}`
        );
        return { ok: false, error: { kind: 'network', message } };
    }

    // Backend explicitly returns null for an unknown CIK — pass it through.
    if (payload === null) {
        return { ok: true, data: null };
    }

    const parsed = fundHoldingsSchema.safeParse(payload);
    if (!parsed.success) {
        await reportSsrError(
            `fund holdings parse: ${parsed.error.message}`,
            `${FUNDS_ENDPOINT}/${cik}`
        );
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
