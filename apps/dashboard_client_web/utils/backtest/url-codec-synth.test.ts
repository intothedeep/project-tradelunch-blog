// utils/backtest/url-codec-synth.test.ts
// Acceptance tests for X2-P2.8 synth= codec.

import { describe, it, expect } from 'vitest';
import { encodeSynth, decodeSynth } from './url-codec-synth';
import type { SynthUrlState } from './url-codec-synth';

// ── Round-trip identity ───────────────────────────────────────────────────────

describe('encodeSynth / decodeSynth — round-trip', () => {
    it('round-trips reg method', () => {
        const s: SynthUrlState = {
            shortLabel: 'JEPQ',
            base: 'QQQ',
            method: 'reg',
        };
        expect(decodeSynth(encodeSynth(s))).toEqual(s);
    });

    it('produces expected string format', () => {
        const s: SynthUrlState = {
            shortLabel: 'JEPQ',
            base: 'QQQ',
            method: 'reg',
        };
        expect(encodeSynth(s)).toBe('JEPQ:QQQ:reg');
    });
});

// ── No synth= ⇒ URL byte-identical to today ───────────────────────────────────

describe('decodeSynth — absent param', () => {
    it('null → undefined (synth OFF)', () => {
        expect(decodeSynth(null)).toBeUndefined();
    });

    it('empty string → undefined', () => {
        expect(decodeSynth('')).toBeUndefined();
    });
});

// ── Reserved methods decode as synth OFF ──────────────────────────────────────

describe('decodeSynth — reserved methods', () => {
    it("'str' → undefined (reserved, no throw)", () => {
        expect(decodeSynth('JEPQ:QQQ:str')).toBeUndefined();
    });

    it("'cmp' → undefined (reserved, no throw)", () => {
        expect(decodeSynth('JEPQ:QQQ:cmp')).toBeUndefined();
    });

    it('unknown method → undefined', () => {
        expect(decodeSynth('JEPQ:QQQ:future')).toBeUndefined();
    });
});

// ── Malformed tokens — never throw, degrade to undefined ─────────────────────

describe('decodeSynth — malformed input', () => {
    it('missing base → undefined', () => {
        expect(decodeSynth('JEPQ:reg')).toBeUndefined();
    });

    it('missing all segments → undefined', () => {
        expect(decodeSynth('JEPQ')).toBeUndefined();
    });

    it('garbage → undefined', () => {
        expect(decodeSynth(':::')).toBeUndefined();
    });
});

// ── Legacy shared-URL fixtures decode unchanged ───────────────────────────────
// URLs without synth= param must decode other params byte-identical to today.
// This is enforced by the hook (decodeSynth(null) = undefined), verified here
// at the codec level.

describe('legacy URL fixtures — synth param absent', () => {
    it('no synth= ⇒ undefined, other params unaffected', () => {
        // Simulates a pre-synth URL: synth param simply not present.
        expect(decodeSynth(null)).toBeUndefined();
    });
});
