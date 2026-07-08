// utils/backtest/prng.ts
// Purpose: seeded PRNG primitives shared by projection (Monte Carlo) and synth
//          history (block-bootstrap). Extracted from projection.ts (X2-P2.1).
// Invariant: NO Math.random() — deterministic. Same seed ⇒ identical sequence.
//            mulberry32 + Box–Muller moved verbatim so projection stays
//            byte-identical.

// ── Seeded PRNG: mulberry32 ───────────────────────────────────────────────────
// Returns a closure that yields pseudo-random [0, 1) values.
// Identical seed ⇒ identical sequence (deterministic).
export function mulberry32(seed: number): () => number {
    let s = seed >>> 0;
    return (): number => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ── Box–Muller normal deviate ─────────────────────────────────────────────────
// Produces one N(0,1) sample from two uniforms.
// Clamps u1 away from 0 to guard log(0) = -Infinity.
export function standardNormal(rand: () => number): number {
    const u1 = Math.max(rand(), 1e-10);
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── FNV-1a string hash ────────────────────────────────────────────────────────
// Deterministic 32-bit hash of a label, used to decorrelate per-asset synth
// bootstrap seeds: mulberry32((seed ^ hashLabel(label)) >>> 0).
// Returns an unsigned 32-bit integer.
export function hashLabel(label: string): number {
    let h = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < label.length; i++) {
        h ^= label.charCodeAt(i) & 0xff;
        // 32-bit FNV prime multiply via Math.imul (overflow-safe).
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
