'use client';

// Purpose: single source for the primary nav destinations, shared by the
// desktop bar, the mobile bar, and the slide-up MenuDrawer. Keeping it here
// (not in a component) avoids a circular import between those components.
//
// Two link sets live here:
//   - buildNavLinks / useNavLinks   → the legacy compact bar set (unchanged).
//   - buildPrimaryNavLinks / usePrimaryNavLinks → the P4 PrimaryNav set
//     (Home / Explore / Write / Saved / My blog). Pure builder is testable;
//     the hook resolves Clerk username + auth state.

import { useUser } from '@clerk/nextjs';
import { DEFAULT_BLOG_AUTHOR } from '@/utils/blog-author';

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

// Pure: build the legacy compact link list for a given blog author username.
export const buildNavLinks = (blogUsername: string): NavLink[] => [
    { title: 'About', href: '/about' },
    { title: 'blog', href: `/blog/@${blogUsername}` },
    { title: 'dashboard', href: '/dashboard' },
    { title: 'resume', href: '/resume' },
];

// Pure: build the primary nav set consumed by the P4 PrimaryNav.
// `blogUsername` empty/undefined ⇒ "My blog" is omitted (no /blog/@undefined).
export const buildPrimaryNavLinks = (
    blogUsername: string | null | undefined
): NavLink[] => {
    const links: NavLink[] = [
        { title: 'Home', href: '/', labelKey: 'nav.home', iconKey: 'home' },
        {
            title: 'Explore',
            href: '/explore',
            labelKey: 'nav.explore',
            iconKey: 'explore',
            disabled: true,
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

// Resolve legacy links from the (optionally signed-in) Clerk user, falling back
// to the site default author.
export const useNavLinks = (): NavLink[] => {
    const { user } = useUser();
    return buildNavLinks(user?.username ?? DEFAULT_BLOG_AUTHOR);
};

// Resolve the P4 primary set. "My blog" resolves to the signed-in user's
// `/blog/@<username>` and is hidden when there is no username (signed out /
// not yet onboarded), so we never emit `/blog/@me` or `/blog/@undefined`.
export const usePrimaryNavLinks = (): NavLink[] => {
    const { user } = useUser();
    return buildPrimaryNavLinks(user?.username ?? null);
};
