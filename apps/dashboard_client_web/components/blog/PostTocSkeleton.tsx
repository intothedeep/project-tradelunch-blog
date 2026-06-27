import { Skeleton } from '@/components/ui/skeleton';

export const PostTocSkeleton = () => {
    return (
        <aside className="hidden lg:block w-64 xl:w-72 shrink-0">
            <div className="sticky top-4 space-y-3 p-4 rounded-lg border border-border bg-card">
                {/* TOC Header */}
                <Skeleton className="h-5 w-32 mb-4" />

                {/* TOC Items */}
                <div className="space-y-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-36 ml-3" />
                    <Skeleton className="h-3 w-32 ml-3" />
                    <Skeleton className="h-3 w-44" />
                    <Skeleton className="h-3 w-28 ml-3" />
                    <Skeleton className="h-3 w-38" />
                </div>
            </div>
        </aside>
    );
};
