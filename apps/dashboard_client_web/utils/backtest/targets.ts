// utils/backtest/targets.ts
// Purpose: compute per-label effective target fractions from holdings + policy (X2.2).
// Invariant: pure — no I/O, no side effects, deterministic.

import type { AssetGroup, Holding, RebalancePolicy } from '@/types/backtest';

/**
 * Build a map of label → effective target fraction (values sum to 1).
 *
 * Rules:
 *   - Ungrouped holding: fraction = weightPct / 100 (then normalized).
 *   - Grouped holding: fraction = (group.targetPct/100) × (groupWeightPct / Σ groupWeightPct in group).
 *     Orphan groupId (no matching AssetGroup) → throws.
 *     Group with zero-sum member groupWeightPct → throws.
 *
 * Final map is normalized so Σ = 1.0.
 */
export function buildEffectiveTargets(
    holdings: Holding[],
    policy?: RebalancePolicy
): Map<string, number> {
    const groups: AssetGroup[] = policy?.groups ?? [];
    const groupMap = new Map<string, AssetGroup>(groups.map((g) => [g.id, g]));

    const raw = new Map<string, number>();

    // Collect per-group member weights to validate and normalize within group.
    const groupMemberWeights = new Map<string, number>(); // groupId → sum of groupWeightPct
    for (const h of holdings) {
        if (h.groupId !== undefined) {
            if (!groupMap.has(h.groupId)) {
                throw new Error(
                    `Holding "${h.label}" references unknown groupId "${h.groupId}"`
                );
            }
            groupMemberWeights.set(
                h.groupId,
                (groupMemberWeights.get(h.groupId) ?? 0) +
                    (h.groupWeightPct ?? 0)
            );
        }
    }

    // Validate no group has zero total member weight.
    for (const [gid, sum] of groupMemberWeights) {
        if (sum === 0) {
            throw new Error(
                `AssetGroup "${gid}" has members with groupWeightPct summing to 0`
            );
        }
    }

    // Compute raw fractions.
    for (const h of holdings) {
        if (h.groupId !== undefined) {
            const group = groupMap.get(h.groupId)!;
            const totalGroupWeight = groupMemberWeights.get(h.groupId)!;
            const fraction =
                (group.targetPct / 100) *
                ((h.groupWeightPct ?? 0) / totalGroupWeight);
            raw.set(h.label, fraction);
        } else {
            raw.set(h.label, h.weightPct / 100);
        }
    }

    // Normalize so Σ = 1.
    let total = 0;
    for (const v of raw.values()) total += v;

    const result = new Map<string, number>();
    if (total === 0) {
        // Degenerate: equal weight fallback.
        const eq = holdings.length > 0 ? 1 / holdings.length : 0;
        for (const h of holdings) result.set(h.label, eq);
        return result;
    }

    for (const [label, v] of raw) {
        result.set(label, v / total);
    }
    return result;
}
