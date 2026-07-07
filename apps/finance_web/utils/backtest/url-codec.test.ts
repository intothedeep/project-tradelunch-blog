// utils/backtest/url-codec.test.ts
// Acceptance tests for X2.11 URL codec (rb=, mf=, assets= trailing fields).

import { describe, it, expect } from 'vitest';
import {
    encodeHoldings,
    decodeHoldings,
    encodeContribution,
    decodeContribution,
    encodeRebalance,
    decodeRebalance,
    encodeManualFlows,
    decodeManualFlows,
} from './url-codec';
import type {
    Holding,
    RebalancePolicy,
    ContributionPlan,
} from '@/types/backtest';

// ── (a) Legacy fixture backward-compat ───────────────────────────────────────

describe('decodeHoldings — legacy fixtures', () => {
    it('decodes QQQ:60:cash,JEPQ:40:same exactly', () => {
        const result = decodeHoldings('QQQ:60:cash,JEPQ:40:same');
        expect(result).toEqual([
            { label: 'QQQ', weightPct: 60, dividendRoute: { kind: 'cash' } },
            { label: 'JEPQ', weightPct: 40, dividendRoute: { kind: 'same' } },
        ]);
    });

    it('decodes legacy :1 as same, :0 as cash', () => {
        const result = decodeHoldings('QQQ:60:1,JEPQ:40:0');
        expect(result).toEqual([
            { label: 'QQQ', weightPct: 60, dividendRoute: { kind: 'same' } },
            { label: 'JEPQ', weightPct: 40, dividendRoute: { kind: 'cash' } },
        ]);
    });

    it('decodes asset route', () => {
        const result = decodeHoldings('JEPQ:40:VOO');
        expect(result?.[0]?.dividendRoute).toEqual({
            kind: 'asset',
            target: 'VOO',
        });
    });
});

describe('decodeContribution — legacy fixtures', () => {
    it('decodes dca=500:monthly', () => {
        expect(decodeContribution('500:monthly')).toEqual({
            amount: 500,
            freq: 'monthly',
        });
    });

    it('decodes dca=1000:yearly', () => {
        expect(decodeContribution('1000:yearly')).toEqual({
            amount: 1000,
            freq: 'yearly',
        });
    });

    it('returns undefined for invalid freq', () => {
        expect(decodeContribution('500:weekly')).toBeUndefined();
    });
});

// ── (b) encode→decode round-trip: full policy ─────────────────────────────────

describe('round-trip: holdings with X2 tail fields', () => {
    it('preserves canSell=false', () => {
        const holdings: Holding[] = [
            {
                label: 'QQQ',
                weightPct: 60,
                dividendRoute: { kind: 'cash' },
                canSell: false,
            },
            { label: 'JEPQ', weightPct: 40, dividendRoute: { kind: 'same' } },
        ];
        const encoded = encodeHoldings(holdings);
        const decoded = decodeHoldings(encoded);
        expect(decoded?.[0]?.canSell).toBe(false);
        expect(decoded?.[1]?.canSell).toBeUndefined();
    });

    it('preserves sellPriority', () => {
        const holdings: Holding[] = [
            {
                label: 'QQQ',
                weightPct: 100,
                dividendRoute: { kind: 'cash' },
                sellPriority: 2,
            },
        ];
        const decoded = decodeHoldings(encodeHoldings(holdings));
        expect(decoded?.[0]?.sellPriority).toBe(2);
    });

    it('preserves groupId and groupWeightPct', () => {
        const holdings: Holding[] = [
            {
                label: 'QQQ',
                weightPct: 60,
                dividendRoute: { kind: 'cash' },
                groupId: 'equity',
                groupWeightPct: 70,
            },
            {
                label: 'JEPQ',
                weightPct: 40,
                dividendRoute: { kind: 'same' },
                groupId: 'equity',
                groupWeightPct: 30,
            },
        ];
        const decoded = decodeHoldings(encodeHoldings(holdings));
        expect(decoded?.[0]?.groupId).toBe('equity');
        expect(decoded?.[0]?.groupWeightPct).toBe(70);
        expect(decoded?.[1]?.groupWeightPct).toBe(30);
    });
});

