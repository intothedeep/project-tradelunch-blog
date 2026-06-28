// components/write/TagInput.test.ts
// Purpose: lock the pure tag add-rule — lowercase canonicalization plus the
// empty / too-long / count-cap / duplicate guards, none mutating the input.

import { describe, it, expect } from 'vitest';
import {
    addTag,
    TAG_MAX_LEN,
    TAG_MAX_COUNT,
} from '@/components/write/TagInput.client';

describe('addTag', () => {
    it('trims and lowercases an accepted tag', () => {
        expect(addTag([], '  Stocks ')).toEqual({
            tags: ['stocks'],
            error: null,
        });
    });

    it('is a silent no-op for empty / whitespace input', () => {
        expect(addTag(['a'], '   ')).toEqual({ tags: ['a'], error: null });
    });

    it('blocks a tag longer than the length cap', () => {
        const long = 'x'.repeat(TAG_MAX_LEN + 1);
        expect(addTag([], long)).toEqual({ tags: [], error: 'tooLong' });
    });

    it('allows a tag exactly at the length cap', () => {
        const exact = 'x'.repeat(TAG_MAX_LEN);
        expect(addTag([], exact)).toEqual({ tags: [exact], error: null });
    });

    it('blocks a case-insensitive duplicate', () => {
        expect(addTag(['stocks'], 'STOCKS')).toEqual({
            tags: ['stocks'],
            error: 'duplicate',
        });
    });

    it('blocks adding past the count cap', () => {
        const full = Array.from({ length: TAG_MAX_COUNT }, (_, i) => `t${i}`);
        expect(addTag(full, 'extra')).toEqual({ tags: full, error: 'limit' });
    });

    it('does not mutate the input array', () => {
        const input = ['a'];
        addTag(input, 'b');
        expect(input).toEqual(['a']);
    });
});
