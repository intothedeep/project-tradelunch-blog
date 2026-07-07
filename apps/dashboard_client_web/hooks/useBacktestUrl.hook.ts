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
//
// X2.11: rb= and mf= params added; assets= gains optional trailing positionals.
// X2-P2.8: synth= param added (shortLabel:base:method).

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type {
    Holding,
    ContributionPlan,
    DividendRoute,
    RebalancePolicy,
} from '@/types/backtest';
import {
    encodeHoldings,
    decodeHoldings,
    encodeContribution,
    decodeContribution,
    encodeRebalance,
    decodeRebalance,
    encodeManualFlows,
    decodeManualFlows,
} from '@/utils/backtest/url-codec';
import {
    encodeSynth,
    decodeSynth,
    type SynthUrlState,
} from '@/utils/backtest/url-codec-synth';

// Re-export primitives consumed by tests and SeedControl.
export type { DividendRoute };

export interface BacktestUrlState {
    budget: number;
    holdings: Holding[];
    from: string;
    to: string;
    seed: number;
    contribution: ContributionPlan | undefined;
    rebalance: RebalancePolicy | undefined;
    manualFlows: { date: string; amount: number }[] | undefined;
    synth: SynthUrlState | undefined;
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

// Called only by the Randomize button — never auto-invoked on mount/render.
export function generateSeed(): number {
    return Math.floor(Math.random() * 0x7fff_ffff);
}

// Re-export codec helpers for consumers that import them from the hook path.
export {
    encodeHoldings,
    decodeHoldings,
    encodeContribution,
    decodeContribution,
    encodeSynth,
    decodeSynth,
};
export type { SynthUrlState };

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useBacktestUrl(): [
    BacktestUrlState,
    {
        setBudget: (v: number) => void;
        setHoldings: (v: Holding[]) => void;
        setRange: (from: string, to: string) => void;
        setContribution: (plan: ContributionPlan | undefined) => void;
        setSeed: (v: number) => void;
        setRebalance: (policy: RebalancePolicy | undefined) => void;
        setManualFlows: (
            flows: { date: string; amount: number }[] | undefined
        ) => void;
        setSynth: (s: SynthUrlState | undefined) => void;
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
        const seed = decodeSeed(sp.get('seed'));
        const holdings = decodeHoldings(sp.get('assets')) ?? DEFAULT_HOLDINGS;
        const contribution = decodeContribution(sp.get('dca'));
        // knownLabels allows the rebalance decoder to drop stale trigger labels.
        const knownLabels = new Set(holdings.map((h) => h.label));
        const rebalance = decodeRebalance(sp.get('rb'), knownLabels);
        const manualFlows = decodeManualFlows(sp.get('mf'));
        const synth = decodeSynth(sp.get('synth'));
        return {
            budget: isFinite(budget) && budget > 0 ? budget : DEFAULT_BUDGET,
            holdings,
            from,
            to,
            seed,
            contribution,
            rebalance,
            manualFlows,
            synth,
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
    const setRebalance = useCallback(
        (policy: RebalancePolicy | undefined) =>
            push({ rb: policy ? encodeRebalance(policy) : null }),
        [push]
    );
    const setManualFlows = useCallback(
        (flows: { date: string; amount: number }[] | undefined) =>
            push({
                mf: flows && flows.length > 0 ? encodeManualFlows(flows) : null,
            }),
        [push]
    );
    const setSynth = useCallback(
        (s: SynthUrlState | undefined) =>
            push({ synth: s ? encodeSynth(s) : null }),
        [push]
    );

    return [
        state,
        {
            setBudget,
            setHoldings,
            setRange,
            setContribution,
            setSeed,
            setRebalance,
            setManualFlows,
            setSynth,
        },
    ];
}
