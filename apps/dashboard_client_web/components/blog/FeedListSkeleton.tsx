// Purpose: placeholder for a feed list (home, tag feed, Suspense fallback of
// the post list). Cards match RecentPostCard: square corners, border-primary,
// lg:max-w-2xl centered, byline / title / image / text / footer rows.
// Side effects: none (pure presentational).

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const bar = 'rounded-none';

const FeedCardSkeleton = () => (
    <Card className="rounded-none border-primary bg-card lg:mx-auto lg:max-w-2xl">
        <CardHeader className="p-3 pb-0 sm:p-4 sm:pb-0">
            <div className="flex items-center gap-2">
                <Skeleton className={`h-4 w-40 ${bar}`} />
            </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-3 pt-3 sm:p-4 sm:pt-3">
            <Skeleton className={`h-6 w-3/4 ${bar}`} />
            <Skeleton className={`aspect-video w-full ${bar}`} />
            <Skeleton className={`h-4 w-full ${bar}`} />
            <Skeleton className={`h-4 w-5/6 ${bar}`} />
            <div className="flex gap-2 border-t border-primary/30 pt-3">
                <Skeleton className={`h-8 w-16 ${bar}`} />
                <Skeleton className={`h-8 w-16 ${bar}`} />
                <Skeleton className={`h-8 w-16 ${bar}`} />
            </div>
        </CardContent>
    </Card>
);

export const FeedListSkeleton = ({ count = 3 }: { count?: number }) => (
    <div
        className="flex flex-col gap-4"
        aria-busy="true"
    >
        {Array.from({ length: count }, (_, index) => (
            <FeedCardSkeleton key={index} />
        ))}
    </div>
);

export default FeedListSkeleton;
