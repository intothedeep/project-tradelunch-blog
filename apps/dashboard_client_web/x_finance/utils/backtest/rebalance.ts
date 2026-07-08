// utils/backtest/rebalance.ts
// Purpose: rebalance orchestrator for the engine date-walk (X2 Wave-2).
//          Compute helpers extracted to rebalance-apply.ts (LOC SRP split).
// Invariant: pure — no I/O; shares/cash mutated in place (engine convention).

import type {
    Holding,
    PricePoint,
    RebalancePolicy,
    RebalanceState,
} from '@/types/backtest';
import { buildEffectiveTargets } from './targets';
import { isRebalanceDue } from './rebalance-schedule';
import { evaluateTriggers } from './triggers';
import {
    computeDriftBandTrades,
    applyFiredAction,
    computeTurnover,
} from './rebalance-apply';
import { computeWeights, isGateConditionMet } from './rebalance-gate';

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single trade instruction produced by computeDriftBandTrades. */
export interface RebalanceTrade {
    label: string;
    deltaShares: number; // positive = buy, negative = sell
    deltaCash: number; // positive = cash received (sale), negative = cash spent (buy)
}

/** Snapshot of per-label market value + NAV for a given date. */
export interface PortfolioSnapshot {
    values: Map<string, number>; // label → market value
    totalNav: number; // Σ values + cash
}

// ── Snapshot helper ───────────────────────────────────────────────────────────

/**
 * Compute current per-label market value and total NAV.
 * Labels with no bar on `date` contribute 0 to their value
 * (same guard as invest.ts: missing bar = excluded).
 */
export function computePortfolioSnapshot(
    shares: Map<string, number>,
    cash: number,
    holdings: Holding[],
    dateIndexes: Map<string, Map<string, PricePoint>>,
    date: string
): PortfolioSnapshot {
    const values = new Map<string, number>();
    let totalNav = cash;
    for (const h of holdings) {
        const bar = dateIndexes.get(h.label)?.get(date);
        const qty = shares.get(h.label) ?? 0;
        const val = bar && bar.close > 0 ? qty * bar.close : 0;
        values.set(h.label, val);
        totalNav += val;
    }
    return { values, totalNav };
}

// Re-export trade helpers so existing test imports via rebalance.ts still compile.
export { computeDriftBandTrades } from './rebalance-apply';

// ── Main rebalanceIfDue ───────────────────────────────────────────────────────

/**
 * Rebalance hook called once per bar, after dividends + DCA and before snapshot.
 *
 * Wave-2: fully implemented (X2.6 + X2.10).
 *
 * Behaviour when policy is undefined ⇒ immediate no-op (returns cash unchanged,
 * state untouched — byte-identical to Wave-0).
 *
 * When policy is set (per-bar order):
 *   1. Compute effectiveTargets from policy.
 *   2. Evaluate triggers (every bar, freq-independent) → FiredAction[].
 *      Apply actions in priority order; snapAll → run drift-band trades.
 *   3. Drift-band / gate rebalance: only when isRebalanceDue(freq) fires.
 *      - Without scheduleGate: existing drift-band behaviour (backward-compat).
 *      - With scheduleGate: armNext or gated mode (R2 extension).
 *   4. Append event to state.events; push any warnings to state.warnings.
 *
 * NOTE: advanceRunState is called by the engine BEFORE this function each bar.
 *
 * @returns Updated cash balance.
 */
