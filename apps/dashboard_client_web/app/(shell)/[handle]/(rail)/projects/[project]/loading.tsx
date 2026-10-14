import {
    MobileMenuSkeleton,
    ProjectPostItemSkeleton,
} from '@/components/projects/ProjectsLoading';
import { Skeleton } from '@/components/ui/skeleton';

// Same structure as projects/[project]/page.tsx: accordion (< lg), project
// title, count + sort row, numbered list.
export default function Loading() {
    return (
        <section
            className="flex flex-col gap-4"
            aria-busy="true"
        >
            <MobileMenuSkeleton />
            <Skeleton className="h-9 w-1/2 rounded-none" />
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <Skeleton className="h-4 w-16 rounded-none" />
                <Skeleton className="h-4 w-28 rounded-none" />
            </div>
            <ol className="flex flex-col gap-8">
                {[0, 1, 2].map((index) => (
                    <ProjectPostItemSkeleton key={index} />
                ))}
            </ol>
        </section>
    );
}
