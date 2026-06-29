import { cookies } from 'next/headers';
import { LeftRailAside } from '@/components/shell/LeftRailAside.client';

// Purpose: the multi-user blog layout shell. A SERVER component that arranges
// four named slots into a responsive column layout and reads the
// `railCollapsed` cookie so the left rail renders at the correct width on the
// first paint (no flash).
//
// Responsive behaviour:
//   - <md  : main only (left rail reachable via mobile drawer wired in P3/P4).
//   - md   : left rail + main (right rail hidden).
//   - >=lg : left rail + main + right rail.
//
// The slot interface is intentionally flat/named so a later Parallel-Routes
// refactor can swap the slot wiring without touching this signature.
//
// Invariants: `main` always renders. Optional slots render nothing when absent.
// Side effects: reads request cookies (next/headers).

export type BlogShellProps = {
    topbar?: React.ReactNode;
    leftRail?: React.ReactNode;
    main: React.ReactNode;
    rightRail?: React.ReactNode;
    // <lg "Categories / About this blog" sheet trigger area. Filled per-route in
    // P5; its sheet content + a11y focus-trap arrive in P5/P4. Kept here so P5
    // can plug in without changing this signature.
    userContextSheet?: React.ReactNode;
};

export const BlogShell = async ({
    topbar,
    leftRail,
    main,
    rightRail,
    userContextSheet,
}: BlogShellProps) => {
    const cookieStore = await cookies();
    const isLeftRailCollapsed = cookieStore.get('railCollapsed')?.value === '1';

    return (
        <div className="flex min-h-screen flex-col bg-background">
            {topbar ? (
                <header className="sticky top-0 z-30 w-full border-b border-border bg-background">
                    {topbar}
                </header>
            ) : null}

            <div className="flex w-full flex-1">
                {leftRail ? (
                    <LeftRailAside initialCollapsed={isLeftRailCollapsed}>
                        {leftRail}
                    </LeftRailAside>
                ) : null}

                <main className="flex min-w-0 flex-1 justify-center">
                    {/* Single source of the content-column padding for BOTH `/`
                        and `/blog/[username]`: 8px on mobile, 16px from sm up. */}
                    <div className="w-full max-w-3xl p-2 sm:p-4">{main}</div>
                </main>

                {rightRail ? (
                    <aside className="hidden w-72 shrink-0 border-l border-border lg:block xl:w-80">
                        {rightRail}
                    </aside>
                ) : null}
            </div>

            {userContextSheet ? (
                <div className="lg:hidden">{userContextSheet}</div>
            ) : null}
        </div>
    );
};

export default BlogShell;
