// utils/formatPostDate.test.ts
// Purpose: guarantee the date renders identically regardless of runtime TZ
// (the property that fixes React hydration mismatch #418).

import { describe, it, expect } from 'vitest';
import { formatPostDate } from '@/utils/formatPostDate';

describe('formatPostDate', () => {
    it('slices the UTC calendar date from an ISO-UTC timestamp', () => {
        expect(formatPostDate('2026-07-03T03:34:56.000Z')).toBe('2026-07-03');
    });

    it('is timezone-independent: a late-UTC instant still yields the UTC date', () => {
        // 23:30 UTC = 08:30 KST next day; date-fns would diverge here, slice does not.
        expect(formatPostDate('2026-07-02T23:30:00.000Z')).toBe('2026-07-02');
    });

    it('handles a bare date string', () => {
        expect(formatPostDate('2026-07-03')).toBe('2026-07-03');
    });

    it('returns empty string for undefined or malformed input', () => {
        expect(formatPostDate(undefined)).toBe('');
        expect(formatPostDate('not-a-date')).toBe('');
    });
});
