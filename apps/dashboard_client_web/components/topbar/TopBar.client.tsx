'use client';

// Purpose: the single global desktop top bar contents — logo, the "MARKETS"
// nav dropdown (dashboard / SEC 13F funds / marketcap rankings), tag SearchBar,
// and the shared theme/auth NavMenu. "Write" lives in the left-rail primary nav,
// so it is not duplicated here. Mounted once by DesktopNavigation (which guards
// the chart-dashboard routes), so there is exactly one bar on /, /blog/*, /tags/*.

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NavMenu } from '@/components/nav-menu.client';
import { SearchBar } from '@/components/topbar/SearchBar.client';
import { useNavLinks } from '@/hooks/useNavLinks.hook';

export const TopBar = () => {
    const links = useNavLinks();

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

            {/* Right - Markets dropdown, search, then theme + auth */}
            <div className="flex items-center gap-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="flex items-center gap-2 px-4 py-2 font-mono text-sm border border-transparent hover:bg-primary hover:text-primary-foreground hover:border-primary data-[state=open]:bg-primary data-[state=open]:text-primary-foreground data-[state=open]:border-primary transition-colors"
                        >
                            MARKETS
                            <ChevronDown className="h-4 w-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {links.map((link) => (
                            <DropdownMenuItem
                                key={link.title}
                                asChild
                            >
                                <Link href={link.href}>
                                    {link.title.toUpperCase()}
                                </Link>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                <SearchBar />
                <NavMenu links={links} />
            </div>
        </nav>
    );
};

export default TopBar;
