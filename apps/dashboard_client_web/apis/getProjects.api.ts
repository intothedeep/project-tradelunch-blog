import 'server-only';

import { cache } from 'react';
import type { TProjectCard } from '@repo/types';
import { serverRequest } from '@/apis/http.server';
import { PROJECTS_DATA_SOURCE } from '@/env.schema';
import cardsMock from '@/mocks/projects/cards.json';

// Project cards for /@u/projects. PROJECTS_DATA_SOURCE=mock serves the fixture
// real calls GET /v1/api/posts/users/:u/projects (envelope unwrapped once here).
// Positional primitive args so React cache() dedupes by value.
export const getProjects = cache(
    async (username: string): Promise<TProjectCard[]> => {
        if (PROJECTS_DATA_SOURCE === 'mock') {
            return cardsMock satisfies TProjectCard[];
        }
        const env = await serverRequest<{
            success: boolean;
            data: { projects: TProjectCard[] };
        }>({
            path: `/v1/api/posts/users/${encodeURIComponent(username)}/projects`,
            fallbackError: 'Failed to fetch projects',
        });
        return env.data.projects;
    }
);
