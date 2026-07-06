'use client';

// hooks/useBacktestUrl.hook.ts
// Purpose: encode / decode all backtest inputs in the URL query string.
// Invariant: seed is generated once on first load (if absent) and immediately
// persisted to the URL — runBacktest MUST NOT be called before the seed is in
// the URL so that reloading the page reproduces an identical chart.

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type {
    Holding,
    ContributionPlan,
    ContributionFreq,
} from '@/types/backtest';

export interface BacktestUrlState {
    budget: number;
    holdings: Holding[];
    from: string;
    to: string;
    seed: number;
    seedReady: boolean; // false until seed is written to URL
    contribution: ContributionPlan | undefined;
}

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_BUDGET = 10_000;
const DEFAULT_FROM = '2023-01-01';
const DEFAULT_TO = new Date().toISOString().slice(0, 10);
const DEFAULT_HOLDINGS: Holding[] = [
    { label: 'QQQ', weightPct: 60, drip: false },
    { label: 'JEPQ', weightPct: 40, drip: true },
];

// ── Codec: holdings ───────────────────────────────────────────────────────────
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

// ── Codec: contribution ───────────────────────────────────────────────────────
// dca=<amount>:<freq>  e.g. "dca=500:monthly"  (absent ⇒ undefined)

const VALID_FREQS = new Set<ContributionFreq>(['monthly', 'yearly']);

function encodeContribution(plan: ContributionPlan): string {
    return `${plan.amount}:${plan.freq}`;
}

function decodeContribution(raw: string | null): ContributionPlan | undefined {
    if (!raw) return undefined;
    const [amtStr, freqStr] = raw.split(':');
    const amount = Number(amtStr);
    if (!isFinite(amount) || amount <= 0) return undefined;
    if (!freqStr || !VALID_FREQS.has(freqStr as ContributionFreq))
        return undefined;
    return { amount, freq: freqStr as ContributionFreq };
}

// Mulberry32-inspired one-shot seed — called only client-side.
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
        setContribution: (plan: ContributionPlan | undefined) => void;
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
        const contribution = decodeContribution(sp.get('dca'));
        return {
            budget: isFinite(budget) && budget > 0 ? budget : DEFAULT_BUDGET,
            holdings,
            from,
            to,
            seed,
            seedReady: seedRaw !== null,
            contribution,
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
        (patch: Record<string, string | null>) => {
            const params = new URLSearchParams(sp.toString());
            for (const [k, v] of Object.entries(patch)) {
                if (v === null) {
                    params.delete(k);
                } else {
                    params.set(k, v);
                }
            }
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
    const setContribution = useCallback(
        (plan: ContributionPlan | undefined) =>
            push({ dca: plan ? encodeContribution(plan) : null }),
        [push]
    );

    return [state, { setBudget, setHoldings, setRange, setContribution }];
}
