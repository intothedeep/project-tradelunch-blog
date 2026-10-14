import 'server-only';

import { cache } from 'react';
import type { TProjectCard } from '@repo/types';
import { PROJECTS_DATA_SOURCE } from '@/env.schema';
import cardsMock from '@/mocks/projects/cards.json';

// Project cards for /@u/projects. PROJECTS_DATA_SOURCE=mock serves the fixture
// until GET /v1/api/posts/users/:u/projects exists (PJ-1-15..17). Positional
// primitive args so React cache() dedupes by value.
export const getProjects = cache(
    async (username: string): Promise<TProjectCard[]> => {
        if (PROJECTS_DATA_SOURCE === 'mock') {
            return cardsMock satisfies TProjectCard[];
        }
        throw new Error(
            `Projects real API is not built yet (PJ-1-17): ${username}`
        );
    }
);
