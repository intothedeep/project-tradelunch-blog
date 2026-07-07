// utils/backtest/url-codec-synth.ts
// Purpose: encode/decode the synth= URL query param (X2-P2.8).
// Grammar: synth=<shortLabel>:<base>:<method>
//   <method>  = 'reg' (active this wave)
//               'str' | 'cmp' → reserved, decodes as undefined (synth OFF)
// Discipline: never throw — unknown token/label → undefined.

/** Active synth state decoded from the URL. */
export interface SynthUrlState {
    shortLabel: string;
    base: string;
    method: 'reg';
}

/**
 * Encode synth state into the synth= param value.
 * Only 'reg' is emittable this wave; callers must not pass reserved methods.
 */
export function encodeSynth(s: SynthUrlState): string {
    return `${s.shortLabel}:${s.base}:${s.method}`;
}

/**
 * Decode synth= param value. Returns undefined for:
 *   - null / missing param
 *   - malformed tokens
 *   - reserved methods ('str', 'cmp') — synth OFF, no throw
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
        // Reserved methods decode as OFF, not an error.
        if (method === 'str' || method === 'cmp') return undefined;
        if (method !== 'reg') return undefined;
        return { shortLabel, base, method: 'reg' };
    } catch {
        return undefined;
    }
}
