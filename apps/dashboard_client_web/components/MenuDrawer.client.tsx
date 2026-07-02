'use client';

// Purpose: shared slide-up modal menu (mobile + desktop dashboard). Open state
// lives in isMenuDrawerOpenAtom so any trigger opens the same menu. At <md the
// desktop left rail is hidden, so this drawer is where the PRIMARY nav (Home /
// Write / Saved / My blog) stays reachable — its link source is
// usePrimaryNavLinks (auth-gated; "My blog" hidden until onboarded).
// When the current page contributes a secondary menu (pageMenuAtom), the drawer
// opens onto a chooser (site menu vs the page menu) instead of the site nav.
// Side effects (escape key, body scroll lock, focus trap) are isolated here.

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import { isMenuDrawerOpenAtom, pageMenuAtom } from '@/store/menu.atom';
import { usePrimaryNavLinks } from '@/hooks/useNavLinks.hook';

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

// Which panel the drawer shows: the chooser root, the site nav, or the
// page-contributed menu. 'root' collapses to the site nav when no page menu.
type DrawerView = 'root' | 'site' | 'page';

export function MenuDrawer() {
    const [isOpen, setIsOpen] = useAtom(isMenuDrawerOpenAtom);
    const pageMenu = useAtomValue(pageMenuAtom);
    const links = usePrimaryNavLinks();
    const t = useTranslations('blog');

    const drawerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLElement | null>(null);

    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);

    // Every open resets to the chooser (or, with no page menu, the site nav).
    const [view, setView] = useState<DrawerView>('root');
    useEffect(() => {
        if (isOpen) setView('root');
    }, [isOpen]);

    // Close on Escape; lock body scroll; trap Tab focus within the drawer; and
    // restore focus to the trigger on close.
    useEffect(() => {
        if (!isOpen) return;

        triggerRef.current = document.activeElement as HTMLElement | null;
        document.body.style.overflow = 'hidden';

        const getFocusable = (): HTMLElement[] =>
            Array.from(
                drawerRef.current?.querySelectorAll<HTMLElement>(
                    FOCUSABLE_SELECTOR
                ) ?? []
            );

        getFocusable()[0]?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                return;
            }
            if (e.key !== 'Tab') return;

            const focusable = getFocusable();
            if (focusable.length === 0) return;

            const first = focusable[0]!;
            const last = focusable[focusable.length - 1]!;
            const active = document.activeElement;

            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
            triggerRef.current?.focus?.();
        };
    }, [isOpen, setIsOpen]);

    // Swipe down to close.
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart(e.targetTouches[0]?.clientY ?? 0);
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0]?.clientY ?? 0);
    };
    const handleTouchEnd = () => {
        if (touchStart - touchEnd < -50) setIsOpen(false);
    };

    const showChooser = pageMenu !== null && view === 'root';
    const showSite = pageMenu === null || view === 'site';
    const canGoBack = pageMenu !== null && view !== 'root';
    const title =
        pageMenu !== null && view === 'page'
            ? pageMenu.label.toUpperCase()
            : 'MENU';

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 animate-in fade-in"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Drawer - slides from bottom */}
            <div
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                className={`fixed bottom-0 left-0 right-0 bg-card border-t-2 border-primary z-50 transition-transform duration-300 ease-out ${
                    isOpen ? 'translate-y-0' : 'translate-y-full'
                }`}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Swipe Handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1 bg-primary/50 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-primary/30">
                    <div className="flex items-center gap-3">
                        {canGoBack ? (
                            <button
                                onClick={() => setView('root')}
                                className="w-10 h-10 flex items-center justify-center hover:bg-secondary transition-colors border border-primary"
                                aria-label="Back to menu chooser"
                            >
                                <ChevronLeft className="size-5 text-primary" />
                            </button>
                        ) : (
                            <div className="w-10 h-10 border-2 border-primary bg-secondary flex items-center justify-center">
                                <span className="text-2xl">👨‍💻</span>
                            </div>
                        )}
                        <span className="text-xl font-mono text-primary terminal-glow">
                            {title}
                        </span>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-10 h-10 flex items-center justify-center hover:bg-secondary transition-colors border border-primary"
                        aria-label="Close menu"
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
                                x1="18"
                                y1="6"
                                x2="6"
                                y2="18"
                            ></line>
                            <line
                                x1="6"
                                y1="6"
                                x2="18"
                                y2="18"
                            ></line>
                        </svg>
                    </button>
                </div>

                {/* Chooser — shown only when the page contributes its own menu. */}
                {showChooser && (
                    <nav className="p-6 space-y-3">
                        <ChooserButton
                            label="SITE MENU"
                            onClick={() => setView('site')}
                        />
                        <ChooserButton
                            label={pageMenu!.label.toUpperCase()}
                            onClick={() => setView('page')}
                        />
                    </nav>
                )}

                {/* Site nav — primary nav set (reachable at <md). */}
                {showSite && (
                    <SiteMenuBody
                        links={links}
                        t={t}
                        isOpen={isOpen}
                        onNavigate={() => setIsOpen(false)}
                    />
                )}

                {/* Page-contributed menu (e.g. fund list); tap navigates + closes. */}
                {pageMenu !== null && view === 'page' && (
                    <div
                        className="p-6 max-h-[70vh] overflow-y-auto"
                        onClick={() => setIsOpen(false)}
                    >
                        {pageMenu.content}
                    </div>
                )}
            </div>
        </>
    );
}

