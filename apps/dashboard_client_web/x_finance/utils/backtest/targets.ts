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
 *     Orphan groupId (no matching AssetGroup) → treated as ungrouped (weightPct/100).
 *       Reachable UI state: removing a group leaves the holding's groupId dangling,
 *       and a URL can encode a groupId with no matching g: token. Dropping the
 *       stale reference (mirrors the decoder's stale-label drop) MUST NOT throw or
 *       the whole backtest crashes mid-render.
 *     Group whose members all omit groupWeightPct (Σ = 0) → equal-split within the
 *     group (the natural default; the UI assigns groupId without a sub-weight, so
 *     this MUST NOT throw either).
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

    // Collect per-group member weight sums and member counts.
    const groupMemberWeights = new Map<string, number>(); // groupId → Σ groupWeightPct
    const groupMemberCounts = new Map<string, number>(); // groupId → member count
    for (const h of holdings) {
        // An orphan groupId (no matching group) is treated as ungrouped below.
        if (h.groupId !== undefined && groupMap.has(h.groupId)) {
            groupMemberWeights.set(
                h.groupId,
                (groupMemberWeights.get(h.groupId) ?? 0) +
                    (h.groupWeightPct ?? 0)
            );
            groupMemberCounts.set(
                h.groupId,
                (groupMemberCounts.get(h.groupId) ?? 0) + 1
            );
        }
    }

    // Compute raw fractions. When a group's member groupWeightPct all sum to 0
    // (the common case: UI assigns groupId but no sub-weight), split the group's
    // target equally among its members instead of throwing.
    for (const h of holdings) {
        if (h.groupId !== undefined && groupMap.has(h.groupId)) {
            const group = groupMap.get(h.groupId)!;
            const totalGroupWeight = groupMemberWeights.get(h.groupId)!;
            const memberCount = groupMemberCounts.get(h.groupId)!;
            const withinShare =
                totalGroupWeight === 0
                    ? 1 / memberCount // equal-split fallback
                    : (h.groupWeightPct ?? 0) / totalGroupWeight;
            raw.set(h.label, (group.targetPct / 100) * withinShare);
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
