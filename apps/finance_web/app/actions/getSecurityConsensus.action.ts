// Purpose: Server Action returning cross-fund 13F consensus for one CUSIP.
// Cache: next.revalidate=86400 (24h) — must match Express s-maxage.
// Invariant: a null data response (unknown cusip / views absent) passes through
//   as { ok:true, data:null } — NOT an error. Raw throws are typed network
//   errors AND forwarded to error_log (source='ssr'). NO mock fallback.
// Access: public read-only data — no Clerk token forwarded.
// Side effects: one network fetch; a best-effort error POST on failure.

'use server';

import { API_BASE } from '@/env.schema';
import { reportSsrError } from '@/apis/reportSsrError.server';
import { securityConsensusSchema } from '@/app/actions/getSecurityConsensus.schema';
import type { SecurityConsensus } from '@/types/consensus';

const SECURITIES_ENDPOINT = '/v1/api/securities';
const REVALIDATE_SECONDS = 86400; // 24h — must match Express s-maxage

export type ConsensusErrorKind = 'network' | 'parse';

export interface ConsensusError {
    kind: ConsensusErrorKind;
    message: string;
}

export type SecurityConsensusResult =
    | { ok: true; data: SecurityConsensus | null }
    | { ok: false; error: ConsensusError };

export async function getSecurityConsensus(
    cusip: string
): Promise<SecurityConsensusResult> {
    const path = `${SECURITIES_ENDPOINT}/${cusip}/consensus`;
    let payload: unknown;
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            next: { revalidate: REVALIDATE_SECONDS },
        });
        if (!res.ok) {
            await reportSsrError(`consensus HTTP ${res.status}`, path);
            return {
                ok: false,
                error: { kind: 'network', message: `HTTP ${res.status}` },
            };
        }
        const body: unknown = await res.json();
        payload = (body as { data?: unknown }).data;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'fetch failed';
        await reportSsrError(`consensus ${message}`, path);
        return { ok: false, error: { kind: 'network', message } };
    }

    // Backend explicitly returns null for unknown cusip / absent views.
    if (payload === null) {
        return { ok: true, data: null };
    }

    const parsed = securityConsensusSchema.safeParse(payload);
    if (!parsed.success) {
        await reportSsrError(`consensus parse: ${parsed.error.message}`, path);
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
