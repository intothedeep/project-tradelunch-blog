// utils/backtest/url-codec-rebalance.test.ts
// Tests for encodeRebalance / decodeRebalance — including R1 (custom months) and R2 (scheduleGate 2-axis).

import { describe, expect, it } from 'vitest';
import { encodeRebalance, decodeRebalance } from './url-codec-rebalance';
import type { RebalancePolicy } from '@/types/backtest';

// ── Helpers ───────────────────────────────────────────────────────────────────

function roundTrip(
    policy: RebalancePolicy,
    knownLabels?: Set<string>
): RebalancePolicy | undefined {
    return decodeRebalance(encodeRebalance(policy), knownLabels);
}

// ── Existing round-trips (backward-compat) ────────────────────────────────────

describe('encodeRebalance / decodeRebalance — existing behavior preserved', () => {
    it('basic monthly policy round-trips', () => {
        const policy: RebalancePolicy = {
            freq: 'monthly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
        };
        expect(roundTrip(policy)).toEqual(policy);
    });

    it('quarterly with groups and triggers round-trips', () => {
        const policy: RebalancePolicy = {
            freq: 'quarterly',
            band: { kind: 'relative', pct: 10 },
            groups: [{ id: 'G1', targetPct: 60, rebalanceWithin: true }],
            triggers: [{ kind: 'weightCap', label: 'QQQ', pct: 70 }],
        };
        const rt = roundTrip(policy, new Set(['QQQ']));
        expect(rt).toEqual(policy);
    });

    it('never freq round-trips', () => {
        const policy: RebalancePolicy = {
            freq: 'never',
            band: { kind: 'absolute', pct: 0 },
            groups: [],
        };
        expect(roundTrip(policy)).toEqual(policy);
    });

    it('old strings (no m:/sg:/sc:) decode with months/scheduleGate undefined', () => {
        const raw = 'quarterly:r10;g:G1@60w;wc:QQQ:70';
        const decoded = decodeRebalance(raw, new Set(['QQQ']));
        expect(decoded).toBeDefined();
        expect(decoded!.months).toBeUndefined();
        expect(decoded!.scheduleGate).toBeUndefined();
    });

    it("'custom' freq accepted", () => {
        const policy: RebalancePolicy = {
            freq: 'custom',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            months: [3, 6, 9, 12],
        };
        const rt = roundTrip(policy);
        expect(rt?.freq).toBe('custom');
        expect(rt?.months).toEqual([3, 6, 9, 12]);
    });
});

// ── R1: custom months ─────────────────────────────────────────────────────────

describe('R1 — custom months round-trip', () => {
    it('encodes months as m:<dot-joined>', () => {
        const policy: RebalancePolicy = {
            freq: 'custom',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            months: [1, 6, 12],
        };
        const encoded = encodeRebalance(policy);
        expect(encoded).toContain('m:1.6.12');
    });

    it('decodes m: token back to months array', () => {
        const raw = 'custom:a5;m:1.6.12';
        const decoded = decodeRebalance(raw);
        expect(decoded?.months).toEqual([1, 6, 12]);
    });

    it('months round-trip: sorted order preserved', () => {
        const policy: RebalancePolicy = {
            freq: 'custom',
            band: { kind: 'relative', pct: 3 },
            groups: [],
            months: [3, 6, 9, 12],
        };
        const rt = roundTrip(policy);
        expect(rt?.months).toEqual([3, 6, 9, 12]);
    });

    it('non-custom freq: months NOT encoded even if present', () => {
        const policy: RebalancePolicy = {
            freq: 'monthly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            months: [1, 2, 3],
        };
        const encoded = encodeRebalance(policy);
        // months token (;m:<digits>) should not appear for non-custom freq.
        // Note: check ;m: to avoid matching 'monthly:' substring false-positive.
        expect(encoded).not.toContain(';m:');
    });

    it('empty months array: m: token not emitted', () => {
        const policy: RebalancePolicy = {
            freq: 'custom',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            months: [],
        };
        const encoded = encodeRebalance(policy);
        // Check ;m: to avoid matching 'custom:' substring ('m:' appears in 'custo**m:**')
        expect(encoded).not.toContain(';m:');
    });

    it('invalid month values filtered out on decode', () => {
        // 0 and 13 are invalid
        const raw = 'custom:a5;m:0.3.6.13';
        const decoded = decodeRebalance(raw);
        expect(decoded?.months).toEqual([3, 6]);
    });
});

