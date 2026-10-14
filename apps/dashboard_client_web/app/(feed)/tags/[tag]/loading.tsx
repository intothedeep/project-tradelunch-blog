import { FeedListSkeleton } from '@/components/blog/FeedListSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Same wrapper and heading row as tags/[tag]/page.tsx.
export default function Loading() {
    return (
        <section className="mx-auto w-full max-w-3xl p-4">
            <Skeleton className="mb-4 h-7 w-40 rounded-none" />
            <FeedListSkeleton />
        </section>
    );
}
