// Purpose: TanStack Query wrappers over the dashboard Server Actions.
// Constraints: per-category polling intervals; history is lazy/on-demand.
// Side effects: triggers Server Action network calls via React Query.

'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardSnapshot } from '@/app/actions/getDashboardSnapshot.action';
import { getDashboardHistory } from '@/app/actions/getDashboardHistory.action';

// Per-category refresh cadence (ms). KRX refreshes once per session.
export const POLL_FX_MS = 60_000;
export const POLL_CRYPTO_MS = 30_000;
export const POLL_INDICES_US_MS = 60_000;
export const POLL_KRX_MS = false as const; // once/session — no polling
export const POLL_RATES_MS = 24 * 60 * 60 * 1000;
export const POLL_STOCKS_MS = 60_000;

// The snapshot bundles every category in one payload. Crypto is the most
// volatile, so the snapshot polls at the tightest required cadence; consumers
// read their slice from the single result.
export const SNAPSHOT_POLL_MS = POLL_CRYPTO_MS;

const HISTORY_STALE_MS = 5 * 60 * 1000;

export const dashboardQueryKeys = {
    snapshot: ['dashboard', 'snapshot'] as const,
    history: (label: string, interval: string) =>
        ['dashboard', 'history', label, interval] as const,
};

export function useDashboardSnapshot() {
    return useQuery({
        queryKey: dashboardQueryKeys.snapshot,
        queryFn: getDashboardSnapshot,
        refetchInterval: SNAPSHOT_POLL_MS,
    });
}

interface UseDashboardHistoryArgs {
    label: string | null;
    interval: string;
    enabled?: boolean;
}

export function useDashboardHistory({
    label,
    interval,
    enabled = true,
}: UseDashboardHistoryArgs) {
    return useQuery({
        queryKey: dashboardQueryKeys.history(label ?? '', interval),
        queryFn: () => getDashboardHistory(label as string, interval),
        enabled: enabled && label !== null,
        staleTime: HISTORY_STALE_MS,
    });
}
