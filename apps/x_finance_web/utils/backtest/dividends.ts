// utils/backtest/dividends.ts
// Purpose: pure 2-phase dividend processing extracted from engine.ts (XE.2).
// SRP: engine orchestrates the walk; this module owns dividend math only.
//
// TWO-PHASE INVARIANT:
//   Phase 1 — snapshot divCash per holding using ex-date share counts (NO mutation).
//   Phase 2 — apply changes (shares / cash) in holdings order.
//   This ensures same-day A→B & B→A routing cycles are correct: both legs read
//   the pre-reinvestment share count from Phase 1.
//
// Invariant: pure function — no I/O, no Date.now(), no Math.random().
// `shares` Map is mutated in-place (engine convention, matches invest.ts).

import type {
    DividendEvent,
    DividendRoute,
    Holding,
    PricePoint,
} from '@/types/backtest';

// ── Local types ───────────────────────────────────────────────────────────────

type DateIndex = Map<string, Map<string, PricePoint>>;
type SharesMap = Map<string, number>;

interface Collected {
    source: string;
    divCash: number;
    route: DividendRoute;
    perShare: number;
}

export interface ApplyDividendsResult {
    cashDelta: number;
    events: DividendEvent[];
    /** Total dividend value attributed to each source label (cash + reinvested). */
    dividendAmounts: Map<string, number>;
}

// ── Route resolution ──────────────────────────────────────────────────────────

/**
 * Resolve the effective DividendRoute for a holding.
 * dividendRoute takes precedence; falls back to legacy drip boolean.
 */
export function resolveRoute(h: Holding): DividendRoute {
    if (h.dividendRoute !== undefined) return h.dividendRoute;
    return h.drip === true ? { kind: 'same' } : { kind: 'cash' };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Apply dividends for one date using a two-phase approach.
 *
 * @param date       - The trading date being processed ('YYYY-MM-DD').
 * @param holdings   - Ordered holding list (same order as engine walk).
 * @param dateIndexes - Pre-built O(1) lookup: label → date → PricePoint.
 * @param shares     - Mutable share counts (mutated in place for reinvestment).
 * @returns cashDelta, DividendEvent[], and per-source dividend amounts.
 *
 * Guard: if target T is missing from dateIndexes, has no bar on `date`, or
 * bar.close ≤ 0 → falls back to cash (deterministic, no buffering).
 * Source attribution: dividendAmounts[source] += divCash regardless of route.
 * routedTo is set to 'cash' for cash payouts or '<targetLabel>' for cross-asset;
 * same-asset reinvestment leaves routedTo undefined (consistent with prior DRIP).
 */
export function applyDividends(
    date: string,
    holdings: Holding[],
    dateIndexes: DateIndex,
    shares: SharesMap
): ApplyDividendsResult {
    // ── Phase 1: compute divCash using ex-date share counts (read-only) ─────
    const collected: Collected[] = [];
    for (const h of holdings) {
        const bar = dateIndexes.get(h.label)?.get(date);
        if (!bar || bar.dividends <= 0) continue;
        const sharesNow = shares.get(h.label) ?? 0;
        if (sharesNow <= 0) continue;
        collected.push({
            source: h.label,
            divCash: sharesNow * bar.dividends,
            route: resolveRoute(h),
            perShare: bar.dividends,
        });
    }

    // ── Phase 2: apply in holdings order ─────────────────────────────────────
    let cashDelta = 0;
    const events: DividendEvent[] = [];
    const dividendAmounts = new Map<string, number>();

    for (const { source, divCash, route, perShare } of collected) {
        // Source attribution is always the originating asset.
        dividendAmounts.set(
            source,
            (dividendAmounts.get(source) ?? 0) + divCash
        );

        if (route.kind === 'cash') {
            cashDelta += divCash;
            events.push({
                date,
                label: source,
                perShare,
                cash: divCash,
                gross: divCash,
                routedTo: 'cash',
            });
        } else if (route.kind === 'same') {
            const bar = dateIndexes.get(source)?.get(date);
            if (bar && bar.close > 0) {
                // Reinvest into same asset — shares.get(source) still equals
                // the Phase-1 snapshot value (no writes happened in Phase 1).
                shares.set(
                    source,
                    (shares.get(source) ?? 0) + divCash / bar.close
                );
                events.push({
                    date,
                    label: source,
                    perShare,
                    cash: 0,
                    gross: divCash,
                });
            } else {
                // close ≤ 0 guard: fallback to cash
                cashDelta += divCash;
                events.push({
                    date,
                    label: source,
                    perShare,
                    cash: divCash,
                    gross: divCash,
                    routedTo: 'cash',
                });
            }
        } else {
            // route.kind === 'asset'
            const T = route.target;
            const targetBar = dateIndexes.get(T)?.get(date);
            if (targetBar && targetBar.close > 0) {
                shares.set(T, (shares.get(T) ?? 0) + divCash / targetBar.close);
                events.push({
                    date,
                    label: source,
                    perShare,
                    cash: 0,
                    gross: divCash,
                    routedTo: T,
                });
            } else {
                // Target missing or close ≤ 0: deterministic cash fallback.
                cashDelta += divCash;
                events.push({
                    date,
                    label: source,
                    perShare,
                    cash: divCash,
                    gross: divCash,
                    routedTo: 'cash',
                });
            }
        }
    }

    return { cashDelta, events, dividendAmounts };
}
