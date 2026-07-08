// utils/backtest/synth/overlap.ts
// Purpose: align a short-history asset onto a long-history base asset over their
//          common trading calendar, as paired TOTAL-return series (X2-P2.2).
// Invariant: pure, deterministic — no I/O, no Date.now(), no Math.random().
//
// Total return per bar = (close_t + dividends_t) / close_{t-1} − 1.
// The first bar of each series has no predecessor ⇒ it yields no return, so the
// overlap is the intersection of dates for which BOTH series have a defined
// total return (i.e. both have a prior in-series bar).

import type { PricePoint } from '@/types/backtest';
import type { OverlapBar, OverlapResult } from './types';

// ── Per-series total-return map ───────────────────────────────────────────────
// date → total return, keyed on the in-series predecessor (skips the first bar).
function totalReturnByDate(series: PricePoint[]): Map<string, number> {
    const out = new Map<string, number>();
    for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1]!;
        const cur = series[i]!;
        if (prev.close > 0) {
            out.set(cur.date, (cur.close + cur.dividends) / prev.close - 1);
        }
    }
    return out;
}

// ── Realized annualized distribution yield of the short asset over overlap ────
// Σ per-share dividends over the overlap span / (mean close) then annualized by
// the overlap's calendar length. Flat proxy — mirrors JEPQ's monthly cadence
// downstream (see synth/dividends.ts).
function computeAnnualYield(
    short: PricePoint[],
    overlapDates: Set<string>
): number {
    let divSum = 0;
    let closeSum = 0;
    let count = 0;
    let firstDate = '';
    let lastDate = '';
    for (const p of short) {
        if (!overlapDates.has(p.date)) continue;
        divSum += p.dividends;
        if (p.close > 0) {
            closeSum += p.close;
            count += 1;
        }
        if (firstDate === '') firstDate = p.date;
        lastDate = p.date;
    }
    if (count === 0 || firstDate === '' || firstDate === lastDate) return 0;
    const meanClose = closeSum / count;
    if (meanClose <= 0) return 0;
    const spanYears = calendarYears(firstDate, lastDate);
    if (spanYears <= 0) return 0;
    // periodic yield = divSum / meanClose over the span → annualize linearly.
    return divSum / meanClose / spanYears;
}

/** Calendar-year gap between two 'YYYY-MM-DD' dates (UTC, DST-safe). */
function calendarYears(from: string, to: string): number {
    const a = new Date(from + 'T00:00:00Z').getTime();
    const b = new Date(to + 'T00:00:00Z').getTime();
    return (b - a) / (365.25 * 24 * 3600 * 1000);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Align the short and base series on the common trading days where BOTH have a
 * defined total return, returned oldest→newest as paired total-return bars.
 *
 * @throws Error when the overlap is empty (no shared return bars).
 */
export function alignOverlap(
    shortSeries: PricePoint[],
    baseSeries: PricePoint[]
): OverlapResult {
    if (shortSeries.length === 0) {
        throw new Error('alignOverlap: short series is empty');
    }
    const realInception = shortSeries[0]!.date;

    const shortRet = totalReturnByDate(shortSeries);
    const baseRet = totalReturnByDate(baseSeries);

    // Intersect on dates present in BOTH return maps; iterate short in order to
    // keep the output ascending (short series is ascending by contract).
    const bars: OverlapBar[] = [];
    const overlapDates = new Set<string>();
    for (const p of shortSeries) {
        const rShort = shortRet.get(p.date);
        const rBase = baseRet.get(p.date);
        if (rShort === undefined || rBase === undefined) continue;
        bars.push({ date: p.date, rShort, rBase });
        overlapDates.add(p.date);
    }

    if (bars.length === 0) {
        throw new Error(
            'alignOverlap: empty overlap — short and base share no return bars'
        );
    }

    const shortAnnualYield = computeAnnualYield(shortSeries, overlapDates);

    return { bars, realInception, shortAnnualYield };
}
