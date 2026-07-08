// components/backtest/statsTable.format.ts
// Purpose: pure formatters extracted from StatsTable to keep that file under 300 LOC.
// No imports — all functions are pure string transforms.

export function fmtUsd(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
}

export function fmtPct(v: number): string {
    return `${(v * 100).toFixed(2)}%`;
}

/** Zero → em-dash; otherwise fmtUsd. */
export function fmtDiv(v: number): string {
    if (v === 0) return '—';
    return fmtUsd(v);
}

/** Per-asset split-adjusted close: 2 decimals so sub-$1 adjusted prices stay legible. */
export function fmtPrice(v: number | undefined): string {
    if (v === undefined) return '—';
    return `$${v.toFixed(2)}`;
}

/** Weight fraction → percentage string, 1 decimal. */
export function fmtWeight(v: number | undefined): string {
    if (v === undefined) return '—';
    return `${(v * 100).toFixed(1)}%`;
}

/** Fractional share count → 3 decimals. */
export function fmtShares(v: number | undefined): string {
    if (v === undefined) return '';
    return `×${v.toFixed(3)}주`;
}

export function pctClass(v: number): string {
    if (v > 0) return 'text-green-600 dark:text-green-400';
    if (v < 0) return 'text-red-500 dark:text-red-400';
    return '';
}
