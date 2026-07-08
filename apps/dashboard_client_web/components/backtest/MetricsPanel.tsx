// components/backtest/MetricsPanel.tsx
// Purpose: summary statistics from BacktestMetrics.
// Shows CAGR (lump-only) or XIRR (DCA). Always shows totalContributed.
// X2.14: when rebalance present, shows event count, total turnover, warnings.
// X2-P2.11: dual metrics (real-only headline + full-span advisory) + synth warnings.

import type { BacktestMetrics, BacktestResult } from '@/types/backtest';
import type { SynthBacktestMeta } from '@/hooks/useSyntheticBacktest.hook';

interface MetricsPanelProps {
    metrics: BacktestMetrics;
    budget: number;
    riskFreeRate: number;
    hasContribution?: boolean;
    /** Portfolio value at the start of the range (first timeline bar). */
    initialValue?: number;
    /** Backtest span in years — used to discount Final Value to present value. */
    years?: number;
    /** User-chosen annual inflation rate (percent) for the PV discount. */
    inflationPct?: number;
    /** Setter for the inflation rate; when present the PV control is shown. */
    onInflationChange?: (pct: number) => void;
    /** X2.14 — rebalance audit trail; absent = no rebalance section rendered. */
    rebalance?: BacktestResult['rebalance'];
    /** X2-P2.11: synth metadata for R²/cap warnings (shown when synth active). */
    synthMeta?: SynthBacktestMeta;
}

