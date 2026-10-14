// Purpose: the page column(s) beside the global left rail. A SERVER component
// that arranges named slots as flex siblings inside RailFrame's row. It reads no
// request data. The left rail is NOT here: RailFrame renders it once for the
// whole `(shell)` route group.
//
// Responsive behaviour:
//   - <md  : main only (left rail reachable via mobile drawer).
//   - md   : left rail + main (right rail hidden).
//   - >=lg : left rail + main + right rail.
//
// Invariants: `main` always renders. Optional slots render nothing when absent.
// Side effects: none.

export type ContentFrameProps = {
    main: React.ReactNode;
    rightRail?: React.ReactNode;
    // <lg top-of-feed context header (author chip + category/tag chip row),
    // rendered as the FIRST child inside the content column so it inherits the
    // max-w-3xl width + padding.
    mobileTopContext?: React.ReactNode;
};

export const ContentFrame = ({
    main,
    rightRail,
    mobileTopContext,
}: ContentFrameProps) => {
    return (
        <>
            <main className="flex min-w-0 flex-1 justify-center">
                {/* Single source of the content-column padding: 16px (1rem) on
                    every breakpoint. */}
                <div className="w-full max-w-3xl p-4">
                    {mobileTopContext ? (
                        <div className="mb-3 lg:hidden">{mobileTopContext}</div>
                    ) : null}
                    {main}
                </div>
            </main>

            {rightRail ? (
                <aside className="hidden w-72 shrink-0 border-l border-border lg:block xl:w-80">
                    {rightRail}
                </aside>
            ) : null}
        </>
    );
};

export default ContentFrame;
