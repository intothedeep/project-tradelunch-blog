import { RESERVED_HANDLE_SEGMENTS } from '@repo/types';

// Path rule for the shared left rail (cc.design.md section 4.4). Pure: the one
// place that says what the rail shows on which route, so no layout passes a
// per-route prop. The rail itself stays on every (shell) route (saved and me
// included, owner 2026-10-14); only "Recently viewed" varies.
//
// Typed against RESERVED_HANDLE_SEGMENTS: renaming the segment there breaks
// this list at compile time instead of silently un-hiding the widget.
const HIDE_RECENT_SEGMENTS: readonly (typeof RESERVED_HANDLE_SEGMENTS)[number][] =
    ['projects'];

export type RailVisibility = { showRecent: boolean };

export function railVisibility(pathname: string): RailVisibility {
    // `/@u/projects/x` -> ['@u', 'projects', 'x']. `/` and `/tags/x` have no
    // '@' first segment and keep the widget.
    const [handle, section] = pathname.split('/').filter(Boolean);
    const inHandle = Boolean(handle?.startsWith('@'));
    const hideRecent =
        inHandle && HIDE_RECENT_SEGMENTS.some((segment) => segment === section);
    return { showRecent: !hideRecent };
}