describe('round-trip: RebalancePolicy', () => {
    const fullPolicy: RebalancePolicy = {
        freq: 'quarterly',
        band: { kind: 'relative', pct: 5 },
        groups: [
            { id: 'equity', targetPct: 70, rebalanceWithin: true },
            { id: 'bond', targetPct: 30 },
        ],
        triggers: [
            { kind: 'takeProfit', label: 'QQQ', gainPct: 20, reset: 'window' },
            { kind: 'buyDip', label: 'JEPQ', dropPct: 15, reset: 'onBuy' },
            { kind: 'weightCap', label: 'QQQ', pct: 75 },
            { kind: 'weightFloor', label: 'BOND', pct: 10 },
        ],
    };

    it('round-trips full policy', () => {
        const encoded = encodeRebalance(fullPolicy);
        const decoded = decodeRebalance(encoded);
        expect(decoded).toEqual(fullPolicy);
    });

    it('round-trips freq=never with absolute band', () => {
        const p: RebalancePolicy = {
            freq: 'never',
            band: { kind: 'absolute', pct: 3 },
            groups: [],
        };
        expect(decodeRebalance(encodeRebalance(p))).toEqual(p);
    });

    it('round-trips all 4 trigger kinds', () => {
        const encoded = encodeRebalance(fullPolicy);
        const decoded = decodeRebalance(encoded);
        expect(decoded?.triggers).toHaveLength(4);
        expect(decoded?.triggers?.[0]).toEqual({
            kind: 'takeProfit',
            label: 'QQQ',
            gainPct: 20,
            reset: 'window',
        });
        expect(decoded?.triggers?.[1]).toEqual({
            kind: 'buyDip',
            label: 'JEPQ',
            dropPct: 15,
            reset: 'onBuy',
        });
        expect(decoded?.triggers?.[2]).toEqual({
            kind: 'weightCap',
            label: 'QQQ',
            pct: 75,
        });
        expect(decoded?.triggers?.[3]).toEqual({
            kind: 'weightFloor',
            label: 'BOND',
            pct: 10,
        });
    });

    it('round-trips groups with rebalanceWithin', () => {
        const encoded = encodeRebalance(fullPolicy);
        const decoded = decodeRebalance(encoded);
        expect(decoded?.groups[0]).toEqual({
            id: 'equity',
            targetPct: 70,
            rebalanceWithin: true,
        });
        expect(decoded?.groups[1]).toEqual({ id: 'bond', targetPct: 30 });
    });
});

describe('round-trip: manualFlows', () => {
    it('round-trips positive and negative flows', () => {
        const flows = [
            { date: '2024-01-15', amount: 5000 },
            { date: '2024-06-01', amount: -1000 },
        ];
        const decoded = decodeManualFlows(encodeManualFlows(flows));
        expect(decoded).toEqual(flows);
    });
});

describe('round-trip: ContributionPlan with route', () => {
    it('preserves asset route', () => {
        const plan: ContributionPlan = {
            amount: 500,
            freq: 'monthly',
            route: { kind: 'asset', target: 'VOO' },
        };
        expect(decodeContribution(encodeContribution(plan))).toEqual(plan);
    });

    it('omits route token for byWeight', () => {
        const plan: ContributionPlan = {
            amount: 500,
            freq: 'monthly',
            route: { kind: 'byWeight' },
        };
        const encoded = encodeContribution(plan);
        expect(encoded).toBe('500:monthly'); // no route suffix
        const decoded = decodeContribution(encoded);
        expect(decoded?.route).toBeUndefined(); // byWeight = default
    });
});

// ── (c) Plain portfolio — no bloat ───────────────────────────────────────────

describe('plain portfolio — byte-identical to pre-X2', () => {
    it('QQQ:60:cash,JEPQ:40:same — no trailing fields', () => {
        const holdings: Holding[] = [
            { label: 'QQQ', weightPct: 60, dividendRoute: { kind: 'cash' } },
            { label: 'JEPQ', weightPct: 40, dividendRoute: { kind: 'same' } },
        ];
        expect(encodeHoldings(holdings)).toBe('QQQ:60:cash,JEPQ:40:same');
    });
});

// ── (d) Malformed input — graceful, no throw ──────────────────────────────────

describe('malformed input — graceful degradation', () => {
    it('decodeHoldings: empty string → null', () => {
        expect(decodeHoldings('')).toBeNull();
    });

    it('decodeHoldings: bad weight → null', () => {
        expect(decodeHoldings('QQQ:abc:cash')).toBeNull();
    });

    it('decodeRebalance: null → undefined', () => {
        expect(decodeRebalance(null)).toBeUndefined();
    });

    it('decodeRebalance: garbage string → undefined', () => {
        expect(decodeRebalance('not-valid-at-all')).toBeUndefined();
    });

    it('decodeRebalance: unknown freq → undefined', () => {
        expect(decodeRebalance('biweekly:r5')).toBeUndefined();
    });

    it('decodeRebalance: unknown trigger prefix → skipped', () => {
        const raw = 'monthly:r5;zz:QQQ:10';
        const decoded = decodeRebalance(raw);
        expect(decoded?.triggers).toBeUndefined();
    });

    it('decodeRebalance: trigger referencing unknown label → dropped', () => {
        const raw = 'monthly:r5;tp:UNKNOWN:20:bt';
        const knownLabels = new Set(['QQQ', 'JEPQ']);
        const decoded = decodeRebalance(raw, knownLabels);
        expect(decoded?.triggers).toBeUndefined();
    });

    it('decodeManualFlows: null → undefined', () => {
        expect(decodeManualFlows(null)).toBeUndefined();
    });

    it('decodeManualFlows: bad date format → skipped', () => {
        // "01-15-2024" not ISO → skip; "2024-06-01:500" valid
        const raw = '01-15-2024:5000,2024-06-01:500';
        const decoded = decodeManualFlows(raw);
        expect(decoded).toEqual([{ date: '2024-06-01', amount: 500 }]);
    });

    it('decodeManualFlows: non-finite amount → skipped', () => {
        const raw = '2024-01-01:NaN,2024-02-01:1000';
        const decoded = decodeManualFlows(raw);
        expect(decoded).toEqual([{ date: '2024-02-01', amount: 1000 }]);
    });

    it('decodeContribution: null → undefined', () => {
        expect(decodeContribution(null)).toBeUndefined();
    });

    it('decodeContribution: zero amount → undefined', () => {
        expect(decodeContribution('0:monthly')).toBeUndefined();
    });
});
