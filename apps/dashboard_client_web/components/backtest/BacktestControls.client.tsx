'use client';

// components/backtest/BacktestControls.client.tsx
// Purpose: control panel section for BacktestClient — basic + advanced (collapsible).
// Advanced controls (rebalancing, manual flows, per-holding fields) are hidden by
// default so the default UI is byte-identical to pre-X2 (ZERO-REGRESSION invariant).

import { useState } from 'react';
import type {
    Holding,
    ContributionPlan,
    RebalancePolicy,
    PricePoint,
} from '@/types/backtest';
import BudgetInput from './BudgetInput';
import AssetPicker from './AssetPicker.client';
import WeightSliders from './WeightSliders.client';
import DateRangePicker from './DateRangePicker.client';
import ContributionInput from './ContributionInput.client';
import SeedControl from './SeedControl.client';
import RebalancePolicyPanel from './RebalancePolicyPanel.client';
import ManualFlowsEditor from './ManualFlowsEditor.client';
import HoldingAdvancedControls from './HoldingAdvancedControls.client';

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
    setBudget: (v: number) => void;
    setHoldings: (v: Holding[]) => void;
    setRange: (from: string, to: string) => void;
    setContribution: (plan: ContributionPlan | undefined) => void;
    setSeed: (v: number) => void;
    setRebalance: (policy: RebalancePolicy | undefined) => void;
    setManualFlows: (
        flows: { date: string; amount: number }[] | undefined
    ) => void;
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
    setBudget,
    setHoldings,
    setRange,
    setContribution,
    setSeed,
    setRebalance,
    setManualFlows,
    onBudgetValidChange,
}: BacktestControlsProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);

    const hasAdvancedState =
        (rebalance !== undefined && rebalance.freq !== 'never') ||
        manualFlows !== undefined ||
        holdings.some(
            (h) =>
                h.canSell === false ||
                h.sellPriority !== undefined ||
                h.groupId !== undefined
        );

    const advancedOpen = showAdvanced || hasAdvancedState;
    const groupIds = rebalance?.groups.map((g) => g.id) ?? [];
    const labels = holdings.map((h) => h.label);

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
                onChange={setContribution}
            />
            <SeedControl
                seed={seed}
                onChange={setSeed}
            />

            {/* ── Advanced toggle ─────────────────────────────────────────────── */}
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

            {/* ── Advanced controls ───────────────────────────────────────────── */}
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
                                            updateHolding(h.label, patch)
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
                </div>
            )}
        </section>
    );
}
