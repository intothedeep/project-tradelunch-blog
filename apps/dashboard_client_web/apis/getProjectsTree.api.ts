import 'server-only';

import { cache } from 'react';
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