// A single chooser entry, styled to match the terminal nav rows.
function ChooserButton({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="block w-full px-4 py-4 text-left font-mono text-lg border-2 border-primary/30 hover:border-primary hover:bg-secondary transition-all"
        >
            <span className="text-primary">&gt;</span> {label}
        </button>
    );
}

type NavLink = ReturnType<typeof usePrimaryNavLinks>[number];

// The site's primary nav links + contact info block.
function SiteMenuBody({
    links,
    t,
    isOpen,
    onNavigate,
}: {
    links: NavLink[];
    t: ReturnType<typeof useTranslations>;
    isOpen: boolean;
    onNavigate: () => void;
}) {
    return (
        <nav className="p-6 max-h-[70vh] overflow-y-auto">
            <ul className="space-y-2">
                {links.map((link, index) => {
                    const label = link.labelKey ? t(link.labelKey) : link.title;
                    const itemStyle: React.CSSProperties = {
                        animationDelay: `${index * 50}ms`,
                        animation: isOpen
                            ? 'slideInUp 0.3s ease-out forwards'
                            : 'none',
                    };

                    if (link.disabled) {
                        return (
                            <li key={link.href}>
                                <span
                                    aria-disabled="true"
                                    className="block px-4 py-4 font-mono text-lg border-2 border-primary/20 text-muted-foreground cursor-not-allowed"
                                    style={itemStyle}
                                >
                                    <span className="text-primary">&gt;</span>{' '}
                                    {label.toUpperCase()}
                                </span>
                            </li>
                        );
                    }

                    return (
                        <li key={link.href}>
                            <Link
                                href={link.href}
                                onClick={onNavigate}
                                className="block px-4 py-4 font-mono text-lg border-2 border-primary/30 hover:border-primary hover:bg-secondary transition-all"
                                style={itemStyle}
                            >
                                <span className="text-primary">&gt;</span>{' '}
                                {label.toUpperCase()}
                            </Link>
                        </li>
                    );
                })}
            </ul>

            {/* Additional Info */}
            <div className="mt-6 p-4 border-2 border-primary/30 bg-secondary/50">
                <div className="text-sm font-mono text-muted-foreground space-y-1">
                    <p>&gt; TIO.TAEK.LIM@GMAIL.COM</p>
                    <p>&gt; GITHUB: tradelunch</p>
                    <p>&gt; LINKEDIN: tiotaeklim</p>
                    <p>&gt; WARRENSBURG, MO 64093 USA</p>
                </div>
            </div>
        </nav>
    );
}

export default MenuDrawer;
