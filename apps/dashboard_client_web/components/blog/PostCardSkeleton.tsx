import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const PostCardSkeleton = () => {
    return (
        <Card
            className={cn(
                'flex-1 min-w-0',
                'bg-card border-primary',
                'text-sm'
            )}
        >
            <CardHeader className={cn('p-3 pb-0 sm:p-4 sm:pb-0')}>
                {/* Header skeleton */}
                <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                </div>
                {/* Title skeleton */}
                <Skeleton className="h-7 w-3/4 mb-2" />
            </CardHeader>

            <CardContent className="p-3 pt-4 sm:p-4 sm:pt-4">
                {/* Content skeleton */}
                <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-32 w-full mt-4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
            </CardContent>
        </Card>
    );
};
