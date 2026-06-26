'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { ModeToggle } from '@/components/mode-toggle';
import { AuthButton } from '@/components/auth-button';
import { DEFAULT_BLOG_AUTHOR } from '@/utils/blog-author';

type NavLink = { title: string; href: string };

// Build the nav links for a given blog author username.
const buildLinks = (blogUsername: string): NavLink[] => [
    { title: 'About', href: '/' },
    { title: 'blog', href: `/blog/@${blogUsername}` },
    { title: 'dashboard', href: '/dashboard' },
    // { title: 'projects', href: '/projects' },
    { title: 'resume', href: '/resume' },
];

// Resolve the blog author username from the (optionally signed-in) Clerk user,
// falling back to the site default author.
const useBlogUsername = (): string => {
    const { user } = useUser();
    return user?.username ?? DEFAULT_BLOG_AUTHOR;
};

// Desktop Navigation with Terminal Style
export const DesktopNavigation = () => {
    const blogUsername = useBlogUsername();
    const links = buildLinks(blogUsername);

    return (
        <nav className="hidden md:flex h-16 items-center justify-between border-b-2 border-primary bg-background/95 backdrop-blur px-6">
            {/* Left - Theme + Auth controls, then Logo */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <ModeToggle />
                    <AuthButton signInClassName="px-4 py-2 font-mono text-sm hover:bg-primary hover:text-primary-foreground transition-colors border border-transparent hover:border-primary" />
                </div>
                <Link
                    href="/"
                    className="flex items-center gap-3 group"
                >
                    {/* Profile Icon */}
                    <div className="w-10 h-10 border-2 border-primary bg-secondary flex items-center justify-center transition-all group-hover:scale-110">
                        <span className="text-2xl">👨‍💻</span>
                    </div>
                    {/* Name */}
                    <span className="text-2xl font-mono text-primary terminal-glow">
                        Taek Lim
                    </span>
                </Link>
            </div>

            {/* Right - Navigation Links */}
            <ul className="flex flex-row gap-1 items-center">
                {links.map((link) => (
                    <li key={link.title}>
                        <Link
                            href={link.href}
                            className="px-4 py-2 font-mono text-sm hover:bg-primary hover:text-primary-foreground transition-colors border border-transparent hover:border-primary"
                        >
                            {link.title.toUpperCase()}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

// Mobile Navigation with Bottom Drawer
export const MobileNavigation = () => {
    const blogUsername = useBlogUsername();
    const links = buildLinks(blogUsername);

    const [isOpen, setIsOpen] = useState(false);
    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Handle swipe down to close
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart(e.targetTouches[0]?.clientY ?? 0);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0]?.clientY ?? 0);
    };

    const handleTouchEnd = () => {
        if (touchStart - touchEnd < -50) {
            // Swiped down
            setIsOpen(false);
        }
    };

    return (
        <>
            {/* Mobile Header Bar */}
            <nav className="md:hidden flex h-14 items-center justify-start gap-3 border-b-2 border-primary bg-background/95 backdrop-blur px-4">
                <div className="flex items-center gap-2">
                    <ModeToggle />
                    <AuthButton signInClassName="px-3 py-1 font-mono text-xs border border-primary/50 hover:border-primary transition-colors" />
                </div>
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
            </nav>

            {/* Menu Button - Bottom Left */}
            <button
                onClick={() => setIsOpen(true)}
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

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 md:hidden animate-in fade-in"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Mobile Menu Drawer - Slides from Bottom */}
            <div
                className={`fixed bottom-0 left-0 right-0 bg-card border-t-2 border-primary z-50 md:hidden transition-transform duration-300 ease-out ${
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
                        <div className="w-10 h-10 border-2 border-primary bg-secondary flex items-center justify-center">
                            <span className="text-2xl">👨‍💻</span>
                        </div>
                        <span className="text-xl font-mono text-primary terminal-glow">
                            MENU
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

                {/* Navigation Links */}
                <nav className="p-6 max-h-[70vh] overflow-y-auto">
                    <ul className="space-y-2">
                        {links.map((link, index) => (
                            <li key={link.title}>
                                <Link
                                    href={link.href}
                                    onClick={() => setIsOpen(false)}
                                    className="block px-4 py-4 font-mono text-lg border-2 border-primary/30 hover:border-primary hover:bg-secondary transition-all"
                                    style={{
                                        animationDelay: `${index * 50}ms`,
                                        animation: isOpen
                                            ? 'slideInUp 0.3s ease-out forwards'
                                            : 'none',
                                    }}
                                >
                                    <span className="text-primary">&gt;</span>{' '}
                                    {link.title.toUpperCase()}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {/* Additional Info */}
                    <div className="mt-6 p-4 border-2 border-primary/30 bg-secondary/50">
                        <div className="text-sm font-mono text-muted-foreground space-y-1">
                            {/* <p>&gt; 660-238-5036</p> */}
                            <p>&gt; TIO.TAEK.LIM@GMAIL.COM</p>
                            <p>&gt; GITHUB: tradelunch</p>
                            <p>&gt; LINKEDIN: tiotaeklim</p>
                            <p>&gt; WARRENSBURG, MO 64093 USA</p>
                        </div>
                    </div>
                </nav>
            </div>
        </>
    );
};

// Combined Navigation Component
export const Navigation = () => {
    return (
        <>
            <DesktopNavigation />
            <MobileNavigation />
        </>
    );
};

export default Navigation;
