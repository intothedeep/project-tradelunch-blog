'use client';

// components/backtest/BacktestControls.client.tsx
// Purpose: control panel section for BacktestClient — basic + advanced (collapsible).
// Advanced controls (rebalancing, manual flows, per-holding fields) are hidden by
// default so the default UI is byte-identical to pre-X2 (ZERO-REGRESSION invariant).
// Task A: Advanced section is gated to admin only (useMe isAdmin === true).
// X2-P2.9: synthetic history toggle + base select + method stub (JEPQ only, admin-gated).

import { useState } from 'react';
import type {
    Holding,
    ContributionPlan,
    RebalancePolicy,
    PricePoint,
} from '@/types/backtest';
import { useMe } from '@/hooks/useMe.query.client';
import type { SynthUrlState } from '@/hooks/useBacktestUrl.hook';
import BudgetInput from './BudgetInput';
import AssetPicker from './AssetPicker.client';
import WeightSliders from './WeightSliders.client';
import DateRangePicker from './DateRangePicker.client';
import ContributionInput from './ContributionInput.client';
import SeedControl from './SeedControl.client';
import RebalancePolicyPanel from './RebalancePolicyPanel.client';
import ManualFlowsEditor from './ManualFlowsEditor.client';
import HoldingAdvancedControls from './HoldingAdvancedControls.client';

// Base options for synthetic history regression.
const SYNTH_BASE_OPTIONS: { value: string; label: string }[] = [
    { value: 'QQQ', label: 'QQQ' },
    { value: 'SPY', label: 'SPY' },
    { value: '^IXIC', label: 'NASDAQ Composite (^IXIC)' },
    { value: '^NDX', label: 'NASDAQ 100 (^NDX)' },
    {
        value: 'QLD',
        label: 'QLD (validation only — 2× leverage, opposite profile)',
    },
    {
        value: 'TQQQ',
        label: 'TQQQ (validation only — 2× leverage, opposite profile)',
    },
];

// Short assets eligible for synthetic history (v1: JEPQ only).
const SYNTH_ELIGIBLE = new Set(['JEPQ']);

interface BacktestControlsProps {
    budget: number;
    holdings: Holding[];
    from: string;
    to: string;
    seed: number;
    contribution: ContributionPlan | undefined;
    seriesFirstDate: Record<string, string>;
    ixicSeries: PricePoint[];
    ndxSeries: PricePoint[];
    minAllowedFrom: string;
    rebalance: RebalancePolicy | undefined;
    manualFlows: { date: string; amount: number }[] | undefined;
    synth: SynthUrlState | undefined;
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
    onBudgetValidChange: (valid: boolean) => void;
}

