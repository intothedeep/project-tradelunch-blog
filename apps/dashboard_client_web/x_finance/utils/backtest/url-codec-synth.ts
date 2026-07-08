// utils/backtest/url-codec-synth.ts
// Purpose: encode/decode the synth= URL query param (X2-P2.8, X2-P2b.8).
// Grammar: synth=<shortLabel>:<base>:<method>
//   <method>  = 'reg' | 'str' | 'cmp' (all active from X2-P2b.8)
// Discipline: never throw — unknown token/label → undefined.

/** Active synth state decoded from the URL. */
export interface SynthUrlState {
    shortLabel: string;
    base: string;
    method: 'reg' | 'str' | 'cmp';
}

/**
 * Encode synth state into the synth= param value.
 */
export function encodeSynth(s: SynthUrlState): string {
    return `${s.shortLabel}:${s.base}:${s.method}`;
}

/**
 * Decode synth= param value. Returns undefined for:
 *   - null / missing param
 *   - malformed tokens
 *   - unknown methods (not reg / str / cmp)
 *   - empty shortLabel or base
 */
export function decodeSynth(raw: string | null): SynthUrlState | undefined {
    if (!raw) return undefined;
    try {
        const segs = raw.split(':');
        const shortLabel = segs[0];
        const base = segs[1];
        const method = segs[2];
        if (!shortLabel || !base || !method) return undefined;
        if (method !== 'reg' && method !== 'str' && method !== 'cmp')
            return undefined;
        return { shortLabel, base, method };
    } catch {
        return undefined;
    }
}
