// Purpose: open-state for the shared slide-up menu drawer, plus the optional
// secondary menu a page may contribute to that drawer.
// One source of truth so any trigger (mobile floating button, dashboard
// in-chart menu button) opens the same modal menu. When pageMenuAtom is set,
// the drawer first shows a chooser (site menu vs the page menu) instead of
// opening the site menu directly.

import { atom } from 'jotai';
import type { ReactNode } from 'react';

export const isMenuDrawerOpenAtom = atom(false);

// A menu the current page contributes to the hamburger drawer (e.g. the fund
// list on /funds/[cik]). `content` is rendered inside the drawer when picked.
export interface PageMenu {
    label: string;
    content: ReactNode;
}

export const pageMenuAtom = atom<PageMenu | null>(null);
