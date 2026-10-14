import 'server-only';

import { cache } from 'react';
import { getComments } from '@/apis/getComments.api';

// The first comment page as the post detail seeds it. cache() lets a layout
// preload it (`void`) while the Comments leaf awaits the same in-flight promise.
// Positional primitive arg so cache() dedupes by value.
export const getCommentsFirstPage = cache((postId: string) =>
    getComments(postId, { limit: 50 })
);

export const preloadCommentsFirstPage = (postId: string) => {
    void getCommentsFirstPage(postId).catch(() => undefined);
};
