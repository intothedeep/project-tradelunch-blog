import {
    MobileMenuSkeleton,
    ProjectCardSkeleton,
} from '@/components/projects/ProjectsLoading';
import { Skeleton } from '@/components/ui/skeleton';

// Same structure as projects/page.tsx: accordion (< lg), heading, card grid.
export default function Loading() {
    return (
        <section
            className="flex flex-col gap-4"
            aria-busy="true"
        >
            <MobileMenuSkeleton />
            <header className="flex flex-col gap-2">
                <Skeleton className="h-7 w-32 rounded-none" />
                <Skeleton className="h-4 w-56 rounded-none" />
            </header>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((index) => (
                    <li key={index}>
                        <ProjectCardSkeleton />
                    </li>
                ))}
            </ul>
        </section>
    );
}
