'use client';

import { Provider } from 'jotai';

// Per-request Jotai store. Without a Provider every server render shares the
// module-level default store, and useHydrateAtoms seeds an atom only once per
// store: the first request's value (e.g. rail expanded) leaks into every later
// request, so a visitor with `railCollapsed=1` got expanded server HTML and a
// collapsed client render (hydration mismatch, 2026-10-13).
export function JotaiProvider({ children }: { children: React.ReactNode }) {
    return <Provider>{children}</Provider>;
}

export default JotaiProvider;
