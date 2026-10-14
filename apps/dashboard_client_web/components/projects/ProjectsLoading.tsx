// Purpose: placeholders shared by the two projects loading.tsx files.
// Side effects: none (pure presentational).

import { Skeleton } from '@/components/ui/skeleton';

const bar = 'rounded-none';

// < lg accordion trigger that ProjectsMobileMenu renders above the main column.
export const MobileMenuSkeleton = () => (
    <div className="mb-3 lg:hidden">
        <Skeleton className={`h-10 w-full ${bar}`} />
    </div>
);

export const ProjectCardSkeleton = () => (
    <div className="h-full overflow-hidden border border-primary bg-card">
        <Skeleton className={`aspect-video w-full ${bar}`} />
        <div className="flex flex-col gap-2 p-3 sm:p-4">
            <Skeleton className={`h-5 w-1/2 ${bar}`} />
            <Skeleton className={`h-3 w-3/4 ${bar}`} />
            <Skeleton className={`h-3 w-1/4 ${bar}`} />
        </div>
    </div>
);

// One "N. title" heading plus a [image | text] card, like ProjectPostList.
export const ProjectPostItemSkeleton = () => (
    <li className="flex flex-col gap-3">
        <Skeleton className={`h-7 w-2/3 ${bar}`} />
        <div className="flex flex-col gap-4 border border-border p-4 sm:flex-row">
            <Skeleton
                className={`aspect-video w-full shrink-0 sm:w-48 ${bar}`}
            />
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                    <Skeleton className={`h-4 w-full ${bar}`} />
                    <Skeleton className={`h-4 w-5/6 ${bar}`} />
                    <Skeleton className={`h-4 w-2/3 ${bar}`} />
                </div>
                <Skeleton className={`h-3 w-20 self-end ${bar}`} />
            </div>
        </div>
    </li>
);
