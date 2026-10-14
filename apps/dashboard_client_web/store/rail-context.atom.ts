import { atom } from 'jotai';

// Leaf-to-rail signal: a page the URL cannot classify (a project post is just
// `/@u/<slug>`) publishes "hide Recently viewed" here via RailContextPublisher.
// The left rail reads it next to the pathname rule (utils/rail-visibility).
// Resets to false on unmount, so leaving the page restores the widget.
export const hideRecentAtom = atom(false);
