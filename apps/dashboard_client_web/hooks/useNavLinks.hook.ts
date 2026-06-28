'use client';

// Purpose: single source for the primary nav destinations, shared by the
// desktop bar, the mobile bar, and the slide-up MenuDrawer. Keeping it here
// (not in a component) avoids a circular import between those components.

import { useUser } from '@clerk/nextjs';
import { DEFAULT_BLOG_AUTHOR } from '@/utils/blog-author';

export type NavLink = { title: string; href: string };

// Pure: build the link list for a given blog author username.
export const buildNavLinks = (blogUsername: string): NavLink[] => [
    { title: 'About', href: '/' },
    { title: 'blog', href: `/blog/@${blogUsername}` },
    { title: 'dashboard', href: '/dashboard' },
    { title: 'resume', href: '/resume' },
];

// Resolve links from the (optionally signed-in) Clerk user, falling back to
// the site default author.
export const useNavLinks = (): NavLink[] => {
    const { user } = useUser();
    return buildNavLinks(user?.username ?? DEFAULT_BLOG_AUTHOR);
};
