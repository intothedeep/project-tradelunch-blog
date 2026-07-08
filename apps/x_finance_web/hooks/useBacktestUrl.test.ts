// hooks/useBacktestUrl.test.ts
// Purpose: XE.5 — seed URL codec + regression tests.
//   (1) URL round-trip: seed=123 decodes to 123 and re-encodes identically.
//   (2) Regression: changing budget / holdings / range does NOT touch seed param.
//   (3) Seed validity: non-integer / negative / ≥ 2^32 rejected → DEFAULT_SEED.

import { describe, it, expect } from 'vitest';
import {
    decodeSeed,
    isValidSeed,
    DEFAULT_SEED,
    MAX_SEED,
} from '@/hooks/useBacktestUrl.hook';

// ── (1) URL round-trip ────────────────────────────────────────────────────────
describe('decodeSeed — URL round-trip', () => {
    it('decodes seed=123 to 123', () => {
        const sp = new URLSearchParams('seed=123&budget=10000');
        expect(decodeSeed(sp.get('seed'))).toBe(123);
    });

    it('re-encodes identically: String(decodeSeed("123")) === "123"', () => {
        const sp = new URLSearchParams('seed=123');
        const decoded = decodeSeed(sp.get('seed'));
        expect(String(decoded)).toBe('123');
    });

    it('returns DEFAULT_SEED when seed param is absent', () => {
        const sp = new URLSearchParams('budget=5000');
        expect(decodeSeed(sp.get('seed'))).toBe(DEFAULT_SEED);
    });

    it('round-trips boundary value 0', () => {
        const sp = new URLSearchParams('seed=0');
        expect(decodeSeed(sp.get('seed'))).toBe(0);
        expect(String(decodeSeed(sp.get('seed')))).toBe('0');
    });

    it('round-trips MAX_SEED - 1', () => {
        const v = MAX_SEED - 1;
        const sp = new URLSearchParams(`seed=${v}`);
        expect(decodeSeed(sp.get('seed'))).toBe(v);
    });
});

// ── (2) Regression: other inputs must NOT alter the seed param ────────────────
describe('URL seed param regression — changing other inputs leaves seed intact', () => {
    // Simulate the `push` helper used inside useBacktestUrl.
    function simulatePush(
        current: URLSearchParams,
        patch: Record<string, string | null>
    ): URLSearchParams {
        const next = new URLSearchParams(current.toString());
        for (const [k, v] of Object.entries(patch)) {
            if (v === null) next.delete(k);
            else next.set(k, v);
        }
        return next;
    }

    const base = new URLSearchParams(
        'seed=99&budget=10000&from=2023-01-01&to=2024-01-01'
    );

    it('setBudget does not change seed param', () => {
        const after = simulatePush(base, { budget: '20000' });
        expect(after.get('seed')).toBe('99');
    });

    it('setRange does not change seed param', () => {
        const after = simulatePush(base, {
            from: '2021-01-01',
            to: '2025-01-01',
        });
        expect(after.get('seed')).toBe('99');
    });

    it('setHoldings (assets) does not change seed param', () => {
        const after = simulatePush(base, { assets: 'QQQ:100:0' });
        expect(after.get('seed')).toBe('99');
    });

    it('setContribution (dca) does not change seed param', () => {
        const after = simulatePush(base, { dca: '500:monthly' });
        expect(after.get('seed')).toBe('99');
    });

    it('multiple sequential patches all preserve seed', () => {
        const after1 = simulatePush(base, { budget: '15000' });
        const after2 = simulatePush(after1, { from: '2022-06-01' });
        const after3 = simulatePush(after2, { assets: 'SPY:100:1' });
        expect(after3.get('seed')).toBe('99');
    });
});

// ── (3) Seed validity ─────────────────────────────────────────────────────────
describe('isValidSeed', () => {
    it('accepts 0 (minimum)', () => {
        expect(isValidSeed(0)).toBe(true);
    });

    it('accepts 42 (default)', () => {
        expect(isValidSeed(42)).toBe(true);
    });

    it('accepts MAX_SEED - 1 (maximum)', () => {
        expect(isValidSeed(MAX_SEED - 1)).toBe(true);
    });

    it('rejects MAX_SEED (exclusive upper bound)', () => {
        expect(isValidSeed(MAX_SEED)).toBe(false);
    });

    it('rejects negative values', () => {
        expect(isValidSeed(-1)).toBe(false);
        expect(isValidSeed(-100)).toBe(false);
    });

    it('rejects non-integers', () => {
        expect(isValidSeed(1.5)).toBe(false);
        expect(isValidSeed(0.1)).toBe(false);
        expect(isValidSeed(NaN)).toBe(false);
        expect(isValidSeed(Infinity)).toBe(false);
    });
});

// ── decodeSeed rejects invalid raw strings → DEFAULT_SEED ────────────────────
describe('decodeSeed — invalid raw values fall back to DEFAULT_SEED', () => {
    // Note: '' (empty string) → Number('')=0, which IS a valid seed (0 ≥ 0, integer).
    // Only truly invalid strings (negative, fractional, non-numeric, ≥MAX) fall back.
    it.each(['-1', '1.5', 'abc', String(MAX_SEED)])(
        'decodeSeed(%s) → DEFAULT_SEED',
        (raw) => {
            expect(decodeSeed(raw)).toBe(DEFAULT_SEED);
        }
    );

    it('decodeSeed(null) → DEFAULT_SEED (absent param)', () => {
        expect(decodeSeed(null)).toBe(DEFAULT_SEED);
    });
});