function fmt$(v: number): string {
    return v.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    });
}
function fmtPct(v: number, decimals = 1): string {
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(decimals)}%`;
}

interface CardProps {
    label: string;
    value: string;
    positive?: boolean;
    negative?: boolean;
    dim?: boolean;
}

function Card({ label, value, positive, negative, dim }: CardProps) {
    const color = positive
        ? 'text-green-600 dark:text-green-400'
        : negative
          ? 'text-red-600 dark:text-red-400'
          : '';
    return (
        <div
            className={`flex flex-col gap-0.5 rounded-md border bg-card p-3 ${dim ? 'opacity-60' : ''}`}
        >
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={`text-lg font-semibold tabular-nums ${color}`}>
                {value}
            </span>
        </div>
    );
}

// ── metrics grid (reusable for both passes) ────────────────────────────────────

interface MetricsGridProps {
    metrics: BacktestMetrics;
    riskFreeRate: number;
    hasContribution?: boolean;
    /** Portfolio value at the start of the range (first timeline bar). */
    initialValue?: number;
    /** Inflation-discounted final value (present value in start-date dollars). */
    presentValue?: number;
    dim?: boolean;
}

function MetricsGrid({
    metrics,
    riskFreeRate,
    hasContribution,
    initialValue,
    presentValue,
    dim,
}: MetricsGridProps) {
    const {
        finalValue,
        totalReturnPct,
        cagr,
        maxDrawdown,
        cumulativeDividends,
        sharpe,
        totalContributed,
        moneyWeightedReturn,
    } = metrics;

    const profit = finalValue - totalContributed;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2">
            {initialValue !== undefined && (
                <Card
                    label="시작 평가액"
                    value={fmt$(initialValue)}
                    dim={dim}
                />
            )}
            <Card
                label="Final Value"
                value={fmt$(finalValue)}
                positive={profit > 0}
                negative={profit < 0}
                dim={dim}
            />
            {presentValue !== undefined && (
                <Card
                    label="현재가치 (PV)"
                    value={fmt$(presentValue)}
                    dim={dim}
                />
            )}
            <Card
                label="Total Invested"
                value={fmt$(totalContributed)}
                dim={dim}
            />
            <Card
                label={hasContribution ? 'vs Invested' : 'Total Return'}
                value={fmtPct(totalReturnPct)}
                positive={totalReturnPct > 0}
                negative={totalReturnPct < 0}
                dim={dim}
            />
            {hasContribution ? (
                <Card
                    label="Money-Weighted Return (XIRR)"
                    value={
                        moneyWeightedReturn !== null
                            ? fmtPct(moneyWeightedReturn)
                            : '—'
                    }
                    positive={
                        moneyWeightedReturn !== null && moneyWeightedReturn > 0
                    }
                    negative={
                        moneyWeightedReturn !== null && moneyWeightedReturn < 0
                    }
                    dim={dim}
                />
            ) : (
                <Card
                    label="CAGR"
                    value={fmtPct(cagr)}
                    positive={cagr > 0}
                    negative={cagr < 0}
                    dim={dim}
                />
            )}
            <Card
                label="Max Drawdown"
                value={fmtPct(maxDrawdown)}
                negative={maxDrawdown < 0}
                dim={dim}
            />
            <Card
                label="Dividends Received"
                value={fmt$(cumulativeDividends)}
                positive={cumulativeDividends > 0}
                dim={dim}
            />
            {sharpe !== null && (
                <Card
                    label={`Sharpe (rf=${(riskFreeRate * 100).toFixed(1)}%)`}
                    value={sharpe.toFixed(2)}
                    positive={sharpe > 1}
                    negative={sharpe < 0}
                    dim={dim}
                />
            )}
        </div>
    );
}

// ── X2.14: rebalance summary strip ────────────────────────────────────────────

interface RebalanceSummaryProps {
    rebalance: NonNullable<BacktestResult['rebalance']>;
}

function RebalanceSummary({ rebalance }: RebalanceSummaryProps) {
    const events = rebalance.events ?? [];
    const warnings = rebalance.warnings ?? [];

    if (events.length === 0 && warnings.length === 0) return null;

    const totalTurnover = events.reduce((s, e) => s + e.turnover, 0);

    return (
        <div className="rounded-md border bg-muted/30 px-4 py-3 flex flex-col gap-2">
            <div className="flex flex-wrap gap-4 text-xs">
                <span className="text-muted-foreground">
                    리밸런싱{' '}
                    <span className="font-semibold text-foreground">
                        {events.length}회
                    </span>
                </span>
                {totalTurnover > 0 && (
                    <span className="text-muted-foreground">
                        총 회전율{' '}
                        <span className="font-semibold text-foreground">
                            {fmtPct(totalTurnover, 1)}
                        </span>
                    </span>
                )}
            </div>
            {warnings.length > 0 && (
                <ul className="flex flex-col gap-0.5">
                    {warnings.map((w, i) => (
                        <li
                            key={i}
                            className="text-[11px] text-amber-600 dark:text-amber-400"
                        >
                            {w}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ── X2-P2.11: synth warnings (R² floor + horizon cap) ─────────────────────────

interface SynthWarningsProps {
    meta: SynthBacktestMeta;
}

function SynthWarnings({ meta }: SynthWarningsProps) {
    const warnings: string[] = [];
    if (meta.r2 < 0.8) {
        warnings.push(
            `낮은 적합도 — 합성 신뢰도 낮음 (R²=${meta.r2.toFixed(3)}, 임계값 0.80 미만)`
        );
    }
    if (meta.cappedAt !== undefined) {
        warnings.push(
            `합성 기간 상한 적용됨 — ${meta.cappedAt.toFixed(1)}년 (overlap 2× 규칙)`
        );
    }
    if (warnings.length === 0) return null;
    return (
        <ul className="flex flex-col gap-0.5 mt-1">
            {warnings.map((w, i) => (
                <li
                    key={i}
                    className="text-[11px] font-medium text-red-600 dark:text-red-400"
                >
                    ⚠ {w}
                </li>
            ))}
        </ul>
    );
}

// ── main component ────────────────────────────────────────────────────────────

export default function MetricsPanel({
    metrics,
    riskFreeRate,
    hasContribution,
    initialValue,
    years,
    inflationPct,
    onInflationChange,
    rebalance,
    synthMeta,
}: MetricsPanelProps) {
    // Present value = Final Value discounted by the chosen annual inflation over
    // the backtest span (real value in start-date purchasing power).
    const presentValue =
        years !== undefined && years > 0 && inflationPct !== undefined
            ? metrics.finalValue / Math.pow(1 + inflationPct / 100, years)
            : undefined;

    return (
        <section
            aria-label="Portfolio metrics"
            className="flex flex-col gap-3"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Summary</h2>
                {onInflationChange && (
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        인플레이션
                        <input
                            type="number"
                            min={0}
                            max={20}
                            step={0.5}
                            value={inflationPct ?? 0}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (isFinite(v) && v >= 0) onInflationChange(v);
                            }}
                            className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                            aria-label="Annual inflation % for present value"
                        />
                        %/년 → 현재가치
                    </label>
                )}
            </div>

            <MetricsGrid
                metrics={metrics}
                riskFreeRate={riskFreeRate}
                hasContribution={hasContribution}
                initialValue={initialValue}
                presentValue={presentValue}
            />

            {/* Synth reliability warnings (R² floor / horizon cap) when active. */}
            {synthMeta && <SynthWarnings meta={synthMeta} />}

            {rebalance && <RebalanceSummary rebalance={rebalance} />}
        </section>
    );
}