export function rebalanceIfDue(
    date: string,
    shares: Map<string, number>,
    cash: number,
    state: RebalanceState,
    policy: RebalancePolicy | undefined,
    holdings: Holding[],
    dateIndexes: Map<string, Map<string, PricePoint>>
): number {
    if (!policy) return cash;

    const effectiveTargets = buildEffectiveTargets(holdings, policy);
    const snapshot = computePortfolioSnapshot(
        shares,
        cash,
        holdings,
        dateIndexes,
        date
    );

    let currentCash = cash;
    const allTrades: RebalanceTrade[] = [];

    // ── Step 1: evaluate triggers (every bar) ────────────────────────────────
    // Pass state.warnings so canSell-blocked triggers surface a warning.
    const actions = evaluateTriggers(
        policy,
        state,
        shares,
        currentCash,
        holdings,
        dateIndexes,
        date,
        effectiveTargets,
        state.warnings
    );

    for (const action of actions) {
        if (action.op === 'snapAll') {
            // Trigger-driven drift-band rebalance (freq-independent).
            const driftTrades = computeDriftBandTrades(
                effectiveTargets,
                computePortfolioSnapshot(
                    shares,
                    currentCash,
                    holdings,
                    dateIndexes,
                    date
                ),
                policy,
                holdings,
                dateIndexes,
                date
            );
            for (const t of driftTrades) {
                shares.set(t.label, (shares.get(t.label) ?? 0) + t.deltaShares);
                currentCash += t.deltaCash;
                allTrades.push(t);
            }
        } else {
            const freshSnap = computePortfolioSnapshot(
                shares,
                currentCash,
                holdings,
                dateIndexes,
                date
            );
            const { cash: newCash, trades } = applyFiredAction(
                action,
                shares,
                currentCash,
                holdings,
                dateIndexes,
                date,
                freshSnap,
                state.warnings
            );
            currentCash = newCash;
            allTrades.push(...trades);
        }
    }

    // ── Step 2: scheduled drift-band / gate rebalance ────────────────────────
    const due = isRebalanceDue(
        policy.freq,
        state.lastRebalanceDate,
        date,
        policy.months
    );
    const gate = policy.scheduleGate;

    if (!gate) {
        // Backward-compatible path: drift-band on schedule.
        if (due) {
            const driftTrades = computeDriftBandTrades(
                effectiveTargets,
                computePortfolioSnapshot(
                    shares,
                    currentCash,
                    holdings,
                    dateIndexes,
                    date
                ),
                policy,
                holdings,
                dateIndexes,
                date
            );
            for (const t of driftTrades) {
                shares.set(t.label, (shares.get(t.label) ?? 0) + t.deltaShares);
                currentCash += t.deltaCash;
                allTrades.push(t);
            }
            state.lastRebalanceDate = date;
        }
    } else {
        // Gate path (R2): 2-axis model (checkAt × executeAt).
        const checkNow =
            gate.checkAt === 'always' || (gate.checkAt === 'schedule' && due);
        const weights = checkNow
            ? computeWeights(shares, currentCash, holdings, dateIndexes, date)
            : new Map<string, number>();
        const met = checkNow && isGateConditionMet(gate.conditions, weights);

        const fullRebalance = () => {
            const fullPolicy: RebalancePolicy = {
                ...policy,
                band: { kind: 'absolute', pct: 0 },
            };
            const gateTrades = computeDriftBandTrades(
                effectiveTargets,
                computePortfolioSnapshot(
                    shares,
                    currentCash,
                    holdings,
                    dateIndexes,
                    date
                ),
                fullPolicy,
                holdings,
                dateIndexes,
                date
            );
            for (const t of gateTrades) {
                shares.set(t.label, (shares.get(t.label) ?? 0) + t.deltaShares);
                currentCash += t.deltaCash;
                allTrades.push(t);
            }
        };

        if (gate.executeAt === 'immediate') {
            // schedule+immediate: rebalance on due date only if condition met.
            // always+immediate:   rebalance the instant the condition is met on any bar.
            if (met) fullRebalance();
            if (due) state.lastRebalanceDate = date;
        } else {
            // executeAt === 'nextSchedule'
            // Fire a PREVIOUSLY-armed rebalance first (arm and fire never collide on
            // the same due bar — firing consumes the arm before re-arming below).
            if (due && state.armedRebalance) {
                fullRebalance();
                state.armedRebalance = false;
            }
            if (met) state.armedRebalance = true;
            if (due) state.lastRebalanceDate = date;
        }
    }

    // ── Step 3: record event if any trades occurred ──────────────────────────
    if (allTrades.length > 0) {
        const navForTurnover = snapshot.totalNav;
        state.events.push({
            date,
            trades: allTrades.map((t) => ({
                label: t.label,
                deltaShares: t.deltaShares,
                deltaCash: t.deltaCash,
            })),
            turnover: computeTurnover(allTrades, navForTurnover),
        });
    }

    return currentCash;
}