// ── R2: scheduleGate 2-axis round-trip ───────────────────────────────────────

describe('R2 — scheduleGate 2-axis round-trip', () => {
    // Combo 1: schedule+immediate → sg:si (old 'gated' equivalent)
    it('schedule+immediate encodes as sg:si', () => {
        const policy: RebalancePolicy = {
            freq: 'monthly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'schedule',
                executeAt: 'immediate',
                conditions: [{ label: 'QQQ', pct: 60, dir: '>=' }],
            },
        };
        const encoded = encodeRebalance(policy);
        expect(encoded).toContain('sg:si');
        expect(encoded).toContain('sc:QQQ:ge:60');
    });

    it('schedule+immediate round-trips correctly', () => {
        const policy: RebalancePolicy = {
            freq: 'monthly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'schedule',
                executeAt: 'immediate',
                conditions: [{ label: 'QQQ', pct: 60, dir: '>=' }],
            },
        };
        const rt = roundTrip(policy, new Set(['QQQ']));
        expect(rt?.scheduleGate?.checkAt).toBe('schedule');
        expect(rt?.scheduleGate?.executeAt).toBe('immediate');
        expect(rt?.scheduleGate?.conditions).toEqual([
            { label: 'QQQ', pct: 60, dir: '>=' },
        ]);
    });

    // Combo 2: always+immediate → sg:ai
    it('always+immediate encodes as sg:ai', () => {
        const policy: RebalancePolicy = {
            freq: 'quarterly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'always',
                executeAt: 'immediate',
                conditions: [{ label: 'VOO', pct: 30, dir: '<=' }],
            },
        };
        const encoded = encodeRebalance(policy);
        expect(encoded).toContain('sg:ai');
        expect(encoded).toContain('sc:VOO:le:30');
    });

    it('always+immediate round-trips correctly', () => {
        const policy: RebalancePolicy = {
            freq: 'quarterly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'always',
                executeAt: 'immediate',
                conditions: [{ label: 'VOO', pct: 30, dir: '<=' }],
            },
        };
        const rt = roundTrip(policy, new Set(['VOO']));
        expect(rt?.scheduleGate?.checkAt).toBe('always');
        expect(rt?.scheduleGate?.executeAt).toBe('immediate');
        expect(rt?.scheduleGate?.conditions[0]?.dir).toBe('<=');
    });

    // Combo 3: always+nextSchedule → sg:an (old 'armNext' equivalent)
    it('always+nextSchedule encodes as sg:an', () => {
        const policy: RebalancePolicy = {
            freq: 'quarterly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'always',
                executeAt: 'nextSchedule',
                conditions: [{ label: 'VOO', pct: 30, dir: '<=' }],
            },
        };
        const encoded = encodeRebalance(policy);
        expect(encoded).toContain('sg:an');
        expect(encoded).toContain('sc:VOO:le:30');
    });

    it('always+nextSchedule round-trips correctly', () => {
        const policy: RebalancePolicy = {
            freq: 'quarterly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'always',
                executeAt: 'nextSchedule',
                conditions: [{ label: 'VOO', pct: 30, dir: '<=' }],
            },
        };
        const rt = roundTrip(policy, new Set(['VOO']));
        expect(rt?.scheduleGate?.checkAt).toBe('always');
        expect(rt?.scheduleGate?.executeAt).toBe('nextSchedule');
        expect(rt?.scheduleGate?.conditions[0]?.dir).toBe('<=');
    });

    // Combo 4: schedule+nextSchedule → sg:sn
    it('schedule+nextSchedule encodes as sg:sn', () => {
        const policy: RebalancePolicy = {
            freq: 'monthly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'schedule',
                executeAt: 'nextSchedule',
                conditions: [{ label: 'QQQ', pct: 65, dir: '>=' }],
            },
        };
        const encoded = encodeRebalance(policy);
        expect(encoded).toContain('sg:sn');
        expect(encoded).toContain('sc:QQQ:ge:65');
    });

    it('schedule+nextSchedule round-trips correctly', () => {
        const policy: RebalancePolicy = {
            freq: 'monthly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'schedule',
                executeAt: 'nextSchedule',
                conditions: [{ label: 'QQQ', pct: 65, dir: '>=' }],
            },
        };
        const rt = roundTrip(policy, new Set(['QQQ']));
        expect(rt?.scheduleGate?.checkAt).toBe('schedule');
        expect(rt?.scheduleGate?.executeAt).toBe('nextSchedule');
        expect(rt?.scheduleGate?.conditions[0]?.pct).toBe(65);
    });

    // Multiple conditions
    it('multiple conditions round-trip', () => {
        const policy: RebalancePolicy = {
            freq: 'monthly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'schedule',
                executeAt: 'immediate',
                conditions: [
                    { label: 'A', pct: 60, dir: '>=' },
                    { label: 'B', pct: 20, dir: '<=' },
                ],
            },
        };
        const rt = roundTrip(policy, new Set(['A', 'B']));
        expect(rt?.scheduleGate?.conditions.length).toBe(2);
        expect(rt?.scheduleGate?.conditions[0]).toEqual({
            label: 'A',
            pct: 60,
            dir: '>=',
        });
        expect(rt?.scheduleGate?.conditions[1]).toEqual({
            label: 'B',
            pct: 20,
            dir: '<=',
        });
    });

    it('no scheduleGate in policy → not encoded, decodes as undefined', () => {
        const policy: RebalancePolicy = {
            freq: 'monthly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
        };
        const encoded = encodeRebalance(policy);
        expect(encoded).not.toContain('sg:');
        const decoded = decodeRebalance(encoded);
        expect(decoded?.scheduleGate).toBeUndefined();
    });

    it('custom freq + months + scheduleGate all together round-trip', () => {
        const policy: RebalancePolicy = {
            freq: 'custom',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            months: [3, 9],
            scheduleGate: {
                checkAt: 'always',
                executeAt: 'nextSchedule',
                conditions: [{ label: 'QQQ', pct: 65, dir: '>=' }],
            },
        };
        const rt = roundTrip(policy, new Set(['QQQ']));
        expect(rt?.freq).toBe('custom');
        expect(rt?.months).toEqual([3, 9]);
        expect(rt?.scheduleGate?.checkAt).toBe('always');
        expect(rt?.scheduleGate?.executeAt).toBe('nextSchedule');
        expect(rt?.scheduleGate?.conditions[0]?.pct).toBe(65);
    });

    it('unknown label in sc: filtered out when knownLabels is non-empty', () => {
        const raw = 'monthly:a5;sg:si;sc:UNKNOWN:ge:60';
        const decoded = decodeRebalance(raw, new Set(['QQQ']));
        // sg decoded, but sc condition filtered
        expect(decoded?.scheduleGate?.checkAt).toBe('schedule');
        expect(decoded?.scheduleGate?.executeAt).toBe('immediate');
        expect(decoded?.scheduleGate?.conditions).toEqual([]);
    });

    it('malformed sg: token (wrong length) → scheduleGate undefined', () => {
        // 'sg:x' has 1 char code → invalid
        const raw = 'monthly:a5;sg:x;sc:QQQ:ge:60';
        const decoded = decodeRebalance(raw, new Set(['QQQ']));
        expect(decoded?.scheduleGate).toBeUndefined();
    });

    it('malformed sg: token (invalid chars) → scheduleGate undefined', () => {
        // 'sg:zz' — z is not s|a and not i|n
        const raw = 'monthly:a5;sg:zz;sc:QQQ:ge:60';
        const decoded = decodeRebalance(raw, new Set(['QQQ']));
        expect(decoded?.scheduleGate).toBeUndefined();
    });

    it('old strings without sg: → scheduleGate undefined (backward-compat)', () => {
        const raw = 'quarterly:r10;g:G1@60w;wc:QQQ:70';
        const decoded = decodeRebalance(raw, new Set(['QQQ']));
        expect(decoded?.scheduleGate).toBeUndefined();
    });
});
