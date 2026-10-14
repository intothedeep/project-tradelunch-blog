import 'server-only';

import { cache } from 'react';
import type { TProjectCard } from '@repo/types';
import { serverRequest } from '@/apis/http.server';

// Project cards for /@u/projects: GET /v1/api/posts/users/:u/projects (envelope unwrapped once here).
// Positional primitive args so React cache() dedupes by value.
export const getProjects = cache(
    async (username: string): Promise<TProjectCard[]> => {
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
