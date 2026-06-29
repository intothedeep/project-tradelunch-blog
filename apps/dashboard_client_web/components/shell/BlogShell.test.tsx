// Unit test for the shell's first-paint cookie contract. BlogShell itself is an
// async Server Component that reads next/headers `cookies()`, which is awkward
// to render under jsdom — so we test the pure parser that BOTH the server
// component and the client atom rely on to agree on the collapse state.

import { describe, it, expect } from 'vitest';
import { parseRailCollapsedCookie } from '@/store/layout.atom';

describe('parseRailCollapsedCookie', () => {
    it('returns true when railCollapsed=1 is present', () => {
        expect(parseRailCollapsedCookie('railCollapsed=1')).toBe(true);
    });

    it('reads railCollapsed=1 among other cookies', () => {
        expect(
            parseRailCollapsedCookie('theme=dark; railCollapsed=1; foo=bar')
        ).toBe(true);
    });

    it('returns false for railCollapsed=0', () => {
        expect(parseRailCollapsedCookie('railCollapsed=0')).toBe(false);
    });

    it('returns false for unrelated cookies', () => {
        expect(parseRailCollapsedCookie('foo=bar')).toBe(false);
    });

    it('returns false for nullish input', () => {
        expect(parseRailCollapsedCookie(undefined)).toBe(false);
        expect(parseRailCollapsedCookie(null)).toBe(false);
        expect(parseRailCollapsedCookie('')).toBe(false);
    });
});
