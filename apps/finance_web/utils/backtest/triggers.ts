// utils/backtest/triggers.ts
// Purpose: per-bar state machine for extrema tracking and trigger evaluation (X2.9).
// Invariant: pure functions — no I/O, no Date.now(), no Math.random(), deterministic.
// advanceRunState mutates RebalanceState in-place (engine convention).

import type {
    AssetRunState,
    Holding,
    PricePoint,
    RebalancePolicy,
    RebalanceState,
} from '@/types/backtest';

// ── FiredAction union ─────────────────────────────────────────────────────────

/** Discriminated union of actions returned by evaluateTriggers. */
export type FiredAction =
    | { op: 'snapAll' }
    | { op: 'trim'; label: string; toWeightPct: number }
    | { op: 'buy'; label: string; toWeightPct: number };

// ── Default constants ─────────────────────────────────────────────────────────

const DEFAULT_BEAR_THRESHOLD_PCT = 20;

// ── advanceRunState ───────────────────────────────────────────────────────────

/**
 * Advance the per-asset extrema + bear-market state machine for one bar.
 *
 * For each label that has a price bar on `date`:
 *   - First bar ever: peak = trough = close, inBear = false.
 *   - Subsequent bars:
 *       • Enter bear when close ≤ peak × (1 − bearThresholdPct/100) and not already inBear.
 *       • While inBear, track minimum as trough.
 *       • Exit bear (reset peak to close, trough to close) when close ≥ peak (new peak).
 *       • When not inBear, update peak if close is higher.
 *
 * Missing bar for a label → HOLD (no advance, no reset — deterministic).
 *
 * bearThresholdPct is taken from the first `takeProfit` trigger for the label
 * (if any), otherwise DEFAULT_BEAR_THRESHOLD_PCT.
 */
export function advanceRunState(
    state: RebalanceState,
    holdings: Holding[],
    dateIndexes: Map<string, Map<string, PricePoint>>,
    date: string
): void {
    for (const h of holdings) {
        const bar = dateIndexes.get(h.label)?.get(date);
        if (!bar || bar.close <= 0) continue; // missing bar → HOLD

        const close = bar.close;
        const existing = state.assets.get(h.label);

        if (existing === undefined) {
            // First bar: initialise state.
            state.assets.set(h.label, {
                peak: close,
                trough: close,
                lastBuyPrice: 0,
                inBear: false,
            });
            continue;
        }

        // Resolve bearThresholdPct for this label.
        const bearThresholdPct = DEFAULT_BEAR_THRESHOLD_PCT;

        updateAssetState(existing, close, bearThresholdPct);
    }
}

/**
 * Mutate a single AssetRunState given the new close price.
 * Extracted so it can be tested in isolation.
 */
export function updateAssetState(
    s: AssetRunState,
    close: number,
    bearThresholdPct: number
): void {
    const bearEntryThreshold = s.peak * (1 - bearThresholdPct / 100);

    if (!s.inBear) {
        if (close <= bearEntryThreshold) {
            // Enter bear.
            s.inBear = true;
            s.trough = close;
        } else {
            // Normal: keep running peak.
            if (close > s.peak) s.peak = close;
        }
    } else {
        // In bear.
        if (close >= s.peak) {
            // New peak → exit bear, reset.
            s.inBear = false;
            s.peak = close;
            s.trough = close;
        } else {
            // Track minimum trough while in bear.
            if (close < s.trough) s.trough = close;
        }
    }
}

// ── evaluateTriggers ──────────────────────────────────────────────────────────

/**
 * Evaluate all triggers from `policy` against the current snapshot NAV.
 *
 * Fixed priority order: weightCap → takeProfit → driftBand → buyDip → weightFloor.
 * Returns actions in that priority; Wave-2 applies them sequentially.
 *
 * Snapshot NAV is computed from shares×close + cash (post-DCA basis).
 *
 * canSell===false: sell-side triggers (takeProfit, weightCap) produce NO action.
 *   For takeProfit: if the trigger WOULD fire but canSell===false, a warning is
 *   pushed to `warnings` (when provided) so the caller can surface it.
 * driftBand: detection only (band breach check); scheduling (freq gate) handled
 *            by X2.4 caller — this function never looks at lastRebalanceDate.
 *
 * Missing bar for a label → that label is excluded from trigger evaluation
 * (same guard as invest.ts).
 *
 * @param warnings - Optional array to accumulate canSell-blocked trigger warnings.
 */
