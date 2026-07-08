// utils/backtest/rebalance-apply.ts
// Purpose: pure trade-computation and action-application helpers for rebalance (X2 Wave-2).
// Extracted from rebalance.ts to respect the ≤300 LOC SRP boundary.
// Invariant: pure — no I/O; shares/cash mutated in place (engine convention).

import type { Holding, PricePoint, RebalancePolicy } from '@/types/backtest';
import type { RebalanceTrade, PortfolioSnapshot } from './rebalance';
import type { FiredAction } from './triggers';

// ── Drift-band trades ─────────────────────────────────────────────────────────

/**
 * Compute trades needed to snap portfolio toward effective targets, respecting
 * the drift band from policy.
 *
 * Rules:
 *   - Labels with no price bar on `date` are excluded (no trade generated).
 *   - canSell===false labels are NEVER trimmed; their over-weight is frozen and
 *     the remaining effective targets are renormalized over the free labels.
 *   - Trims are ordered by sellPriority ascending (ties resolved by holdings
 *     array order); only labels that exceed their target + band threshold are trimmed.
 *   - Proceeds from trims + available cash fund buys (cash-neutral overall).
 *   - Fractional shares are used throughout.
 *   - NAV is preserved (no fees modeled).
 */
export function computeDriftBandTrades(
    effectiveTargets: Map<string, number>,
    snapshot: PortfolioSnapshot,
    policy: RebalancePolicy,
    holdings: Holding[],
    dateIndexes: Map<string, Map<string, PricePoint>>,
    date: string
): RebalanceTrade[] {
    const { values, totalNav } = snapshot;
    if (totalNav <= 0) return [];

    const band = policy.band;

    // Build a lookup for holding metadata.
    const holdingMeta = new Map<
        string,
        { canSell: boolean; sellPriority: number; idx: number }
    >();
    holdings.forEach((h, idx) => {
        holdingMeta.set(h.label, {
            canSell: h.canSell !== false, // default true
            sellPriority: h.sellPriority ?? 0,
            idx,
        });
    });

    // Only operate on labels that have a price bar today.
    const tradeable = new Set<string>();
    for (const h of holdings) {
        const bar = dateIndexes.get(h.label)?.get(date);
        if (bar && bar.close > 0) tradeable.add(h.label);
    }

    if (tradeable.size === 0) return [];

    // Identify locked (canSell===false) labels that are over-weight.
    // Their weight is frozen; remaining effective targets are renormalized.
    const lockedOverWeightFraction = new Map<string, number>();
    let freeTargetSum = 0;

    for (const [label, target] of effectiveTargets) {
        if (!tradeable.has(label)) continue;
        const meta = holdingMeta.get(label);
        const currentWeight = (values.get(label) ?? 0) / totalNav;
        if (meta && !meta.canSell && currentWeight > target) {
            lockedOverWeightFraction.set(label, currentWeight);
        } else {
            freeTargetSum += target;
        }
    }

    // Renormalize free targets.
    const lockedCurrentSum = Array.from(
        lockedOverWeightFraction.values()
    ).reduce((s, v) => s + v, 0);
    const freeNavFraction = 1 - lockedCurrentSum;
    const adjustedTargets = new Map<string, number>();

    for (const [label, target] of effectiveTargets) {
        if (!tradeable.has(label)) continue;
        if (lockedOverWeightFraction.has(label)) {
            // Freeze at current weight.
            adjustedTargets.set(label, lockedOverWeightFraction.get(label)!);
        } else if (freeTargetSum > 0) {
            // Renormalize within free portion of NAV.
            adjustedTargets.set(
                label,
                (target / freeTargetSum) * freeNavFraction
            );
        } else {
            adjustedTargets.set(label, 0);
        }
    }

    // Determine which labels are in-band vs out-of-band.
    const isBandBreached = (label: string): boolean => {
        const target = adjustedTargets.get(label) ?? 0;
        const current = (values.get(label) ?? 0) / totalNav;
        const diff = Math.abs(current - target);
        if (band.kind === 'absolute') return diff > band.pct / 100;
        // relative: breach if |current - target| / target > threshold
        return target > 0 ? diff / target > band.pct / 100 : diff > 0;
    };

    // Collect sells (over-target, canSell, in-band breach).
    const sellCandidates: Array<{
        label: string;
        sellPriority: number;
        idx: number;
        overshoot: number; // in dollars
    }> = [];

    for (const [label, target] of adjustedTargets) {
        if (lockedOverWeightFraction.has(label)) continue; // never trim locked-over
        const meta = holdingMeta.get(label);
        if (!meta || !meta.canSell) continue;
        const currentVal = values.get(label) ?? 0;
        const targetVal = target * totalNav;
        if (currentVal > targetVal && isBandBreached(label)) {
            sellCandidates.push({
                label,
                sellPriority: meta.sellPriority,
                idx: meta.idx,
                overshoot: currentVal - targetVal,
            });
        }
    }

    // Sort sells: ascending sellPriority, then holdings array order (stable).
    sellCandidates.sort((a, b) =>
        a.sellPriority !== b.sellPriority
            ? a.sellPriority - b.sellPriority
            : a.idx - b.idx
    );

    // Collect buys (under-target, band-breached).
    const buyCandidates: Array<{ label: string; undershoot: number }> = [];
    for (const [label, target] of adjustedTargets) {
        const currentVal = values.get(label) ?? 0;
        const targetVal = target * totalNav;
        if (currentVal < targetVal && isBandBreached(label)) {
            buyCandidates.push({ label, undershoot: targetVal - currentVal });
        }
    }

    if (sellCandidates.length === 0 && buyCandidates.length === 0) return [];

    const trades: RebalanceTrade[] = [];

    // Execute sells in priority order.
    let availableCash = 0;
    for (const { label, overshoot } of sellCandidates) {
        const bar = dateIndexes.get(label)!.get(date)!;
        const sharesToSell = overshoot / bar.close;
        trades.push({
            label,
            deltaShares: -sharesToSell,
            deltaCash: overshoot,
        });
        availableCash += overshoot;
    }

    // Fund buys from sell proceeds.
    const totalUndershoot = buyCandidates.reduce((s, b) => s + b.undershoot, 0);
    const spendable = availableCash; // conservative: only newly freed cash

    for (const { label, undershoot } of buyCandidates) {
        const alloc =
            totalUndershoot > 0
                ? (undershoot / totalUndershoot) * spendable
                : 0;
        if (alloc <= 0) continue;
        const bar = dateIndexes.get(label)!.get(date)!;
        const sharesToBuy = alloc / bar.close;
        trades.push({
            label,
            deltaShares: sharesToBuy,
            deltaCash: -alloc,
        });
    }

    return trades;
}

