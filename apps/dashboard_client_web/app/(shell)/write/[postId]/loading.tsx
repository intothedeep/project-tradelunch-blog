import { Skeleton } from '@/components/ui/skeleton';

// Suspense boundary for the edit route (cacheComponents): params are read
// inside it, and the editor chunk streams in after the shell.
export default function Loading() {
    return <Skeleton className="m-4 h-96 rounded-none" />;
}
