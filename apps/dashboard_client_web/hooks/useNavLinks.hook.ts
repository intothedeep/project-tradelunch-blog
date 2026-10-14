'use client';

// Purpose: single source for the primary nav destinations, shared by the
// desktop bar, the mobile bar, and the slide-up MenuDrawer. Keeping it here
// (not in a component) avoids a circular import between those components.
//
// buildPrimaryNavLinks / usePrimaryNavLinks → the P4 PrimaryNav set
// (Home / All posts / Explore / About / Resume / Write / Saved / My blog; Log hidden). Pure builder
// is testable; the hook resolves Clerk username + auth state.

import { useUser } from '@clerk/nextjs';

import { HOME_FEED_AUTHOR } from '@/utils/blog-author';
import {
    aboutPath,
    postsPath,
    projectsPath,
    resumePath,
    savedPath,
} from '@/utils/routes';

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

// Pure: build the primary nav set consumed by the P4 PrimaryNav.
// `blogUsername` empty/undefined ⇒ "My blog" is omitted (no `/@undefined/posts`).
export const buildPrimaryNavLinks = (
    blogUsername: string | null | undefined
): NavLink[] => {
    const links: NavLink[] = [
        { title: 'Home', href: '/', labelKey: 'nav.home', iconKey: 'home' },
        // Public: the owner's projects, no login. Hidden when no owner is
        // configured (HOME_FEED_AUTHOR empty).
        ...(HOME_FEED_AUTHOR
            ? [
                  {
                      title: 'Projects',
                      href: projectsPath(HOME_FEED_AUTHOR),
                      labelKey: 'nav.projects',
                      iconKey: 'projects',
                  },
              ]
            : []),
        // All posts (/, the all-authors feed) is hidden from the nav by the
        // owner (2026-10-13): Home already lists the posts. The route still
        // works; restore the entry here to show it again:
        // { title: 'All posts', href: '/', labelKey: 'nav.allPosts', iconKey: 'allPosts' },
        // Log (/log, Phase Y) is hidden from the nav by the owner (2026-10-13).
        // The route still works; restore the entry here to show it again:
        // { title: 'Log', href: '/log', labelKey: 'nav.log', iconKey: 'log' }
        // About / Resume live under the owner's handle (#80). Hidden when no
        // owner is configured, like Projects: there is no `/@/about`.
        ...(HOME_FEED_AUTHOR
            ? [
                  {
                      title: 'About',
                      href: aboutPath(HOME_FEED_AUTHOR),
                      labelKey: 'nav.about',
                      iconKey: 'about',
                  },
                  {
                      title: 'Resume',
                      href: resumePath(HOME_FEED_AUTHOR),
                      labelKey: 'nav.resume',
                      iconKey: 'resume',
                  },
              ]
            : []),
        {
            title: 'Write',
            href: '/write',
            labelKey: 'nav.write',
            iconKey: 'write',
            requiresAuth: true,
        },
    ];

    const username = blogUsername?.trim();
    // Saved and My blog are the viewer's own, `/@<viewer>/…`: both wait for a
    // resolved username (never `/@undefined/saved`).
    if (username) {
        links.push({
            title: 'Saved',
            href: savedPath(username),
            labelKey: 'nav.saved',
            iconKey: 'saved',
            requiresAuth: true,
        });
        links.push({
            title: 'My blog',
            href: postsPath(username),
            labelKey: 'nav.myBlog',
            iconKey: 'myBlog',
            requiresAuth: true,
        });
    }

    // Explore stays last (owner, 2026-10-13): below Saved / My blog.
    links.push({
        // Real search/discovery surface (P6, DEFERRED). Shown DISABLED as a
        // "coming soon" affordance — no `/explore` route exists yet, so the
        // PrimaryNav renders it as a non-clickable, muted placeholder. Flip
        // `disabled` off + add the route when P6 (search API + /explore) lands.
        title: 'Explore',
        href: '/explore',
        labelKey: 'nav.explore',
        iconKey: 'explore',
        disabled: true,
    });

    return links;
};

// Resolve the P4 primary set with auth gating applied (single source for every
// consumer: left rail + mobile drawer). Auth-only entries (Write / Saved / My
// blog) are dropped while signed out; "My blog" additionally resolves to the
// signed-in user's `/@<username>/posts` and stays hidden without a username, so
// we never emit `/@me/posts` or `/@undefined/posts`.
export const usePrimaryNavLinks = (): NavLink[] => {
    const { user, isSignedIn } = useUser();
    return buildPrimaryNavLinks(user?.username ?? null).filter(
        (link) => !link.requiresAuth || isSignedIn
    );
};
