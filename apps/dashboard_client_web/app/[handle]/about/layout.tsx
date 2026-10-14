import { LeftRailAside } from '@/components/shell/LeftRailAside.client';
import { LeftRailContainer } from '@/components/rail/LeftRailContainer.server';

// The owner's About page wears the SAME global left rail as `/`. It
// deliberately does NOT use BlogShell: BlogShell caps its main column at
// max-w-3xl, but the portfolio (TerminalProfile) is a wide, multi-column layout
// that brings its own `container`, so main here is full-width. The top bar comes
// from the root layout (CustomNavigation); the right rail is intentionally omitted.
// No `railCollapsed` cookie read here: under `[handle]` layouts stay free of
// request APIs (cacheComponents, design §7.3), so the rail seeds expanded.
export default function AboutLayout({
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
