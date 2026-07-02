// __tests__/helpers/valueBand.test.ts
// Purpose: unit tests for the pure toValueBand helper.
// No I/O, no mocks.

import { toValueBand } from '../../src/helpers/valueBand';

describe('toValueBand — null input', () => {
    it('returns "—" for null', () => {
        expect(toValueBand(null)).toBe('—');
    });
});

describe('toValueBand — zero and sub-$15K', () => {
    it('returns "<$15K" for 0', () => {
        expect(toValueBand(0)).toBe('<$15K');
    });

    it('returns "<$15K" for 1', () => {
        expect(toValueBand(1)).toBe('<$15K');
    });

    it('returns "<$15K" for 14_999', () => {
        expect(toValueBand(14_999)).toBe('<$15K');
    });
});

describe('toValueBand — $15K–$50K band', () => {
    it('returns "$15K–$50K" for 15_000 (lower boundary inclusive)', () => {
        expect(toValueBand(15_000)).toBe('$15K–$50K');
    });

    it('returns "$15K–$50K" for 30_000', () => {
        expect(toValueBand(30_000)).toBe('$15K–$50K');
    });

    it('returns "$15K–$50K" for 49_999 (upper boundary exclusive)', () => {
        expect(toValueBand(49_999)).toBe('$15K–$50K');
    });
});

describe('toValueBand — $50K–$250K band', () => {
    it('returns "$50K–$250K" for 50_000', () => {
        expect(toValueBand(50_000)).toBe('$50K–$250K');
    });

    it('returns "$50K–$250K" for 249_999', () => {
        expect(toValueBand(249_999)).toBe('$50K–$250K');
    });
});

describe('toValueBand — $250K–$1M band', () => {
    it('returns "$250K–$1M" for 250_000', () => {
        expect(toValueBand(250_000)).toBe('$250K–$1M');
    });

    it('returns "$250K–$1M" for 999_999', () => {
        expect(toValueBand(999_999)).toBe('$250K–$1M');
    });
});

describe('toValueBand — >$1M band', () => {
    it('returns ">$1M" for 1_000_000', () => {
        expect(toValueBand(1_000_000)).toBe('>$1M');
    });

    it('returns ">$1M" for large values', () => {
        expect(toValueBand(10_000_000)).toBe('>$1M');
    });
});

describe('toValueBand — bigint input', () => {
    it('handles bigint 0n as "<$15K"', () => {
        expect(toValueBand(BigInt(0))).toBe('<$15K');
    });

    it('handles bigint 1_000_000n as ">$1M"', () => {
        expect(toValueBand(BigInt(1_000_000))).toBe('>$1M');
    });

    it('handles bigint 15_000n as "$15K–$50K"', () => {
        expect(toValueBand(BigInt(15_000))).toBe('$15K–$50K');
    });
});
