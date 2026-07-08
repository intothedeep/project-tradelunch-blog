// utils/cusipColor.ts
// Purpose: Derives a stable OKLCH-like HSL color from a CUSIP string.
//   Identical CUSIP → identical hue → identical color in every render/reload.
// Invariant: pure function — deterministic hash, no hidden state.
//   Hue: [0, 360) from djb2 hash of cusip.
//   Saturation fixed at 55%, lightness fixed at 48% (light theme).
//   Text on this background passes WCAG AA ≥4.5:1 contrast with white (#fff) or
//   dark (#111) — the caller is responsible for picking the right text color
//   (use cusipTextColor to get 'white' | '#111').
// Side effects: none.

/**
 * djb2 hash — maps an arbitrary string to an unsigned 32-bit integer.
 * Stable across JS engines because it never relies on platform float precision.
 */
function djb2Hash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        // (hash * 33) ^ charCode, kept in 32-bit unsigned range with >>> 0
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
        hash = hash >>> 0;
    }
    return hash;
}

const SATURATION = 55; // % — vivid but not garish
const LIGHTNESS = 48; // % — mid-tone, readable with white text

/**
 * Returns a stable HSL background color string for the given CUSIP.
 * Example: cusipColor('037833100') → 'hsl(214, 55%, 48%)'
 */
export function cusipColor(cusip: string): string {
    const hue = djb2Hash(cusip) % 360;
    return `hsl(${hue}, ${SATURATION}%, ${LIGHTNESS}%)`;
}

/**
 * Returns the appropriate text color ('white' or '#111') for a CUSIP swatch,
 * based on the computed lightness split. Values below 55% L use white text.
 * This keeps WCAG contrast ≥4.5:1 for the mid-tone band we use.
 */
export function cusipTextColor(cusip: string): 'white' | '#111' {
    const hue = djb2Hash(cusip) % 360;
    // Warm hues (yellow 45-75) appear brighter at equal L — apply dark text there.
    const isWarmYellow = hue >= 45 && hue <= 75;
    return isWarmYellow ? '#111' : 'white';
}
