// Purpose: shell layout state. The left-rail collapse boolean is persisted to a
// COOKIE (not localStorage) so the SERVER component (BlogShell) can read it via
// next/headers and render the correct rail width on first paint — no width flash.
//
// Invariants:
//   - Cookie name is `railCollapsed`, values are exactly '1' (collapsed) or '0'.
//   - SSR-safe: when `document` is undefined the atom defaults to `false`.
// Side effects: writing the atom writes `document.cookie` (client only).

import { atom } from 'jotai';

const COOKIE_NAME = 'railCollapsed';
const ONE_YEAR_SECONDS = 31536000;

// Pure: read the `railCollapsed=1` token out of a raw cookie header. Shared by
// the SERVER component (via next/headers cookies()) and the client atom so both
// sides agree on the first-paint value.
export function parseRailCollapsedCookie(
    cookieHeader: string | null | undefined
): boolean {
    if (!cookieHeader) return false;
    return cookieHeader
        .split(';')
        .map((part) => part.trim())
        .some((part) => part === `${COOKIE_NAME}=1`);
}

function readCollapsedFromDocument(): boolean {
    if (typeof document === 'undefined') return false;
    return parseRailCollapsedCookie(document.cookie);
}

function writeCollapsedCookie(collapsed: boolean): void {
    if (typeof document === 'undefined') return;
    const value = collapsed ? '1' : '0';
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

// Base atom seeds from the cookie once on the client. The write path mirrors the
// new value back into the cookie so the next server render matches.
const baseCollapsedAtom = atom<boolean>(readCollapsedFromDocument());

export const isLeftRailCollapsedAtom = atom(
    (get) => get(baseCollapsedAtom),
    (get, set, next: boolean) => {
        set(baseCollapsedAtom, next);
        writeCollapsedCookie(next);
    }
);