export function evaluateTriggers(
    policy: RebalancePolicy,
    state: RebalanceState,
    shares: Map<string, number>,
    cash: number,
    holdings: Holding[],
    dateIndexes: Map<string, Map<string, PricePoint>>,
    date: string,
    effectiveTargets: Map<string, number>,
    warnings?: string[]
): FiredAction[] {
    const triggers = policy.triggers ?? [];
    if (triggers.length === 0) return [];

    // Compute per-label values and NAV.
    const values = new Map<string, number>();
    let totalNav = cash;
    for (const h of holdings) {
        const bar = dateIndexes.get(h.label)?.get(date);
        const qty = shares.get(h.label) ?? 0;
        const val = bar && bar.close > 0 ? qty * bar.close : 0;
        values.set(h.label, val);
        totalNav += val;
    }

    // Build canSell lookup.
    const canSellMap = new Map<string, boolean>(
        holdings.map((h) => [h.label, h.canSell !== false])
    );

    const actions: FiredAction[] = [];

    // Helper: check if a label has a valid bar.
    const hasBar = (label: string): boolean => {
        const bar = dateIndexes.get(label)?.get(date);
        return bar !== undefined && bar.close > 0;
    };

    // Priority 1: weightCap
    for (const t of triggers) {
        if (t.kind !== 'weightCap') continue;
        if (!hasBar(t.label)) continue;
        if (!canSellMap.get(t.label)) continue; // canSell===false → no action
        const currentWeight =
            totalNav > 0 ? ((values.get(t.label) ?? 0) / totalNav) * 100 : 0;
        if (currentWeight > t.pct) {
            actions.push({ op: 'trim', label: t.label, toWeightPct: t.pct });
        }
    }

    // Priority 2: takeProfit
    for (const t of triggers) {
        if (t.kind !== 'takeProfit') continue;
        if (!hasBar(t.label)) continue;
        const assetState = state.assets.get(t.label);
        if (!assetState) continue; // no state yet (first bar)
        if (!assetState.inBear) continue; // takeProfit only fires while in bear
        const bar = dateIndexes.get(t.label)!.get(date)!;
        const gainThreshold = assetState.trough * (1 + t.gainPct / 100);
        if (bar.close >= gainThreshold) {
            if (!canSellMap.get(t.label)) {
                // canSell===false: warn but do not emit action.
                warnings?.push(
                    `takeProfit skipped for "${t.label}" on ${date}: canSell===false`
                );
                continue;
            }
            const target = effectiveTargets.get(t.label) ?? 0;
            actions.push({
                op: 'trim',
                label: t.label,
                toWeightPct: target * 100,
            });
            // Whipsaw re-arm: bump trough to current close so trigger can fire again.
            assetState.trough = bar.close;
        }
    }

    // Priority 3: driftBand (detection only — freq gate is caller's responsibility)
    for (const t of triggers) {
        if (t.kind !== 'driftBand') continue;
        if (totalNav <= 0) continue;
        const band = t.band;
        for (const h of holdings) {
            if (!hasBar(h.label)) continue;
            const target = effectiveTargets.get(h.label) ?? 0;
            const current = (values.get(h.label) ?? 0) / totalNav;
            const diff = Math.abs(current - target);
            const breached =
                band.kind === 'absolute'
                    ? diff > band.pct / 100
                    : target > 0
                      ? diff / target > band.pct / 100
                      : diff > 0;
            if (breached) {
                actions.push({ op: 'snapAll' });
                break; // one snapAll is enough
            }
        }
        break; // only one driftBand trigger relevant
    }

    // Priority 4: buyDip
    for (const t of triggers) {
        if (t.kind !== 'buyDip') continue;
        if (!hasBar(t.label)) continue;
        const assetState = state.assets.get(t.label);
        if (!assetState) continue;
        const bar = dateIndexes.get(t.label)!.get(date)!;
        const dipThreshold = assetState.peak * (1 - t.dropPct / 100);
        if (bar.close <= dipThreshold) {
            const target = effectiveTargets.get(t.label) ?? 0;
            actions.push({
                op: 'buy',
                label: t.label,
                toWeightPct: target * 100,
            });
        }
    }

    // Priority 5: weightFloor
    for (const t of triggers) {
        if (t.kind !== 'weightFloor') continue;
        if (!hasBar(t.label)) continue;
        const currentWeight =
            totalNav > 0 ? ((values.get(t.label) ?? 0) / totalNav) * 100 : 0;
        if (currentWeight < t.pct) {
            actions.push({ op: 'buy', label: t.label, toWeightPct: t.pct });
        }
    }

    return actions;
}
