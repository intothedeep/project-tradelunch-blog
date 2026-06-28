// Purpose: open-state for the shared slide-up menu drawer.
// One source of truth so any trigger (mobile floating button, dashboard
// in-chart menu button) opens the same modal menu.

import { atom } from 'jotai';

export const isMenuDrawerOpenAtom = atom(false);
