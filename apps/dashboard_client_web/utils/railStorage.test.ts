// Purpose: guard the PURE rail-storage reducers (no DOM): recents cap-20 +
// STRING-id de-dupe + move-to-front; saved-tags cap-50 + case-insensitive dedup.

import { describe, it, expect } from 'vitest';
import { addRecent, RECENTS_CAP } from '@/utils/recents.util';
import {
    addSavedTag,
    removeSavedTag,
    isSavedTag,
    SAVED_TAGS_CAP,
} from '@/utils/savedTags.util';
import type { TRecentPost } from '@/apis/blog.types';

const post = (id: string, title = `t-${id}`): TRecentPost => ({ id, title });

describe('addRecent', () => {
    it('prepends newest-first', () => {
        const out = addRecent([post('1')], post('2'));
        expect(out.map((p) => p.id)).toEqual(['2', '1']);
    });

    it('de-dupes by id (move-to-front)', () => {
        const out = addRecent(
            [post('1'), post('2'), post('3')],
            post('3', 'x')
        );
        expect(out.map((p) => p.id)).toEqual(['3', '1', '2']);
        expect(out[0]?.title).toBe('x');
    });

    it('compares ids as STRINGS (full-precision Snowflake, never Number())', () => {
        const big1 = '9007199254740993'; // 2^53 + 1
        const big2 = '9007199254740992'; // 2^53 — distinct only as strings
        const out = addRecent([post(big1)], post(big2));
        expect(out.map((p) => p.id)).toEqual([big2, big1]);
        // re-adding big1 must move it, not collapse with big2
        const out2 = addRecent(out, post(big1, 'moved'));
        expect(out2.map((p) => p.id)).toEqual([big1, big2]);
    });

    it('caps at 20', () => {
        let list: TRecentPost[] = [];
        for (let i = 0; i < 30; i += 1) list = addRecent(list, post(String(i)));
        expect(list).toHaveLength(RECENTS_CAP);
        expect(list[0]?.id).toBe('29');
    });
});

describe('saved tags', () => {
    it('canonicalizes lowercase and de-dupes case-insensitively', () => {
        const out = addSavedTag(['react'], 'REACT');
        expect(out).toEqual(['react']);
    });

    it('prepends newest-first', () => {
        expect(addSavedTag(['a'], 'B')).toEqual(['b', 'a']);
    });

    it('ignores blank tags', () => {
        expect(addSavedTag(['a'], '   ')).toEqual(['a']);
    });

    it('caps at 50', () => {
        let list: string[] = [];
        for (let i = 0; i < 60; i += 1) list = addSavedTag(list, `t${i}`);
        expect(list).toHaveLength(SAVED_TAGS_CAP);
    });

    it('removes and checks membership case-insensitively', () => {
        expect(removeSavedTag(['a', 'b'], 'A')).toEqual(['b']);
        expect(isSavedTag(['a'], 'A')).toBe(true);
        expect(isSavedTag(['a'], 'c')).toBe(false);
    });
});
