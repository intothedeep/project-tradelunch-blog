'use client';

// Purpose: the single global desktop top bar contents — logo, tag search, and
// the shared theme/auth NavMenu. Search is collapsed to an icon + ⌘K trigger;
// activating it (click or ⌘K / Ctrl+K) swaps the whole bar for a full-width
// input. "Write" lives in the left-rail primary nav, so it is not duplicated
// here. Mounted once by DesktopNavigation, so there is exactly one bar on
// /, /blog/*, /tags/*.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { TONE_BG, sectionTone } from '@/utils/section-tone';
import { NavMenu } from '@/components/nav-menu.client';
import { SearchBar } from '@/components/topbar/SearchBar.client';
import { SearchTrigger } from '@/components/topbar/SearchTrigger.client';
import {
    isEditableTarget,
    isSearchHotkey,
} from '@/components/topbar/searchHotkey.util';

const NAV_BASE =
    'hidden md:flex h-16 items-center justify-between border-b-2 border-primary backdrop-blur px-6';

export const TopBar = () => {
    // The header takes the tone of the section chosen in the menu (owner,
    // 2026-10-14); pages without a section keep the plain background.
    const tone = sectionTone(usePathname());
    const NAV_CLASS = cn(NAV_BASE, tone ? TONE_BG[tone] : 'bg-background/95');
    const [searchOpen, setSearchOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const returnFocusRef = useRef(false);

    const closeSearch = useCallback((returnFocus: boolean) => {
        returnFocusRef.current = returnFocus;
        setSearchOpen(false);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isSearchHotkey(event) || isEditableTarget(event.target))
                return;
            event.preventDefault();
            setSearchOpen(true);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // The trigger remounts on close, so focus is restored after the commit.
    useEffect(() => {
        if (!searchOpen && returnFocusRef.current) {
            returnFocusRef.current = false;
            triggerRef.current?.focus();
        }
    }, [searchOpen]);

    if (searchOpen) {
        return (
            <nav className={NAV_CLASS}>
                <SearchBar onClose={closeSearch} />
            </nav>
        );
    }

    return (
        <nav className={NAV_CLASS}>
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

            {/* Right - search trigger, then theme + auth */}
            <div className="flex items-center gap-4">
                <SearchTrigger
                    ref={triggerRef}
                    expanded={searchOpen}
                    onOpen={() => setSearchOpen(true)}
                />
                <NavMenu />
            </div>
        </nav>
    );
};

export default TopBar;
