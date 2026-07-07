// components/backtest/ComparisonPanel.tsx
// Purpose: X2-P2b.11 — side-by-side metric table for method=cmp.
// THREE columns: Real-only (headline) | M1 Regression | M2 Structural.
// Both modeled columns carry the SYNTHETIC guardrail via SynthBanner (shared
// path — bypass impossible if this component is the sole cmp render path).
// Pure server component (no interactivity).

import type { BacktestResult, BacktestMetrics } from '@/types/backtest';
import type { SynthPassMeta } from '@/utils/backtest/synth-passes';
import { SynthBanner } from './SynthGuardrail';

interface ComparisonPanelProps {
    /** Pass-1 real-only result (headline). */
    realResult: BacktestResult;
    /** M1 Regression full-span result. */
    regFullResult: BacktestResult;
    /** M2 Structural full-span result. */
    strFullResult: BacktestResult;
    regMeta: SynthPassMeta;
    strMeta: SynthPassMeta;
    riskFreeRate: number;
    hasContribution: boolean;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtPct(v: number, d = 1): string {
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`;
}
function signCls(v: number): string {
    return v > 0
        ? 'text-green-600 dark:text-green-400'
        : v < 0
          ? 'text-red-600 dark:text-red-400'
          : '';
}

// ── sub-components ────────────────────────────────────────────────────────────

interface ColHeaderProps {
    title: string;
    subtitle: string;
    dim?: boolean;
}
function ColHeader({ title, subtitle, dim }: ColHeaderProps) {
    return (
        <div className={`flex flex-col gap-0.5 ${dim ? 'opacity-70' : ''}`}>
            <span className="text-xs font-semibold">{title}</span>
            <span className="text-[10px] text-muted-foreground">
                {subtitle}
            </span>
        </div>
    );
}

interface CellProps {
    value: string;
    colorCls?: string;
    dim?: boolean;
    note?: string;
}
function Cell({ value, colorCls, dim, note }: CellProps) {
    return (
        <td
            className={`px-3 py-1.5 text-xs tabular-nums text-right ${colorCls ?? ''} ${dim ? 'opacity-60' : ''}`}
        >
            {value}
            {note && (
                <span className="ml-1 text-[9px] text-muted-foreground">
                    {note}
                </span>
            )}
        </td>
    );
}

interface MetricRow {
    label: string;
    real: string;
    reg: string;
    str: string;
    realCls?: string;
    regCls?: string;
    strCls?: string;
    regNote?: string;
    strNote?: string;
    isGap?: boolean;
}

// ── row construction ──────────────────────────────────────────────────────────

function buildRows(
    realResult: BacktestResult,
    regFullResult: BacktestResult,
    strFullResult: BacktestResult,
    regMeta: SynthPassMeta,
    strMeta: SynthPassMeta
): MetricRow[] {
    const r = realResult.metrics;
    const reg = regFullResult.metrics;
    const str = strFullResult.metrics;
    const cagrGap = reg.cagr - str.cagr;
    const ddGap = reg.maxDrawdown - str.maxDrawdown;

    function sharpeStr(m: BacktestMetrics): string {
        return m.sharpe !== null ? m.sharpe.toFixed(2) : '—';
    }
    function sharpeCls(m: BacktestMetrics): string {
        return m.sharpe !== null ? signCls(m.sharpe - 1) : '';
    }

    return [
        {
            label: 'CAGR',
            real: fmtPct(r.cagr),
            reg: fmtPct(reg.cagr),
            str: fmtPct(str.cagr),
            realCls: signCls(r.cagr),
            regCls: signCls(reg.cagr),
            strCls: signCls(str.cagr),
        },
        {
            label: 'Sharpe',
            real: sharpeStr(r),
            reg: sharpeStr(reg),
            str: sharpeStr(str),
            realCls: sharpeCls(r),
            regCls: sharpeCls(reg),
            strCls: sharpeCls(str),
        },
        {
            label: 'Max Drawdown',
            real: fmtPct(r.maxDrawdown),
            reg: fmtPct(reg.maxDrawdown),
            str: fmtPct(str.maxDrawdown),
            realCls: signCls(r.maxDrawdown),
            regCls: signCls(reg.maxDrawdown),
            strCls: signCls(str.maxDrawdown),
        },
        {
            label: 'Ann. Vol',
            real: fmtPct(r.volatility),
            reg: fmtPct(reg.volatility),
            str: fmtPct(str.volatility),
        },
        {
            label: 'Ann. Yield',
            real: fmtPct(realResult.projection.income.annualYieldPct),
            reg: fmtPct(regFullResult.projection.income.annualYieldPct),
            str: fmtPct(strFullResult.projection.income.annualYieldPct),
        },
        {
            label: 'R² (fit)',
            real: '—',
            reg: regMeta.r2.toFixed(3),
            str: strMeta.r2.toFixed(3),
        },
        {
            label: '↕ CAGR 범위 (M1 vs M2)',
            real: '—',
            reg: fmtPct(reg.cagr),
            str: fmtPct(str.cagr),
            regCls: signCls(cagrGap),
            strCls: 'text-muted-foreground',
            strNote: 'str=하방 near-full',
            isGap: true,
        },
        {
            label: '↕ MDD 범위 (M1 vs M2)',
            real: '—',
            reg: fmtPct(reg.maxDrawdown),
            str: fmtPct(str.maxDrawdown),
            regCls: signCls(ddGap),
            strCls: 'text-muted-foreground',
            strNote: 'str=more defensible',
            isGap: true,
        },
    ];
}

// ── main component ────────────────────────────────────────────────────────────

export default function ComparisonPanel({
    realResult,
    regFullResult,
    strFullResult,
    regMeta,
    strMeta,
}: ComparisonPanelProps) {
    const rows = buildRows(
        realResult,
        regFullResult,
        strFullResult,
        regMeta,
        strMeta
    );

    return (
        <section
            aria-label="Comparison panel — reg vs structural"
            className="flex flex-col gap-3"
        >
            <h2 className="text-sm font-semibold">
                모델 비교 (M1 Regression vs M2 Structural)
            </h2>

            {/* Shared SYNTHETIC guardrail: one banner covers BOTH modeled columns. */}
            <SynthBanner
                method="cmp"
                meta={regMeta}
                secondaryMeta={strMeta}
            />

            {/* M2 model-risk copy (ELN caveat) */}
            <p className="text-[11px] text-muted-foreground leading-tight">
                M2 Structural: modeled — 실제 JEPQ는 액티브 ELN 오버라이팅,
                기계적 BS 아님. 구조적 하방 추정치로 해석 권장. 범위로 표시
                (평균 금지).
            </p>

            <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="px-3 py-2 text-left text-muted-foreground font-normal w-44">
                                Metric
                            </th>
                            <th className="px-3 py-2 text-right">
                                <ColHeader
                                    title="Real-only"
                                    subtitle={`${regMeta.realInception} ~`}
                                />
                            </th>
                            <th className="px-3 py-2 text-right">
                                <ColHeader
                                    title="M1 Regression"
                                    subtitle="full-span · modeled"
                                    dim
                                />
                            </th>
                            <th className="px-3 py-2 text-right">
                                <ColHeader
                                    title="M2 Structural"
                                    subtitle="full-span · modeled"
                                    dim
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={row.label}
                                className={`border-b border-border last:border-0 ${row.isGap ? 'bg-amber-500/5' : ''}`}
                            >
                                <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                                    {row.label}
                                </td>
                                <Cell
                                    value={row.real}
                                    colorCls={row.realCls}
                                />
                                <Cell
                                    value={row.reg}
                                    colorCls={row.regCls}
                                    dim
                                    note={row.regNote}
                                />
                                <Cell
                                    value={row.str}
                                    colorCls={row.strCls}
                                    dim
                                    note={row.strNote}
                                />
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
