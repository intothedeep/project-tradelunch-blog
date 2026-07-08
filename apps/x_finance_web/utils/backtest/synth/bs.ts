// utils/backtest/synth/bs.ts
// Purpose: Black–Scholes European CALL price for the structural covered-call
//          synth (X2-P2b.3). Premium is priced with historical implied vol and
//          booked downstream as the monthly dividend distribution.
// Invariant: pure, deterministic — no RNG, no I/O, no Date.now().

/** Inputs to the Black–Scholes call. */
export interface BsCallInput {
    S: number; // spot price (> 0)
    K: number; // strike price (> 0)
    sigma: number; // annualized implied vol as a fraction (0.20 = 20-vol)
    tau: number; // time to expiry in years (e.g. 1/12 for a monthly roll)
    rf: number; // annual risk-free rate as a fraction
}

/**
 * Standard normal CDF via the Hart (1968) rational approximation (West 2004).
 * Accuracy ≈ 1e-15 across the full real line — far tighter than Abramowitz–
 * Stegun 26.2.17 (~7.5e-8), so bsCall meets ±1e-6 fixture tolerances.
 */
export function normCdf(x: number): number {
    const z = Math.abs(x);
    let c: number;
    if (z > 37) {
        c = 0;
    } else {
        const e = Math.exp((-z * z) / 2);
        if (z < 7.07106781186547) {
            let n = 3.52624965998911e-2 * z + 0.700383064443688;
            n = n * z + 6.37396220353165;
            n = n * z + 33.912866078383;
            n = n * z + 112.079291497871;
            n = n * z + 221.213596169931;
            n = n * z + 220.206867912376;
            let d = 8.83883476483184e-2 * z + 1.75566716318264;
            d = d * z + 16.064177579207;
            d = d * z + 86.7807322029461;
            d = d * z + 296.564248779674;
            d = d * z + 637.333633378831;
            d = d * z + 793.826512519948;
            d = d * z + 440.413735824752;
            c = (e * n) / d;
        } else {
            let f = z + 0.65;
            f = z + 4 / f;
            f = z + 3 / f;
            f = z + 2 / f;
            f = z + 1 / f;
            c = e / (f * 2.506628274631);
        }
    }
    return x <= 0 ? c : 1 - c;
}

/**
 * Black–Scholes European call price.
 *
 * Guards (degenerate limits):
 *   S ≤ 0            → 0            (worthless / undefined underlying)
 *   K ≤ 0            → S            (any positive spot is deep ITM)
 *   tau ≤ 0 OR       → discounted intrinsic max(S − K·e^(−rf·max(tau,0)), 0);
 *   sigma ≤ 0          collapses to max(S − K, 0) as tau → 0.
 */
export function bsCall(input: BsCallInput): number {
    const { S, K, sigma, tau, rf } = input;
    if (S <= 0) return 0;
    if (K <= 0) return S;
    if (tau <= 0 || sigma <= 0) {
        const disc = Math.exp(-rf * Math.max(tau, 0));
        return Math.max(S - K * disc, 0);
    }
    const sq = sigma * Math.sqrt(tau);
    const d1 = (Math.log(S / K) + (rf + (sigma * sigma) / 2) * tau) / sq;
    const d2 = d1 - sq;
    return S * normCdf(d1) - K * Math.exp(-rf * tau) * normCdf(d2);
}
