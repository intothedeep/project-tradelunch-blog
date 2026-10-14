// Purpose: square, muted placeholders for the rail boxes, sized like the final
// boxes so nothing jumps when the real content arrives. Used as Suspense
// fallbacks (server trees, profile card) and as the pre-mount state of the
// localStorage-backed sections (recents, saved tags).
// Side effects: none (pure presentational, identical on server and client).

import { Skeleton } from '@/components/ui/skeleton';

const bar = 'rounded-none';

// Tree rows: indent steps mimic a two-level category/project tree.
const TREE_ROWS = ['w-2/3', 'w-1/2 ml-4', 'w-3/5 ml-4', 'w-3/4', 'w-1/2 ml-4'];

export const RailRowsSkeleton = ({ rows = 3 }: { rows?: number }) => (
    <div
        className="flex flex-col gap-2"
        aria-hidden="true"
    >
        {Array.from({ length: rows }, (_, index) => (
            <Skeleton
                key={index}
                className={`h-6 w-full ${bar}`}
            />
        ))}
    </div>
);

// Header bar + body, same padding as RailSection, for sections whose title is
// not known until the stored value is read.
export const RailSectionSkeleton = ({ rows = 3 }: { rows?: number }) => (
    <section
        className="flex flex-col"
        aria-busy="true"
    >
        <div
            className="px-3 py-2"
            aria-hidden="true"
        >
            <Skeleton className={`h-4 w-28 ${bar}`} />
        </div>
        <div className="px-3 pb-2 pt-1">
            <RailRowsSkeleton rows={rows} />
        </div>
    </section>
);

// Tree rows only, for the mobile accordion body.
export const TreeRowsSkeleton = ({ rows = 5 }: { rows?: number }) => (
    <div
        className="flex flex-col gap-2 px-2 pt-2 pb-1"
        aria-hidden="true"
    >
        {TREE_ROWS.slice(0, rows).map((width, index) => (
            <Skeleton
                key={index}
                className={`h-5 ${width} ${bar}`}
            />
        ))}
    </div>
);

// Card with a title bar and tree rows, like the Projects/Categories cards.
export const RailCardSkeleton = ({ rows = 5 }: { rows?: number }) => (
    <div
        className="border border-primary bg-card"
        aria-busy="true"
    >
        <div
            className="border-b border-primary/30 p-3 sm:p-4"
            aria-hidden="true"
        >
            <Skeleton className={`h-5 w-1/2 ${bar}`} />
        </div>
        <TreeRowsSkeleton rows={rows} />
        <div className="pb-2" />
    </div>
);

// Author profile card: avatar + two lines + count line.
export const ProfileCardSkeleton = () => (
    <div
        className="flex flex-col gap-2 border border-border p-3"
        aria-busy="true"
    >
        <div
            className="flex items-center gap-3"
            aria-hidden="true"
        >
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
                <Skeleton className={`h-4 w-2/3 ${bar}`} />
                <Skeleton className={`h-3 w-1/3 ${bar}`} />
            </div>
        </div>
        <Skeleton
            className={`h-3 w-1/2 ${bar}`}
            aria-hidden="true"
        />
    </div>
);
