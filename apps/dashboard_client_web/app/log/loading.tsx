import { Skeleton } from '@/components/ui/skeleton';

// Suspense boundary for /log (cacheComponents): the shell shows this until the
// feed fetch in page.tsx resolves.
export default function Loading() {
    return (
        <div className="mx-auto max-w-2xl px-4 py-6">
            <Skeleton className="mb-4 h-6 w-16 rounded-none" />
            <Skeleton className="h-24 w-full rounded-none" />
        </div>
    );
}
