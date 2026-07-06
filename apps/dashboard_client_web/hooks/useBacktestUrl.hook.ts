'use client';

// hooks/useBacktestUrl.hook.ts
// Purpose: encode / decode all backtest inputs in the URL query string.
// Invariant: seed is generated once on first load (if absent) and immediately
// persisted to the URL — runBacktest MUST NOT be called before the seed is in
// the URL so that reloading the page reproduces an identical chart.

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { Holding } from '@/types/backtest';

export interface BacktestUrlState {
    budget: number;
    holdings: Holding[];
    from: string;
    to: string;
    seed: number;
    seedReady: boolean; // false until seed is written to URL
}

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_BUDGET = 10_000;
const DEFAULT_FROM = '2023-01-01';
const DEFAULT_TO = new Date().toISOString().slice(0, 10);
const DEFAULT_HOLDINGS: Holding[] = [
    { label: 'QQQ', weightPct: 60, drip: false },
    { label: 'JEPQ', weightPct: 40, drip: true },
];

// ── Codec ─────────────────────────────────────────────────────────────────────
// holdings encoded as "LABEL:weight:drip,..." e.g. "QQQ:60:false,JEPQ:40:true"

function encodeHoldings(holdings: Holding[]): string {
    return holdings
        .map((h) => `${h.label}:${h.weightPct}:${h.drip ? '1' : '0'}`)
        .join(',');
}

function decodeHoldings(raw: string | null): Holding[] | null {
    if (!raw) return null;
    try {
        const parts = raw.split(',');
        const holdings: Holding[] = [];
        for (const part of parts) {
            const [label, wStr, dStr] = part.split(':');
            if (!label || wStr === undefined) return null;
            const weightPct = Number(wStr);
            if (!isFinite(weightPct) || weightPct < 0 || weightPct > 100)
                return null;
            holdings.push({ label, weightPct, drip: dStr === '1' });
        }
        return holdings.length > 0 ? holdings : null;
    } catch {
        return null;
    }
}

// Mulberry32-inspired one-shot seed from a number — avoids Date.now() directly
// in the hook body (would differ on server vs client). We call this only client-side.
function generateSeed(): number {
    return Math.floor(Math.random() * 0x7fff_ffff);
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useBacktestUrl(): [
    BacktestUrlState,
    {
        setBudget: (v: number) => void;
        setHoldings: (v: Holding[]) => void;
        setRange: (from: string, to: string) => void;
    },
] {
    const router = useRouter();
    const pathname = usePathname();
    const sp = useSearchParams();

    const state = useMemo<BacktestUrlState>(() => {
        const budget = Number(sp.get('budget') ?? DEFAULT_BUDGET);
        const from = sp.get('from') ?? DEFAULT_FROM;
        const to = sp.get('to') ?? DEFAULT_TO;
        const seedRaw = sp.get('seed');
        const seed = seedRaw ? Number(seedRaw) : 0;
        const holdings = decodeHoldings(sp.get('assets')) ?? DEFAULT_HOLDINGS;
        return {
            budget: isFinite(budget) && budget > 0 ? budget : DEFAULT_BUDGET,
            holdings,
            from,
            to,
            seed,
            seedReady: seedRaw !== null,
        };
    }, [sp]);

    // On first mount: if no seed in URL, generate and write one.
    useEffect(() => {
        if (!state.seedReady) {
            const newSeed = generateSeed();
            const params = new URLSearchParams(sp.toString());
            params.set('seed', String(newSeed));
            router.replace(`${pathname}?${params.toString()}`, {
                scroll: false,
            });
        }
    }, [state.seedReady, sp, router, pathname]);

    const push = useCallback(
        (patch: Record<string, string>) => {
            const params = new URLSearchParams(sp.toString());
            for (const [k, v] of Object.entries(patch)) params.set(k, v);
            router.replace(`${pathname}?${params.toString()}`, {
                scroll: false,
            });
        },
        [sp, router, pathname]
    );

    const setBudget = useCallback(
        (v: number) => push({ budget: String(v) }),
        [push]
    );
    const setHoldings = useCallback(
        (v: Holding[]) => push({ assets: encodeHoldings(v) }),
        [push]
    );
    const setRange = useCallback(
        (from: string, to: string) => push({ from, to }),
        [push]
    );

    return [state, { setBudget, setHoldings, setRange }];
}