// ── Apply a single FiredAction ────────────────────────────────────────────────

/**
 * Apply one FiredAction to shares/cash in-place.
 * Returns updated cash. Skipped actions (canSell guard) push to warnings.
 */
export function applyFiredAction(
    action: FiredAction,
    shares: Map<string, number>,
    cash: number,
    holdings: Holding[],
    dateIndexes: Map<string, Map<string, PricePoint>>,
    date: string,
    snapshot: PortfolioSnapshot,
    warnings: string[]
): { cash: number; trades: RebalanceTrade[] } {
    const trades: RebalanceTrade[] = [];

    if (action.op === 'snapAll') {
        // snapAll is a signal to the caller (rebalanceIfDue) to run drift-band trades.
        // No direct mutation here; the caller handles it.
        return { cash, trades };
    }

    const { totalNav } = snapshot;
    if (totalNav <= 0) return { cash, trades };

    const label = action.label;
    const bar = dateIndexes.get(label)?.get(date);
    if (!bar || bar.close <= 0) return { cash, trades };

    const currentVal = snapshot.values.get(label) ?? 0;
    const targetVal = (action.toWeightPct / 100) * totalNav;

    if (action.op === 'trim') {
        // Sell-side: check canSell
        const h = holdings.find((x) => x.label === label);
        if (h && h.canSell === false) {
            warnings.push(
                `trim skipped for "${label}" on ${date}: canSell===false`
            );
            return { cash, trades };
        }
        if (currentVal <= targetVal) return { cash, trades }; // nothing to sell
        const overshoot = currentVal - targetVal;
        const sharesToSell = overshoot / bar.close;
        shares.set(label, (shares.get(label) ?? 0) - sharesToSell);
        const newCash = cash + overshoot;
        trades.push({
            label,
            deltaShares: -sharesToSell,
            deltaCash: overshoot,
        });
        return { cash: newCash, trades };
    }

    // op === 'buy'
    if (currentVal >= targetVal) return { cash, trades }; // already at or above target
    const undershoot = targetVal - currentVal;
    const spend = Math.min(undershoot, cash); // never spend more than available
    if (spend <= 0) return { cash, trades };
    const sharesToBuy = spend / bar.close;
    shares.set(label, (shares.get(label) ?? 0) + sharesToBuy);
    const newCash = cash - spend;
    trades.push({ label, deltaShares: sharesToBuy, deltaCash: -spend });
    return { cash: newCash, trades };
}

// ── Compute turnover from trades ──────────────────────────────────────────────

export function computeTurnover(
    trades: RebalanceTrade[],
    totalNav: number
): number {
    if (totalNav <= 0) return 0;
    const totalSold = trades.reduce(
        (s, t) => (t.deltaCash > 0 ? s + t.deltaCash : s),
        0
    );
    return totalSold / totalNav;
}
