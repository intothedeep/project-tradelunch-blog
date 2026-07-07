// utils/backtest/targets.test.ts
// Unit tests for buildEffectiveTargets (X2.2).

import { describe, expect, it } from 'vitest';
import { buildEffectiveTargets } from './targets';
import type { AssetGroup, Holding, RebalancePolicy } from '@/types/backtest';

const EPS = 1e-9;

function makePolicy(groups: AssetGroup[]): RebalancePolicy {
    return {
        freq: 'monthly',
        band: { kind: 'absolute', pct: 5 },
        groups,
    };
}

describe('buildEffectiveTargets', () => {
    it('no groups: weightPct/100 fractions sum to 1', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 60 },
            { label: 'B', weightPct: 40 },
        ];
        const result = buildEffectiveTargets(holdings);
        expect(result.get('A')).toBeCloseTo(0.6, 9);
        expect(result.get('B')).toBeCloseTo(0.4, 9);
        const sum = [...result.values()].reduce((s, v) => s + v, 0);
        expect(Math.abs(sum - 1)).toBeLessThan(EPS);
    });

    it('all grouped: sum to 1', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 50, groupId: 'G1', groupWeightPct: 60 },
            { label: 'B', weightPct: 50, groupId: 'G1', groupWeightPct: 40 },
        ];
        const policy = makePolicy([{ id: 'G1', targetPct: 100 }]);
        const result = buildEffectiveTargets(holdings, policy);
        // G1 = 100% of portfolio; A gets 60/100, B gets 40/100
        expect(result.get('A')).toBeCloseTo(0.6, 9);
        expect(result.get('B')).toBeCloseTo(0.4, 9);
        const sum = [...result.values()].reduce((s, v) => s + v, 0);
        expect(Math.abs(sum - 1)).toBeLessThan(EPS);
    });

    it('mixed grouped + ungrouped: sum to 1', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 50, groupId: 'G1', groupWeightPct: 100 },
            { label: 'B', weightPct: 50 }, // ungrouped
        ];
        const policy = makePolicy([{ id: 'G1', targetPct: 60 }]);
        const result = buildEffectiveTargets(holdings, policy);
        // A raw = 0.60 × (100/100) = 0.60
        // B raw = 50/100 = 0.50
        // total raw = 1.10 → normalize: A = 0.6/1.1, B = 0.5/1.1
        const sum = [...result.values()].reduce((s, v) => s + v, 0);
        expect(Math.abs(sum - 1)).toBeLessThan(EPS);
        // A should be larger than B (0.6 vs 0.5 before norm)
        expect(result.get('A')!).toBeGreaterThan(result.get('B')!);
    });

    it('two groups sum to 1', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 50, groupId: 'G1', groupWeightPct: 50 },
            { label: 'B', weightPct: 50, groupId: 'G1', groupWeightPct: 50 },
            { label: 'C', weightPct: 50, groupId: 'G2', groupWeightPct: 100 },
        ];
        const policy = makePolicy([
            { id: 'G1', targetPct: 60 },
            { id: 'G2', targetPct: 40 },
        ]);
        const result = buildEffectiveTargets(holdings, policy);
        // G1: A=0.6×0.5=0.30, B=0.6×0.5=0.30; G2: C=0.4
        // raw total = 1.0 → no normalization needed
        expect(result.get('A')).toBeCloseTo(0.3, 9);
        expect(result.get('B')).toBeCloseTo(0.3, 9);
        expect(result.get('C')).toBeCloseTo(0.4, 9);
        const sum = [...result.values()].reduce((s, v) => s + v, 0);
        expect(Math.abs(sum - 1)).toBeLessThan(EPS);
    });

    it('orphan groupId → treated as ungrouped (no throw)', () => {
        // Reachable UI state: removing a group leaves a dangling groupId, and a
        // URL can encode a groupId with no matching g: token. Must NOT throw
        // (would crash the backtest mid-render); fall back to weightPct.
        const holdings: Holding[] = [
            {
                label: 'A',
                weightPct: 70,
                groupId: 'GHOST',
                groupWeightPct: 100,
            },
            { label: 'B', weightPct: 30 },
        ];
        const policy = makePolicy([]); // no groups defined
        const r = buildEffectiveTargets(holdings, policy);
        expect(r.get('A')).toBeCloseTo(0.7, 9);
        expect(r.get('B')).toBeCloseTo(0.3, 9);
    });

    it('zero groupWeightPct sum → equal-split within group (no throw)', () => {
        // Reachable UI state: HoldingAdvancedControls assigns groupId but never
        // sets groupWeightPct, so the sum is 0. Must NOT throw (would crash the
        // whole backtest mid-render); instead split the group target equally.
        const holdings: Holding[] = [
            { label: 'A', weightPct: 50, groupId: 'G1' },
            { label: 'B', weightPct: 50, groupId: 'G1' },
        ];
        const policy = makePolicy([{ id: 'G1', targetPct: 100 }]);
        const r = buildEffectiveTargets(holdings, policy);
        // Group target 100% split equally → 0.5 / 0.5 after normalization.
        expect(r.get('A')).toBeCloseTo(0.5, 10);
        expect(r.get('B')).toBeCloseTo(0.5, 10);
    });

    it('deterministic: same input → same output', () => {
        const holdings: Holding[] = [
            { label: 'X', weightPct: 70 },
            { label: 'Y', weightPct: 30 },
        ];
        const r1 = buildEffectiveTargets(holdings);
        const r2 = buildEffectiveTargets(holdings);
        expect(r1.get('X')).toBe(r2.get('X'));
        expect(r1.get('Y')).toBe(r2.get('Y'));
    });
});
