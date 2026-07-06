'use client';

// Purpose: single source for the primary nav destinations, shared by the
// desktop bar, the mobile bar, and the slide-up MenuDrawer. Keeping it here
// (not in a component) avoids a circular import between those components.
//
// Two link sets live here:
//   - buildNavLinks / useNavLinks   → the legacy compact bar set (unchanged).
//   - buildPrimaryNavLinks / usePrimaryNavLinks → the P4 PrimaryNav set
//     (Home / All posts / About / Resume / Write / Saved / My blog). Pure builder
//     is testable; the hook resolves Clerk username + auth state.

import { useUser } from '@clerk/nextjs';

// `labelKey` is an optional i18n key (namespace `blog`) for the P4 PrimaryNav;
// `disabled` marks a placeholder destination; `iconKey` is an optional icon hint.
export type NavLink = {
    title: string;
    href: string;
    labelKey?: string;
    iconKey?: string;
    disabled?: boolean;
    requiresAuth?: boolean;
};

// Pure: the header bar's market destinations. About / blog / resume live in the
// left-rail primary nav, so the header carries only the finance surfaces — the
// chart dashboard, the SEC 13F funds viewer, the weekly market-cap rankings, the
// 13F consensus candidate screener (Phase P), the politician PTR directory,
// and the asset backtest tool.
// Desktop renders these inside a single "MARKETS" dropdown (TopBar); the mobile
// drawer lists them flat via NavMenu. No username needed.
export const buildNavLinks = (): NavLink[] => [
    { title: 'dashboard', href: '/dashboard' },
    { title: 'SEC 13F funds', href: '/funds' },
    { title: 'marketcap rankings', href: '/rankings' },
    { title: 'screener', href: '/screener' },
    { title: 'politicians', href: '/politicians' },
    { title: 'backtest', href: '/backtest' },
];

// Pure: build the primary nav set consumed by the P4 PrimaryNav.
// `blogUsername` empty/undefined ⇒ "My blog" is omitted (no /blog/@undefined).
export const buildPrimaryNavLinks = (
    blogUsername: string | null | undefined
): NavLink[] => {
    const links: NavLink[] = [
        { title: 'Home', href: '/', labelKey: 'nav.home', iconKey: 'home' },
        {
            // The all-authors aggregate feed. The cross-author discovery surface
            // while `/` is the owner's blog.
            title: 'All posts',
            href: '/blog',
            labelKey: 'nav.allPosts',
            iconKey: 'allPosts',
        },
        {
            // Real search/discovery surface (P6, DEFERRED). Shown DISABLED as a
            // "coming soon" affordance — no `/explore` route exists yet, so the
            // PrimaryNav renders it as a non-clickable, muted placeholder. Flip
            // `disabled` off + add the route when P6 (search API + /explore) lands.
            title: 'Explore',
            href: '/explore',
            labelKey: 'nav.explore',
            iconKey: 'explore',
            disabled: true,
        },
        {
            title: 'About',
            href: '/about',
            labelKey: 'nav.about',
            iconKey: 'about',
        },
        {
            title: 'Resume',
            href: '/resume',
            labelKey: 'nav.resume',
            iconKey: 'resume',
        },
        {
            title: 'Write',
            href: '/write',
            labelKey: 'nav.write',
            iconKey: 'write',
            requiresAuth: true,
        },
        {
            title: 'Saved',
            href: '/me/saved',
            labelKey: 'nav.saved',
            iconKey: 'saved',
            requiresAuth: true,
        },
    ];

    const username = blogUsername?.trim();
    if (username) {
        links.push({
            title: 'My blog',
            href: `/blog/@${username}`,
            labelKey: 'nav.myBlog',
            iconKey: 'myBlog',
            requiresAuth: true,
        });
    }

    return links;
};

// The header link set is static (dashboard + resume); kept as a hook so call
// sites stay stable if it grows user-dependent again.
export const useNavLinks = (): NavLink[] => buildNavLinks();

// Resolve the P4 primary set with auth gating applied (single source for every
// consumer: left rail + mobile drawer). Auth-only entries (Write / Saved / My
// blog) are dropped while signed out; "My blog" additionally resolves to the
// signed-in user's `/blog/@<username>` and stays hidden without a username, so
// we never emit `/blog/@me` or `/blog/@undefined`.
export const usePrimaryNavLinks = (): NavLink[] => {
    const { user, isSignedIn } = useUser();
    return buildPrimaryNavLinks(user?.username ?? null).filter(
        (link) => !link.requiresAuth || isSignedIn
    );
};
