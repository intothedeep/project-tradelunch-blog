'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSetAtom } from 'jotai';
import { NavMenu } from '@/components/nav-menu.client';
import { MenuDrawer } from '@/components/MenuDrawer.client';
import { TopBar } from '@/components/topbar/TopBar.client';
import { isMenuDrawerOpenAtom } from '@/store/menu.atom';
import { useNavLinks } from '@/hooks/useNavLinks.hook';
import { cn } from '@/lib/utils';

// Chart dashboard routes hide the top bar entirely so charts reclaim the full
// navbar band; navigation there happens via the in-chart menu button that opens
// the shared MenuDrawer. The preview grid eval routes keep the normal bar so
// they never lose navigation.
const isChartDashboard = (pathname: string | null): boolean => {
    if (pathname === null || !pathname.startsWith('/dashboard')) return false;
    return (
        pathname !== '/dashboard/preview/cards' &&
        pathname !== '/dashboard/preview/table'
    );
};

// Desktop Navigation: the single global top bar. Removed on the chart dashboard
// (nav lives in the chart header there); rendered everywhere else.
export const DesktopNavigation = () => {
    const pathname = usePathname();

    if (isChartDashboard(pathname)) return null;

    return <TopBar />;
};

// Mobile Navigation: top bar + floating button that opens the shared MenuDrawer.
export const MobileNavigation = () => {
    const links = useNavLinks();
    const openMenu = useSetAtom(isMenuDrawerOpenAtom);
    const pathname = usePathname();

    // On the chart dashboard the top bar is removed too (reclaim space); the
    // floating button below still opens the drawer so nav stays reachable.
    const showTopBar = !isChartDashboard(pathname);

    return (
        <>
            {/* Mobile Header Bar — logo left, theme + auth right.
                Hidden entirely on the chart dashboard; shown on mobile elsewhere. */}
            <nav
                className={cn(
                    'flex h-14 items-center justify-between border-b-2 border-primary bg-background/95 backdrop-blur px-4',
                    showTopBar ? 'md:hidden' : 'hidden'
                )}
            >
                <Link
                    href="/"
                    className="flex items-center gap-2"
                >
                    <div className="w-8 h-8 border-2 border-primary bg-secondary flex items-center justify-center">
                        <span className="text-xl">👨‍💻</span>
                    </div>
                    <span className="text-lg font-mono text-primary terminal-glow">
                        Taek Lim
                    </span>
                </Link>
                <NavMenu
                    links={links}
                    showNavLinks
                />
            </nav>

            {/* Menu Button - Bottom Left */}
            <button
                onClick={() => openMenu(true)}
                className="md:hidden fixed bottom-6 left-6 z-40 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center border-2 border-primary"
                aria-label="Open menu"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <line
                        x1="3"
                        y1="12"
                        x2="21"
                        y2="12"
                    ></line>
                    <line
                        x1="3"
                        y1="6"
                        x2="21"
                        y2="6"
                    ></line>
                    <line
                        x1="3"
                        y1="18"
                        x2="21"
                        y2="18"
                    ></line>
                </svg>
            </button>
        </>
    );
};

// Combined Navigation Component
export const Navigation = () => {
    return (
        <>
            <DesktopNavigation />
            <MobileNavigation />
            <MenuDrawer />
        </>
    );
};

export default Navigation;
