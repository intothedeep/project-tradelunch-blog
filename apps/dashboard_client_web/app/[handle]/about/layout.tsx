import { cookies } from 'next/headers';

import { LeftRailAside } from '@/components/shell/LeftRailAside.client';
import { LeftRailContainer } from '@/components/rail/LeftRailContainer.server';

// /about wears the SAME global left rail as `/` (Home/Explore/Write/Saved +
// popular tags), wired identically to BlogShell — the width-bearing aside reads
// the `railCollapsed` cookie for a flash-free first paint and stays reactive to
// the collapse toggle via the shared atom. It deliberately does NOT use BlogShell
// itself: BlogShell caps its main column at max-w-3xl, but the portfolio
// (TerminalProfile) is a wide, multi-column layout that brings its own
// `container`, so main here is full-width. The top bar comes from the root
// layout (CustomNavigation); the right rail is intentionally omitted.
// Side effects: reads request cookies (next/headers) → renders /about dynamically.
export default async function AboutLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const isLeftRailCollapsed =
        (await cookies()).get('railCollapsed')?.value === '1';

    return (
        <div className="flex min-h-screen flex-col bg-background font-mono">
            <div className="flex w-full flex-1">
                <LeftRailAside initialCollapsed={isLeftRailCollapsed}>
                    <LeftRailContainer />
                </LeftRailAside>

                <main className="flex min-w-0 flex-1 flex-col">{children}</main>
            </div>
        </div>
    );
}
