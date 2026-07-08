// Purpose: Pure fix for Yahoo's broken FX daily Open. For FX pairs (esp. the
// 2022–2025 window) Yahoo sets Open == Close on ~96% of bars, collapsing every
// candle to a doji that a candlestick chart colors green (close >= open) — so the
// chart reads "all green". High/Low/Close are real; only Open is degenerate.
//
// FX is a continuous market with no official session open, so the conventional
// daily open is the PRIOR session's close. We synthesize that, making candle
// color reflect real close-to-close movement. High/Low are widened to include the
// synthesized open so the candle stays valid (body never exceeds its wicks).
//
// Invariant: pure, deterministic; first bar is left as-is (no prior close).

import type { IOHLCPoint } from '@/types/history';

export function synthesizeFxOpen(candles: IOHLCPoint[]): IOHLCPoint[] {
    return candles.map((c, i) => {
        const prev = candles[i - 1];
        if (!prev) return c;
        const open = prev.close;
        return {
            ...c,
            open,
            high: Math.max(c.high, open),
            low: Math.min(c.low, open),
        };
    });
}
