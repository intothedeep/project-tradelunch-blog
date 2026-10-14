import { LeftRailAside } from '@/components/shell/LeftRailAside.client';
import { LeftRailContainer } from '@/components/rail/LeftRailContainer.server';

// Same shell as About: the global left rail, no BlogShell (its max-w-3xl cap
// would squeeze the A4 resume and ResumeTOC). Main is full-width and min-w-0 so
// the page's own `container` shrinks beside the rail instead of overflowing.
// No `railCollapsed` cookie read: `[handle]` layouts stay free of request APIs
// (cacheComponents, design §7.3), so the rail seeds expanded.
export default function ResumeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col bg-background font-mono">
            <div className="flex w-full flex-1">
                <LeftRailAside>
                    <LeftRailContainer />
                </LeftRailAside>

                <main className="flex min-w-0 flex-1 flex-col">{children}</main>
            </div>
        </div>
    );
}
