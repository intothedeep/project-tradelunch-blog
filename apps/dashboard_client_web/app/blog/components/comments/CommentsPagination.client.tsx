'use client';

// CommentsPagination.client.tsx — bottom "Load more" control for the comment
// thread. Purpose: when more root-comment pages exist, render a button that
// fetches the next 50 roots (+ their subtrees); disabled + labelled "Loading…"
// while in flight; renders nothing when there is no next page.
// Constraints: presentational + callback only; pagination state lives in the
//   useComments infinite query in the parent island.

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type Props = {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onLoadMore: () => void;
};

export const CommentsPagination: React.FC<Props> = ({
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
}) => {
    const t = useTranslations('blog');
    if (!hasNextPage) return null;

    return (
        <div className="mt-3 flex justify-center">
            <button
                type="button"
                onClick={onLoadMore}
                disabled={isFetchingNextPage}
                className={cn(
                    'rounded-md border border-primary/30 px-4 py-2 text-xs font-semibold',
                    'text-primary/80 hover:text-primary hover:border-primary/50',
                    'disabled:cursor-not-allowed disabled:opacity-60'
                )}
            >
                {isFetchingNextPage
                    ? t('comments.loading')
                    : t('comments.loadMore')}
            </button>
        </div>
    );
};