export default function BacktestControls({
    budget,
    holdings,
    from,
    to,
    seed,
    contribution,
    seriesFirstDate,
    ixicSeries,
    ndxSeries,
    minAllowedFrom,
    rebalance,
    manualFlows,
    synth,
    setBudget,
    setHoldings,
    setRange,
    setContribution,
    setSeed,
    setRebalance,
    setManualFlows,
    setSynth,
    onBudgetValidChange,
}: BacktestControlsProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    // useMe returns {data: undefined} when Clerk is not loaded, signed-out,
    // or the query hasn't resolved. isAdmin is only true when explicitly set.
    const { data: me } = useMe();
    const isAdmin = me?.isAdmin === true;

    const hasAdvancedState =
        (rebalance !== undefined && rebalance.freq !== 'never') ||
        manualFlows !== undefined ||
        synth !== undefined ||
        holdings.some(
            (h) =>
                h.canSell === false ||
                h.sellPriority !== undefined ||
                h.groupId !== undefined
        );

    const advancedOpen = showAdvanced || hasAdvancedState;
    const groupIds = rebalance?.groups.map((g) => g.id) ?? [];
    const labels = holdings.map((h) => h.label);

    // Synth: derived from URL state — no local state needed.
    const eligibleLabel = holdings.find((h) =>
        SYNTH_ELIGIBLE.has(h.label)
    )?.label;
    const synthActive =
        synth?.shortLabel === eligibleLabel && eligibleLabel !== undefined;
    const synthBase = synthActive ? synth!.base : 'QQQ';

    function handleSynthToggle() {
        if (!eligibleLabel) return;
        if (synthActive) {
            setSynth(undefined);
        } else {
            setSynth({
                shortLabel: eligibleLabel,
                base: synthBase,
                method: 'reg',
            });
        }
    }

    function handleBaseChange(base: string) {
        if (!eligibleLabel) return;
        setSynth({ shortLabel: eligibleLabel, base, method: 'reg' });
    }

    function updateHolding(label: string, patch: Partial<Holding>) {
        setHoldings(
            holdings.map((h) => (h.label === label ? { ...h, ...patch } : h))
        );
    }

    // Always show per-holding controls when the advanced panel is open, so the
    // canSell / sellPriority / group toggles are REACHABLE. (Previously gated on
    // already-having-state, which made the sell-lock toggle unreachable — you
    // could never set canSell=false because the control only appeared once it
    // was already set.)
    const showPerHolding = holdings.length > 0;

    return (
        <section
            aria-label="Backtest controls"
            className="flex flex-col gap-4 rounded-lg border bg-card p-4"
        >
            {/* ── Basic controls ─────────────────────────────────────────────── */}
            <BudgetInput
                value={budget}
                onChange={(v, valid) => {
                    setBudget(v);
                    onBudgetValidChange(valid);
                }}
            />
            <AssetPicker
                holdings={holdings}
                seriesFirstDate={seriesFirstDate}
                onChange={setHoldings}
            />
            <WeightSliders
                holdings={holdings}
                onChange={setHoldings}
            />
            <DateRangePicker
                from={from}
                to={to}
                minAllowedFrom={minAllowedFrom}
                ixicSeries={ixicSeries}
                ndxSeries={ndxSeries}
                onChange={setRange}
            />
            <ContributionInput
                value={contribution}
                labels={labels}
                onChange={setContribution}
            />
            <SeedControl
                seed={seed}
                onChange={setSeed}
            />

            {/* ── Advanced toggle (admin only) ─────────────────────────────────── */}
            {isAdmin && (
                <>
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((v) => !v)}
                        className="flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground transition-colors"
                        aria-expanded={advancedOpen}
                    >
                        <span>{advancedOpen ? '▼' : '▶'}</span>
                        고급 / Advanced
                        {hasAdvancedState && (
                            <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-primary text-[10px]">
                                활성
                            </span>
                        )}
                    </button>

                    {/* ── Advanced controls ──────────────────────────────────────── */}
                    {advancedOpen && (
                        <div className="flex flex-col gap-4 border-t border-border pt-4">
                            {showPerHolding && (
                                <div className="flex flex-col gap-3">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        자산 개별 설정
                                    </span>
                                    {holdings.map((h) => (
                                        <div
                                            key={h.label}
                                            className="flex flex-col"
                                        >
                                            <span className="text-xs font-mono font-semibold">
                                                {h.label}
                                            </span>
                                            <HoldingAdvancedControls
                                                holding={h}
                                                groupIds={groupIds}
                                                onChange={(patch) =>
                                                    updateHolding(
                                                        h.label,
                                                        patch
                                                    )
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <RebalancePolicyPanel
                                policy={rebalance}
                                labels={labels}
                                onChange={setRebalance}
                            />
                            <ManualFlowsEditor
                                flows={manualFlows}
                                onChange={setManualFlows}
                            />

                            {/* ── Synthetic history (JEPQ only, v1) ─────────────── */}
                            {eligibleLabel && (
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        합성 과거 (Synthetic History)
                                    </span>
                                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={synthActive}
                                            onChange={handleSynthToggle}
                                            className="h-3.5 w-3.5"
                                        />
                                        <span>
                                            {eligibleLabel} 합성 과거 활성화
                                        </span>
                                    </label>
                                    {synthActive && (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground w-14 shrink-0">
                                                    베이스
                                                </span>
                                                <select
                                                    value={synthBase}
                                                    onChange={(e) =>
                                                        handleBaseChange(
                                                            e.target.value
                                                        )
                                                    }
                                                    className="text-xs rounded border bg-background px-2 py-1 flex-1 min-w-0"
                                                >
                                                    {SYNTH_BASE_OPTIONS.map(
                                                        (o) => (
                                                            <option
                                                                key={o.value}
                                                                value={o.value}
                                                            >
                                                                {o.label}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground w-14 shrink-0">
                                                    방법
                                                </span>
                                                <select
                                                    disabled
                                                    className="text-xs rounded border bg-background px-2 py-1 flex-1 min-w-0 opacity-50 cursor-not-allowed"
                                                >
                                                    <option>Regression</option>
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
