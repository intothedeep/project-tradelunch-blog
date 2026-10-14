import 'server-only';

import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { TProjectPost, TProjectRef } from '@repo/types';
import { serverRequest } from '@/apis/http.server';
import { ApiError } from '@/utils/apiError.util';

type TProjectPosts = { project: TProjectRef; posts: TProjectPost[] };

// Posts of one project for /@u/projects/<project>, ordered priority ASC, seq ASC
// (#73); the endpoint sorts server-side. `project` is the decoded category title; a 404 from
// the endpoint (unknown project) becomes notFound().
export const getProjectPosts = cache(
    async (username: string, project: string): Promise<TProjectPosts> => {
        try {
            const env = await serverRequest<{
                success: boolean;
                data: TProjectPosts;
            }>({
                path: `/v1/api/posts/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(project)}`,
                fallbackError: 'Failed to fetch project posts',
            });
            return env.data;
        } catch (error) {
            if (error instanceof ApiError && error.status === 404) notFound();
            throw error;
        }
    }
);
