// utils/backtest/synth/vol.ts
// Purpose: resolve an implied-vol series (as annualized fraction) for a set of
//          base dates (X2-P2b.4). VXN (Nasdaq-100 vol, ~2001+) is preferred;
//          pre-VXN dates fall back to a scaled VIX proxy k·VIX where
//          k = mean(VXN/VIX) over their historical overlap.
// Invariant: pure, deterministic — no RNG, no I/O, no Date.now().

import type { PricePoint } from '@/types/backtest';
import type { VolPoint } from './types';

/** date → close (index level), skipping non-positive levels. */
function levelByDate(series: PricePoint[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const p of series) {
        if (p.close > 0) out.set(p.date, p.close);
    }
    return out;
}

/**
 * Deterministic proxy scale k = mean(VXN/VIX) over dates present in BOTH
 * series with positive levels. Returns undefined when they never overlap.
 */
function proxyScale(
    vxn: Map<string, number>,
    vix: Map<string, number>
): number | undefined {
    let sum = 0;
    let count = 0;
    for (const [date, vxnLevel] of vxn) {
        const vixLevel = vix.get(date);
        if (vixLevel !== undefined && vixLevel > 0) {
            sum += vxnLevel / vixLevel;
            count += 1;
        }
    }
    return count > 0 ? sum / count : undefined;
}

/**
 * Resolve per-date implied vol for `dates`.
 *   - date has VXN         → sigma = VXN/100, isProxy = false
 *   - else date has VIX    → sigma = k·VIX/100, isProxy = true (k from overlap)
 *   - neither              → Error (explicit; never silently zero-fills)
 *
 * @throws Error when a requested date has neither VXN nor a usable VIX proxy.
 */
export function resolveVol(
    dates: string[],
    vxn: PricePoint[],
    vix: PricePoint[]
): Map<string, VolPoint> {
    const vxnByDate = levelByDate(vxn);
    const vixByDate = levelByDate(vix);
    const k = proxyScale(vxnByDate, vixByDate);

    const out = new Map<string, VolPoint>();
    for (const date of dates) {
        const vxnLevel = vxnByDate.get(date);
        if (vxnLevel !== undefined) {
            out.set(date, { sigma: vxnLevel / 100, isProxy: false });
            continue;
        }
        const vixLevel = vixByDate.get(date);
        if (vixLevel !== undefined && k !== undefined) {
            out.set(date, { sigma: (k * vixLevel) / 100, isProxy: true });
            continue;
        }
        throw new Error(`resolveVol: no VXN/VIX vol available for ${date}`);
    }
    return out;
}
