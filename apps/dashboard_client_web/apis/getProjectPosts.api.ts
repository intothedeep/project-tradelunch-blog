import 'server-only';

import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { TProjectPost, TProjectRef } from '@repo/types';
import { serverRequest } from '@/apis/http.server';
import { PROJECTS_DATA_SOURCE } from '@/env.schema';
import { ApiError } from '@/utils/apiError.util';
import postsMock from '@/mocks/projects/posts.json';

type TProjectPosts = { project: TProjectRef; posts: TProjectPost[] };

// seq is an int8 string: compare as BigInt, never Number().
const byPriorityThenSeq = (a: TProjectPost, b: TProjectPost): number =>
    a.priority - b.priority ||
    (BigInt(a.seq) < BigInt(b.seq)
        ? -1
        : BigInt(a.seq) > BigInt(b.seq)
          ? 1
          : 0);

// Posts of one project for /@u/projects/<project>, ordered priority ASC, seq ASC
// (#73). The real endpoint sorts server-side; the fixture is sorted here so its
// file order never matters. `project` is the decoded category title; a 404 from
// the endpoint (unknown project) becomes notFound().
export const getProjectPosts = cache(
    async (username: string, project: string): Promise<TProjectPosts> => {
        if (PROJECTS_DATA_SOURCE === 'mock') {
            const found = (postsMock satisfies TProjectPosts[]).find(
                (entry) => entry.project.project === project
            );
            if (!found) notFound();
            return {
                project: found.project,
                posts: [...found.posts].sort(byPriorityThenSeq),
            };
        }
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
