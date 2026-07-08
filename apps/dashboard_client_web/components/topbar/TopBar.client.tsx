'use client';

// Purpose: the single global desktop top bar contents — logo, tag SearchBar, and
// the shared theme/auth NavMenu. "Write" lives in the left-rail primary nav, so
// it is not duplicated here. Mounted once by DesktopNavigation, so there is
// exactly one bar on /, /blog/*, /tags/*.

import Link from 'next/link';
import { NavMenu } from '@/components/nav-menu.client';
import { SearchBar } from '@/components/topbar/SearchBar.client';

export const TopBar = () => {
    return (
        <nav className="hidden md:flex h-16 items-center justify-between border-b-2 border-primary bg-background/95 backdrop-blur px-6">
            {/* Left - Logo */}
            <Link
                href="/"
                className="flex items-center gap-3 group"
            >
                <div className="w-10 h-10 border-2 border-primary bg-secondary flex items-center justify-center transition-all group-hover:scale-110">
                    <span className="text-2xl">👨‍💻</span>
                </div>
                <span className="text-2xl font-mono text-primary terminal-glow">
                    Taek Lim
                </span>
            </Link>

            {/* Right - search, then theme + auth */}
            <div className="flex items-center gap-4">
                <SearchBar />
                <NavMenu />
            </div>
        </nav>
    );
};

export default TopBar;
