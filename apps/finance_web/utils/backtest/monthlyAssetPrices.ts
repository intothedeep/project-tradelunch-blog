// utils/backtest/monthlyAssetPrices.ts
// Purpose: pure derivation of per-asset month-end (split-adjusted) close prices,
//   bucketed to 'YYYY-MM' within [from, to]. Feeds the monthly StatsTable's
//   per-asset price columns. Mirrors monthlyStats' string-slice month logic
//   (no Date objects → no TZ month-boundary shifts).
// Invariant: pure — no I/O, no Date.now(), no mutation of inputs.
// Note: `close` is split-adjusted at source (see splitAdjustDividends in engine.ts),
//   so these prices are consistent with the backtest's return math.

import type { PricePoint } from '@/types/backtest';

export interface MonthlyAssetPrices {
    /** Selected labels that actually have a series, in the given order (deduped). */
    labels: string[];
    /** priceByMonth['YYYY-MM'][label] = month-end split-adjusted close. */
    priceByMonth: Record<string, Record<string, number>>;
}

/**
 * Build month-end close per asset within [from, to].
 * - Series are date-ascending (fetch invariant) → the last bar seen per month
 *   wins, which is the month-end close.
 * - Labels absent from seriesByLabel are dropped (defensive; holdings normally
 *   all have series).
 */
export function buildMonthlyAssetPrices(
    seriesByLabel: Record<string, PricePoint[]>,
    labels: string[],
    from: string,
    to: string
): MonthlyAssetPrices {
    const seen = new Set<string>();
    const outLabels: string[] = [];
    const priceByMonth: Record<string, Record<string, number>> = {};

    for (const label of labels) {
        if (!label || seen.has(label)) continue;
        const series = seriesByLabel[label];
        if (!series) continue;
        seen.add(label);
        outLabels.push(label);

        for (const p of series) {
            if (p.date < from || p.date > to) continue;
            const mo = p.date.slice(0, 7);
            (priceByMonth[mo] ??= {})[label] = p.close;
        }
    }

    return { labels: outLabels, priceByMonth };
}
