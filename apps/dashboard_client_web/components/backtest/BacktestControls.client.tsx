'use client';

// components/backtest/BacktestControls.client.tsx
// Purpose: control panel section for BacktestClient — basic + advanced (collapsible).
// Advanced controls (rebalancing, manual flows, per-holding fields) are hidden by
// default so the default UI is byte-identical to pre-X2 (ZERO-REGRESSION invariant).
// Task A: Advanced section is gated to admin only (useMe isAdmin === true).
// X2-P2.9: synthetic history toggle + base select + method selector (JEPQ only,
//   admin-gated). Extracted to SynthControls.client.tsx (Wave-C LOC cleanup).
// Per-source weights: PerSourceWeights owns Original%+DRIP+DCA+Div (unified grid).
// Draft/Apply: all edits go to local draft state; Apply commits to URL in one batch.

import { useState } from 'react';
import type { Holding, PricePoint } from '@/types/backtest';
import { useMe } from '@/hooks/useMe.query.client';
import { useBacktestDraft } from '@/hooks/useBacktestDraft.hook';
import type { BacktestUrlState } from '@/hooks/useBacktestUrl.hook';
import BudgetInput from './BudgetInput';
import AssetPicker from './AssetPicker.client';
import PerSourceWeights from './PerSourceWeights.client';
import DateRangePicker from './DateRangePicker.client';
import ContributionInput from './ContributionInput.client';
import SeedControl from './SeedControl.client';
import RebalancePolicyPanel from './RebalancePolicyPanel.client';
import ManualFlowsEditor from './ManualFlowsEditor.client';
import HoldingAdvancedControls from './HoldingAdvancedControls.client';
import SynthControls from './SynthControls.client';

interface BacktestControlsProps {
    committed: BacktestUrlState;
    seriesFirstDate: Record<string, string>;
    startDateOptions: { label: string; date: string }[];
    ixicSeries: PricePoint[];
    ndxSeries: PricePoint[];
    minAllowedFrom: string;
    onCommit: (next: BacktestUrlState) => void;
}

export default function BacktestControls({
    committed,
    seriesFirstDate,
    startDateOptions,
    ixicSeries,
    ndxSeries,
    minAllowedFrom,
    onCommit,
}: BacktestControlsProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [budgetValid, setBudgetValid] = useState(true);

    // Draft state: editing touches local state only; Apply commits to URL.
    const {
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
    } = useBacktestDraft(committed);

    const {
        budget,
        holdings,
        from,
        to,
        seed,
        contribution,
        rebalance,
        manualFlows,
        synth,
        dividendReinvestByWeight,
    } = draft;

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

    const weightsValid =
        Math.round(holdings.reduce((s, h) => s + h.weightPct, 0)) === 100;

    const canApply = dirty && budgetValid && weightsValid;

    function updateHolding(label: string, patch: Partial<Holding>) {
        const next = holdings.map((h) =>
            h.label === label ? { ...h, ...patch } : h
        );
        setHoldings(next);
        // M1: when a dcaPct value is entered and DCA is active but route is not
        // byDcaWeight, auto-switch so the entered weight actually takes effect.
        if (
            patch.dcaPct !== undefined &&
            contribution !== undefined &&
            contribution.route?.kind !== 'byDcaWeight'
        ) {
            setContribution({
                ...contribution,
                route: { kind: 'byDcaWeight' },
            });
        }
    }

    // Always show per-holding controls when the advanced panel is open, so the
    // canSell / sellPriority / group toggles are REACHABLE.
    const showPerHolding = holdings.length > 0;

    const dcaActive = contribution !== undefined;

    return (
        <section
            aria-label="Backtest controls"
            className="flex flex-col gap-4 rounded-lg border bg-card p-4"
        >
            {/* ── Apply / Reset bar (always visible; enabled only when dirty & valid) ── */}
            <div className="sticky top-0 z-10 flex items-center gap-2 rounded-md border border-border bg-card/95 px-3 py-2 backdrop-blur-sm">
                <span
                    className={`text-xs font-medium ${
                        dirty
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground'
                    }`}
                >
                    {dirty ? '미적용 변경 있음' : '변경 없음'}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={reset}
                        disabled={!dirty}
                        className="rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border disabled:opacity-40 disabled:hover:text-muted-foreground"
                    >
                        되돌리기
                    </button>
                    <button
                        type="button"
                        onClick={() => onCommit(draft)}
                        disabled={!canApply}
                        className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
                    >
                        적용
                    </button>
                </div>
            </div>

            {/* ── Basic controls ─────────────────────────────────────────────── */}
            <BudgetInput
                value={budget}
                onChange={(v, valid) => {
                    setBudget(v);
                    setBudgetValid(valid);
                }}
            />
            <AssetPicker
                holdings={holdings}
                seriesFirstDate={seriesFirstDate}
                onChange={setHoldings}
            />
            <PerSourceWeights
                holdings={holdings}
                dcaActive={dcaActive}
                divActive={dividendReinvestByWeight}
                onUpdateHolding={updateHolding}
                onToggleDiv={setDividendReinvestByWeight}
            />
            <DateRangePicker
                from={from}
                to={to}
                minAllowedFrom={minAllowedFrom}
                startDateOptions={startDateOptions}
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
                            <SynthControls
                                holdings={holdings}
                                synth={synth}
                                setSynth={setSynth}
                            />
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
