// utils/backtest/rebalance-gate.test.ts
// Unit tests for computeWeights and isGateConditionMet (R2 schedule gate helpers).

import { describe, expect, it } from 'vitest';
import { computeWeights, isGateConditionMet } from './rebalance-gate';
import type {
    Holding,
    PricePoint,
    ScheduleGateCondition,
} from '@/types/backtest';

const EPS = 1e-9;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBar(close: number, date = '2024-01-15'): PricePoint {
    return { date, close, dividends: 0, stockSplits: 1 };
}

function makeDateIndexes(
    labels: string[],
    closes: number[],
    date = '2024-01-15'
): Map<string, Map<string, PricePoint>> {
    const di = new Map<string, Map<string, PricePoint>>();
    labels.forEach((lbl, i) => {
        di.set(lbl, new Map([[date, makeBar(closes[i]!, date)]]));
    });
    return di;
}

// ── computeWeights ────────────────────────────────────────────────────────────

describe('computeWeights', () => {
    it('returns percent weights summing near 100 (no cash)', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 60 },
            { label: 'B', weightPct: 40 },
        ];
        const shares = new Map([
            ['A', 10],
            ['B', 5],
        ]);
        const di = makeDateIndexes(['A', 'B'], [100, 200]);
        // A = 1000, B = 1000; totalNav = 2000 (no cash)
        const weights = computeWeights(shares, 0, holdings, di, '2024-01-15');
        expect(Math.abs((weights.get('A') ?? 0) - 50)).toBeLessThan(EPS);
        expect(Math.abs((weights.get('B') ?? 0) - 50)).toBeLessThan(EPS);
    });

    it('includes cash in totalNav denominator', () => {
        const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
        const shares = new Map([['A', 10]]);
        const di = makeDateIndexes(['A'], [100]);
        // A = 1000, cash = 1000; totalNav = 2000; A weight = 50%
        const weights = computeWeights(
            shares,
            1000,
            holdings,
            di,
            '2024-01-15'
        );
        expect(Math.abs((weights.get('A') ?? 0) - 50)).toBeLessThan(EPS);
    });

    it('missing bar → 0 weight', () => {
        const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
        const shares = new Map([['A', 10]]);
        const di = new Map<string, Map<string, PricePoint>>(); // no bars
        const weights = computeWeights(shares, 0, holdings, di, '2024-01-15');
        expect(weights.get('A')).toBe(0);
    });

    it('totalNav <= 0 → all 0', () => {
        const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
        const shares = new Map([['A', 0]]);
        const di = makeDateIndexes(['A'], [0]);
        const weights = computeWeights(shares, 0, holdings, di, '2024-01-15');
        expect(weights.get('A')).toBe(0);
    });

    it('three assets: correct proportional weights', () => {
        const holdings: Holding[] = [
            { label: 'X', weightPct: 50 },
            { label: 'Y', weightPct: 30 },
            { label: 'Z', weightPct: 20 },
        ];
        const shares = new Map([
            ['X', 10],
            ['Y', 10],
            ['Z', 10],
        ]);
        // X@50, Y@30, Z@20 → total = 1000; X=50%, Y=30%, Z=20%
        const di = makeDateIndexes(['X', 'Y', 'Z'], [50, 30, 20]);
        const weights = computeWeights(shares, 0, holdings, di, '2024-01-15');
        expect(Math.abs((weights.get('X') ?? 0) - 50)).toBeLessThan(EPS);
        expect(Math.abs((weights.get('Y') ?? 0) - 30)).toBeLessThan(EPS);
        expect(Math.abs((weights.get('Z') ?? 0) - 20)).toBeLessThan(EPS);
    });
});

// ── isGateConditionMet ────────────────────────────────────────────────────────

describe('isGateConditionMet', () => {
    it('returns false for empty conditions', () => {
        const weights = new Map([['A', 50]]);
        expect(isGateConditionMet([], weights)).toBe(false);
    });

    it('>= condition: true when weight equals pct', () => {
        const cond: ScheduleGateCondition = { label: 'A', pct: 60, dir: '>=' };
        const weights = new Map([['A', 60]]);
        expect(isGateConditionMet([cond], weights)).toBe(true);
    });

    it('>= condition: true when weight exceeds pct', () => {
        const cond: ScheduleGateCondition = { label: 'A', pct: 60, dir: '>=' };
        const weights = new Map([['A', 70]]);
        expect(isGateConditionMet([cond], weights)).toBe(true);
    });

    it('>= condition: false when weight below pct', () => {
        const cond: ScheduleGateCondition = { label: 'A', pct: 60, dir: '>=' };
        const weights = new Map([['A', 55]]);
        expect(isGateConditionMet([cond], weights)).toBe(false);
    });

    it('<= condition: true when weight equals pct', () => {
        const cond: ScheduleGateCondition = { label: 'A', pct: 30, dir: '<=' };
        const weights = new Map([['A', 30]]);
        expect(isGateConditionMet([cond], weights)).toBe(true);
    });

    it('<= condition: true when weight below pct', () => {
        const cond: ScheduleGateCondition = { label: 'A', pct: 30, dir: '<=' };
        const weights = new Map([['A', 20]]);
        expect(isGateConditionMet([cond], weights)).toBe(true);
    });

    it('<= condition: false when weight above pct', () => {
        const cond: ScheduleGateCondition = { label: 'A', pct: 30, dir: '<=' };
        const weights = new Map([['A', 35]]);
        expect(isGateConditionMet([cond], weights)).toBe(false);
    });

    it('OR semantics: any true condition returns true', () => {
        const conditions: ScheduleGateCondition[] = [
            { label: 'A', pct: 70, dir: '>=' }, // false: A=50
            { label: 'B', pct: 20, dir: '<=' }, // true: B=15
        ];
        const weights = new Map([
            ['A', 50],
            ['B', 15],
        ]);
        expect(isGateConditionMet(conditions, weights)).toBe(true);
    });

    it('OR semantics: all false → false', () => {
        const conditions: ScheduleGateCondition[] = [
            { label: 'A', pct: 70, dir: '>=' }, // false: A=50
            { label: 'B', pct: 10, dir: '<=' }, // false: B=20
        ];
        const weights = new Map([
            ['A', 50],
            ['B', 20],
        ]);
        expect(isGateConditionMet(conditions, weights)).toBe(false);
    });

    it('missing label → weight defaults to 0', () => {
        const cond: ScheduleGateCondition = {
            label: 'MISSING',
            pct: 0,
            dir: '<=',
        };
        const weights = new Map<string, number>();
        // 0 <= 0 → true
        expect(isGateConditionMet([cond], weights)).toBe(true);
    });
});
