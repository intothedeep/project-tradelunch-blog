import 'server-only';

import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { getCategoriesByUsername } from '@/apis/getCategories.api';
import { sliceProjectsSubtree } from '@/utils/projects-tree';

// The projects subtree of the author's category tree (real endpoint, no mock).
// Positional primitive args so cache() dedupes by value. Callers must pass the
// token the same way (null, never undefined) or they miss each other's entry.
export const getProjectsTree = cache(
    async (username: string, token: string | null) => {
        const { categories } = await getCategoriesByUsername(username, token);
        return sliceProjectsSubtree(categories ?? []);
    }
);

// Is `slug` a post inside one of the author's projects? The URL cannot tell
// (#79). A failed tree read means "not a project post", never a broken page.
export const isProjectPostSlug = async (username: string, slug: string) => {
    const { projectOfSlug } = await getProjectsTree(username, null).catch(
        (error) => {
            unstable_rethrow(error);
            return { projectOfSlug: {} as Record<string, string> };
        }
    );
    return Boolean(projectOfSlug[decodeURIComponent(slug)]);
};

// Start the anonymous tree read without awaiting it (C4): cache() hands the
// in-flight promise to the leaves that read it later. The catch only marks the
// promise handled; those leaves still see a rejection.
export const preloadProjectsTree = (username: string) => {
    void getProjectsTree(username, null).catch(() => undefined);
};
