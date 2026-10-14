// Purpose: shell layout state. The left-rail collapse boolean is persisted to a
// COOKIE (not localStorage). The server NEVER reads it: anonymous HTML is cached
// at the edge for a day and is not keyed on this cookie, so any server-side read
// leaked the first visitor's width to everyone (cc.design.md D1, R-A).
//
// First paint is owned by a blocking inline script in <head>
// (`components/shell/railInitScript`) that mirrors the cookie onto
// `<html data-rail="collapsed|expanded">`; CSS reads that attribute for the rail
// width. This atom only drives the toggle button and the collapsed CONTENT.
//
// Invariants:
//   - Cookie name is `railCollapsed`, values are exactly '1' (collapsed) or '0'.
//   - The atom seeds `false` on server AND first client render (identical
//     markup, no hydration mismatch); it syncs from the attribute after mount.
// Side effects: writing the atom writes `document.cookie` and the `data-rail`
// attribute (client only).

import { atom } from 'jotai';

const COOKIE_NAME = 'railCollapsed';
const RAIL_ATTRIBUTE = 'data-rail';
const ONE_YEAR_SECONDS = 31536000;

// Pure: read the `railCollapsed=1` token out of a raw cookie header.
export function parseRailCollapsedCookie(
    cookieHeader: string | null | undefined
): boolean {
    if (!cookieHeader) return false;
    return cookieHeader
        .split(';')
        .map((part) => part.trim())
        .some((part) => part === `${COOKIE_NAME}=1`);
}

// The attribute is what the user sees on screen, so it wins; the cookie is the
// fallback when the inline script did not run.
function readCollapsedFromDocument(): boolean {
    const attribute = document.documentElement.getAttribute(RAIL_ATTRIBUTE);
    if (attribute) return attribute === 'collapsed';
    return parseRailCollapsedCookie(document.cookie);
}

function writeCollapsed(collapsed: boolean): void {
    document.cookie = `${COOKIE_NAME}=${collapsed ? '1' : '0'}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    document.documentElement.setAttribute(
        RAIL_ATTRIBUTE,
        collapsed ? 'collapsed' : 'expanded'
    );
}

const baseCollapsedAtom = atom<boolean>(false);

// onMount runs after hydration, so the first client render still matches server.
baseCollapsedAtom.onMount = (set) => {
    set(readCollapsedFromDocument());
};

export const isLeftRailCollapsedAtom = atom(
    (get) => get(baseCollapsedAtom),
    (get, set, next: boolean) => {
        set(baseCollapsedAtom, next);
        writeCollapsed(next);
    }
);
