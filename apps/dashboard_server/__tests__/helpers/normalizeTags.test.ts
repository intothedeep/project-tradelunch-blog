import { normalizeTags } from '../../src/helpers/normalizeTags';

describe('normalizeTags', () => {
    it('trims, lowercases, and de-duplicates (case-insensitive)', () => {
        const result = normalizeTags(['  React ', 'react', 'NODE', 'node']);
        expect(result).toEqual({ ok: true, value: ['react', 'node'] });
    });

    it('drops empty / whitespace-only entries', () => {
        const result = normalizeTags(['', '   ', 'ts']);
        expect(result).toEqual({ ok: true, value: ['ts'] });
    });

    it('preserves first-appearance order', () => {
        const result = normalizeTags(['b', 'a', 'c', 'a']);
        expect(result).toEqual({ ok: true, value: ['b', 'a', 'c'] });
    });

    it('accepts an empty array (clear set)', () => {
        expect(normalizeTags([])).toEqual({ ok: true, value: [] });
    });

    it('rejects a non-array input', () => {
        expect(normalizeTags('react').ok).toBe(false);
        expect(normalizeTags(null).ok).toBe(false);
        expect(normalizeTags(undefined).ok).toBe(false);
    });

    it('rejects a non-string element', () => {
        const result = normalizeTags(['ok', 5]);
        expect(result).toEqual({
            ok: false,
            reason: 'each tag must be a string',
        });
    });

    it('rejects a tag longer than 50 characters', () => {
        const result = normalizeTags(['a'.repeat(51)]);
        expect(result).toEqual({
            ok: false,
            reason: 'each tag must be 50 characters or fewer',
        });
    });

    it('accepts a tag exactly 50 characters', () => {
        expect(normalizeTags(['a'.repeat(50)]).ok).toBe(true);
    });

    it('rejects more than 20 tags (after dedupe)', () => {
        const many = Array.from({ length: 21 }, (_, i) => `tag${i}`);
        const result = normalizeTags(many);
        expect(result).toEqual({
            ok: false,
            reason: 'at most 20 tags are allowed',
        });
    });

    it('counts toward the cap AFTER de-duplication (20 uniques pass)', () => {
        const dup = Array.from({ length: 20 }, (_, i) => `tag${i}`);
        const withDupes = [...dup, ...dup]; // 40 entries, 20 unique
        expect(normalizeTags(withDupes).ok).toBe(true);
    });
});
