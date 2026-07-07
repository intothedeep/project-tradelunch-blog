// prng.test.ts — X2-P2.1 unit tests for the extracted seeded PRNG primitives.
import { describe, expect, it } from 'vitest';
import { mulberry32, standardNormal, hashLabel } from './prng';

describe('mulberry32', () => {
    it('same seed ⇒ identical sequence', () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        const seqA = Array.from({ length: 20 }, () => a());
        const seqB = Array.from({ length: 20 }, () => b());
        expect(seqA).toEqual(seqB);
    });

    it('different seeds ⇒ different sequence', () => {
        const a = mulberry32(1);
        const b = mulberry32(2);
        const seqA = Array.from({ length: 20 }, () => a());
        const seqB = Array.from({ length: 20 }, () => b());
        expect(seqA).not.toEqual(seqB);
    });

    it('yields values in [0, 1)', () => {
        const r = mulberry32(7);
        for (let i = 0; i < 1000; i++) {
            const v = r();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('pins the exact first draw for seed 1 (byte-identical regression)', () => {
        const r = mulberry32(1);
        // Regression anchor: if the algorithm changes, this fails.
        expect(r()).toBe(0.19465356087312102);
    });
});

describe('standardNormal', () => {
    it('is deterministic for a given rng seed', () => {
        const zA = standardNormal(mulberry32(99));
        const zB = standardNormal(mulberry32(99));
        expect(zA).toBe(zB);
    });

    it('produces a finite N(0,1)-ish sample (mean ≈ 0 over many draws)', () => {
        const r = mulberry32(123);
        let sum = 0;
        const N = 50_000;
        for (let i = 0; i < N; i++) sum += standardNormal(r);
        expect(Math.abs(sum / N)).toBeLessThan(0.05);
    });
});

describe('hashLabel', () => {
    it('is deterministic', () => {
        expect(hashLabel('JEPQ')).toBe(hashLabel('JEPQ'));
    });

    it('returns an unsigned 32-bit integer', () => {
        for (const s of ['', 'A', 'JEPQ', 'a very long label string 12345']) {
            const h = hashLabel(s);
            expect(Number.isInteger(h)).toBe(true);
            expect(h).toBeGreaterThanOrEqual(0);
            expect(h).toBeLessThanOrEqual(0xffffffff);
        }
    });

    it('distinguishes distinct labels', () => {
        expect(hashLabel('JEPQ')).not.toBe(hashLabel('QQQ'));
        expect(hashLabel('JEPQ')).not.toBe(hashLabel('JEPI'));
    });
});
