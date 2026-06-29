// Purpose: loading placeholder for the server TagCloud. Used as the Suspense
// fallback at the rail composition site (TagCloud cannot show its own async
// skeleton). A few muted, animated chip placeholders.
// Side effects: none (pure presentational).

const CHIP_WIDTHS = ['w-16', 'w-12', 'w-20', 'w-14', 'w-10', 'w-16'];

export const TagCloudSkeleton = () => (
    <div
        className="flex flex-wrap gap-2"
        aria-hidden="true"
    >
        {CHIP_WIDTHS.map((width, index) => (
            <span
                key={index}
                className={`h-6 ${width} animate-pulse rounded-full bg-muted`}
            />
        ))}
    </div>
);

export default TagCloudSkeleton;
