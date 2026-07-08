'use client';

// hooks/useBacktestDraft.hook.ts
// Purpose: local draft state for backtest controls.
// Draft is initialised from committed (URL) state; setters write local state
// only. Apply flushes to URL in one batched navigation via onCommit callback.
// dirty flag compares encoded representations so structurally equal values
// (same data, different object identity) are never marked dirty.

import { useState, useCallback, useMemo } from 'react';
import type {
    Holding,
    ContributionPlan,
    RebalancePolicy,
} from '@/types/backtest';
import {
    encodeHoldings,
    encodeContribution,
    encodeManualFlows,
} from '@/utils/backtest/url-codec';
import { encodeRebalance } from '@/utils/backtest/url-codec-rebalance';
import {
    encodeSynth,
    type SynthUrlState,
} from '@/utils/backtest/url-codec-synth';
import type { BacktestUrlState } from '@/hooks/useBacktestUrl.hook';

// ── Canonical encoders used for dirty comparison ──────────────────────────────

function encodeContributionOrNull(v: ContributionPlan | undefined): string {
    return v ? encodeContribution(v) : '';
}
function encodeRebalanceOrNull(v: RebalancePolicy | undefined): string {
    return v ? encodeRebalance(v) : '';
}
function encodeFlowsOrNull(
    v: { date: string; amount: number }[] | undefined
): string {
    return v && v.length > 0 ? encodeManualFlows(v) : '';
}
function encodeSynthOrNull(v: SynthUrlState | undefined): string {
    return v ? encodeSynth(v) : '';
}

function isDirty(
    draft: BacktestUrlState,
    committed: BacktestUrlState
): boolean {
    if (draft.budget !== committed.budget) return true;
    if (draft.from !== committed.from) return true;
    if (draft.to !== committed.to) return true;
    if (draft.seed !== committed.seed) return true;
    if (draft.dividendReinvestByWeight !== committed.dividendReinvestByWeight)
        return true;
    if (encodeHoldings(draft.holdings) !== encodeHoldings(committed.holdings))
        return true;
    if (
        encodeContributionOrNull(draft.contribution) !==
        encodeContributionOrNull(committed.contribution)
    )
        return true;
    if (
        encodeRebalanceOrNull(draft.rebalance) !==
        encodeRebalanceOrNull(committed.rebalance)
    )
        return true;
    if (
        encodeFlowsOrNull(draft.manualFlows) !==
        encodeFlowsOrNull(committed.manualFlows)
    )
        return true;
    if (encodeSynthOrNull(draft.synth) !== encodeSynthOrNull(committed.synth))
        return true;
    return false;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface BacktestDraftActions {
    draft: BacktestUrlState;
    dirty: boolean;
    reset: () => void;
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
    setDividendReinvestByWeight: (v: boolean) => void;
}

export function useBacktestDraft(
    committed: BacktestUrlState
): BacktestDraftActions {
    const [draft, setDraft] = useState<BacktestUrlState>(committed);

    const dirty = useMemo(() => isDirty(draft, committed), [draft, committed]);

    const reset = useCallback(() => setDraft(committed), [committed]);

    const setBudget = useCallback(
        (v: number) => setDraft((d) => ({ ...d, budget: v })),
        []
    );
    const setHoldings = useCallback(
        (v: Holding[]) => setDraft((d) => ({ ...d, holdings: v })),
        []
    );
    const setRange = useCallback(
        (from: string, to: string) => setDraft((d) => ({ ...d, from, to })),
        []
    );
    const setContribution = useCallback(
        (plan: ContributionPlan | undefined) =>
            setDraft((d) => ({ ...d, contribution: plan })),
        []
    );
    const setSeed = useCallback(
        (v: number) => setDraft((d) => ({ ...d, seed: v })),
        []
    );
    const setRebalance = useCallback(
        (policy: RebalancePolicy | undefined) =>
            setDraft((d) => ({ ...d, rebalance: policy })),
        []
    );
    const setManualFlows = useCallback(
        (flows: { date: string; amount: number }[] | undefined) =>
            setDraft((d) => ({ ...d, manualFlows: flows })),
        []
    );
    const setSynth = useCallback(
        (s: SynthUrlState | undefined) => setDraft((d) => ({ ...d, synth: s })),
        []
    );
    const setDividendReinvestByWeight = useCallback(
        (v: boolean) =>
            setDraft((d) => ({ ...d, dividendReinvestByWeight: v })),
        []
    );

    return {
        draft,
        dirty,
        reset,
        setBudget,
        setHoldings,
        setRange,
        setContribution,
        setSeed,
        setRebalance,
        setManualFlows,
        setSynth,
        setDividendReinvestByWeight,
    };
}
