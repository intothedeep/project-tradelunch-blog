// bs.test.ts — X2-P2b.3 Black–Scholes call + normal CDF
import { describe, expect, it } from 'vitest';
import { bsCall, normCdf } from './bs';

describe('normCdf — Hart high-accuracy standard normal CDF', () => {
    it('anchors: Φ(0)=0.5, symmetry, tails (matches documented values)', () => {
        expect(normCdf(0)).toBeCloseTo(0.5, 12);
        // 0.9750021048517795 is the canonical Φ(1.96) — validates 1e-10 accuracy.
        expect(normCdf(1.96)).toBeCloseTo(0.9750021048517795, 10);
        expect(normCdf(-1.96)).toBeCloseTo(1 - 0.9750021048517795, 10);
        expect(normCdf(1) + normCdf(-1)).toBeCloseTo(1, 12);
        expect(normCdf(40)).toBe(1);
        expect(normCdf(-40)).toBe(0);
    });
});

describe('bsCall — Black–Scholes European call', () => {
    it('matches the classic ATM fixture (±1e-6)', () => {
        // S=K=100, σ=20%, T=1yr, r=5% → 10.4505835721856 (textbook value).
        const c = bsCall({ S: 100, K: 100, sigma: 0.2, tau: 1, rf: 0.05 });
        expect(c).toBeCloseTo(10.450583572185565, 6);
    });

    it('matches an ITM zero-rate fixture (±1e-6)', () => {
        // S=100, K=95, σ=20%, T=1yr, r=0 → 10.519541063676954 (from the
        // independently-validated normal CDF above).
        const c = bsCall({ S: 100, K: 95, sigma: 0.2, tau: 1, rf: 0 });
        expect(c).toBeCloseTo(10.519541063676954, 6);
    });

    it('guard tau→0 collapses to intrinsic max(S−K,0)', () => {
        expect(bsCall({ S: 110, K: 100, sigma: 0.3, tau: 0, rf: 0.05 })).toBe(
            10
        );
        expect(bsCall({ S: 90, K: 100, sigma: 0.3, tau: 0, rf: 0.05 })).toBe(0);
    });

    it('guard sigma→0 collapses to discounted intrinsic', () => {
        const disc = 100 * Math.exp(-0.05 * 1);
        expect(
            bsCall({ S: 110, K: 100, sigma: 0, tau: 1, rf: 0.05 })
        ).toBeCloseTo(110 - disc, 10);
        expect(bsCall({ S: 80, K: 100, sigma: 0, tau: 1, rf: 0.05 })).toBe(0);
    });

    it('guard S≤0 → 0; K≤0 → S', () => {
        expect(bsCall({ S: 0, K: 100, sigma: 0.2, tau: 1, rf: 0.05 })).toBe(0);
        expect(bsCall({ S: -5, K: 100, sigma: 0.2, tau: 1, rf: 0.05 })).toBe(0);
        expect(bsCall({ S: 100, K: 0, sigma: 0.2, tau: 1, rf: 0.05 })).toBe(
            100
        );
    });

    it('is ≥ intrinsic, monotone increasing in S, and deterministic', () => {
        const p = { K: 100, sigma: 0.25, tau: 0.5, rf: 0.03 };
        const a = bsCall({ ...p, S: 100 });
        const b = bsCall({ ...p, S: 105 });
        expect(a).toBeGreaterThanOrEqual(Math.max(100 - 100, 0));
        expect(b).toBeGreaterThan(a);
        expect(bsCall({ ...p, S: 100 })).toBe(a); // bit-identical repeat
    });
});
