'use client';

// hooks/useBacktestUrl.hook.ts
// Purpose: encode / decode all backtest inputs in the URL query string.
// Invariant: seed always has a value — DEFAULT_SEED is used when absent from
// URL. The Randomize button (SeedControl) is the ONLY source of new random
// seeds; no auto-generation on mount (XE.5 bug fix).
//
// XE.2: dividendRoute replaces drip. 3rd holdings field encodes as:
//   'same' | 'cash' | '<label>'  (new format)
//   '1' | '0'                    (legacy — decoded as same/cash, read-only)

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type {
    Holding,
    ContributionPlan,
    ContributionFreq,
    DividendRoute,
} from '@/types/backtest';

export interface BacktestUrlState {
    budget: number;
    holdings: Holding[];
    from: string;
    to: string;
    seed: number;
    contribution: ContributionPlan | undefined;
}

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_BUDGET = 10_000;
const DEFAULT_FROM = '2023-01-01';
const DEFAULT_TO = new Date().toISOString().slice(0, 10);
const DEFAULT_HOLDINGS: Holding[] = [
    { label: 'QQQ', weightPct: 60, dividendRoute: { kind: 'cash' } },
    { label: 'JEPQ', weightPct: 40, dividendRoute: { kind: 'same' } },
];

export const DEFAULT_SEED = 42;
// exclusive upper bound for seed values (2^32)
export const MAX_SEED = 2 ** 32;

// ── Seed validation ───────────────────────────────────────────────────────────
// Exported so SeedControl + tests share the same predicate.
export function isValidSeed(v: number): boolean {
    return Number.isInteger(v) && v >= 0 && v < MAX_SEED;
}

// Decode seed from a raw URL param string — always returns a defined integer.
export function decodeSeed(raw: string | null): number {
    if (raw === null) return DEFAULT_SEED;
    const n = Number(raw);
    return isValidSeed(n) ? n : DEFAULT_SEED;
}

// ── Codec: holdings ───────────────────────────────────────────────────────────
// XE.2 format: "LABEL:weight:same|cash|<label>,..."
// Legacy format: "LABEL:weight:1|0,..." (still decoded; never re-encoded)

function decodeRoute(dStr: string | undefined): DividendRoute {
    if (dStr === '1' || dStr === 'same') return { kind: 'same' };
    if (dStr === '0' || dStr === 'cash' || dStr === undefined)
        return { kind: 'cash' };
    return { kind: 'asset', target: dStr };
}

function encodeDividendRoute(h: Holding): string {
    // Prefer explicit dividendRoute; fall back to legacy drip boolean.
    const route: DividendRoute =
        h.dividendRoute !== undefined
            ? h.dividendRoute
            : h.drip === true
              ? { kind: 'same' }
              : { kind: 'cash' };
    if (route.kind === 'same') return 'same';
    if (route.kind === 'cash') return 'cash';
    return route.target;
}

function encodeHoldings(holdings: Holding[]): string {
    return holdings
        .map((h) => `${h.label}:${h.weightPct}:${encodeDividendRoute(h)}`)
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
            holdings.push({
                label,
                weightPct,
                dividendRoute: decodeRoute(dStr),
            });
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

// Called only by the Randomize button — never auto-invoked on mount/render.
export function generateSeed(): number {
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
        setSeed: (v: number) => void;
    },
] {
    const router = useRouter();
    const pathname = usePathname();
    const sp = useSearchParams();

    const state = useMemo<BacktestUrlState>(() => {
        const budget = Number(sp.get('budget') ?? DEFAULT_BUDGET);
        const from = sp.get('from') ?? DEFAULT_FROM;
        const to = sp.get('to') ?? DEFAULT_TO;
        // seed is ALWAYS defined: use DEFAULT_SEED when URL param is absent.
        // This eliminates the per-visit re-roll (XE.5 bug fix).
        const seed = decodeSeed(sp.get('seed'));
        const holdings = decodeHoldings(sp.get('assets')) ?? DEFAULT_HOLDINGS;
        const contribution = decodeContribution(sp.get('dca'));
        return {
            budget: isFinite(budget) && budget > 0 ? budget : DEFAULT_BUDGET,
            holdings,
            from,
            to,
            seed,
            contribution,
        };
    }, [sp]);

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
    const setSeed = useCallback(
        (v: number) => push({ seed: String(v) }),
        [push]
    );

    return [
        state,
        { setBudget, setHoldings, setRange, setContribution, setSeed },
    ];
}
