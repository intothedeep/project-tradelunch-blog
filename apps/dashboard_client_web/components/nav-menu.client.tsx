'use client';

import Link from 'next/link';
import { SignInButton, useClerk, useUser } from '@clerk/nextjs';
import { CircleUserRound, Menu, Moon, Sun } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useThemeToggle } from '@/hooks/useThemeToggle.hook';
import { useTranslations } from 'next-intl';

type NavLink = { title: string; href: string };

type NavMenuProps = {
    links: NavLink[];
    showNavLinks?: boolean;
    align?: 'start' | 'end';
};

// Shared icon-button style so the trigger matches existing header controls.
const TRIGGER_CLASS =
    'flex h-9 w-9 items-center justify-center border border-transparent hover:border-primary hover:bg-primary hover:text-primary-foreground transition-colors';

// Avatar trigger: circular highlight to match the round avatar. The avatar image
// fills the button, so a background fill is hidden — use a ring instead for the
// hover and open (selected) states.
const AVATAR_TRIGGER_CLASS =
    'flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-background transition-shadow hover:ring-primary data-[state=open]:ring-primary';

// Theme toggle row; keeps the menu open on select so the flip is visible.
function ThemeMenuItem() {
    const { mounted, currentTheme, toggleTheme } = useThemeToggle();

    if (!mounted) {
        return (
            <DropdownMenuItem disabled>
                <Sun />
                <span>Theme</span>
            </DropdownMenuItem>
        );
    }

    const isDark = currentTheme === 'dark';

    return (
        <DropdownMenuItem
            onSelect={(e) => {
                e.preventDefault();
                toggleTheme();
            }}
        >
            {isDark ? <Sun /> : <Moon />}
            <span>{isDark ? 'Light' : 'Dark'}</span>
        </DropdownMenuItem>
    );
}

// Unified header dropdown: theme toggle + auth actions, plus nav links on mobile.
export function NavMenu({
    links,
    showNavLinks = false,
    align = 'end',
}: NavMenuProps) {
    const { isLoaded, isSignedIn, user } = useUser();
    const { openUserProfile, signOut } = useClerk();
    const t = useTranslations('write');

    if (!isLoaded)
        return (
            <div
                className="w-9 h-9"
                aria-hidden
            />
        );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {isSignedIn ? (
                    <button
                        className={AVATAR_TRIGGER_CLASS}
                        aria-label="Account menu"
                    >
                        <Avatar className="h-9 w-9">
                            <AvatarImage
                                src={user.imageUrl}
                                alt=""
                            />
                            <AvatarFallback>
                                <CircleUserRound className="h-6 w-6" />
                            </AvatarFallback>
                        </Avatar>
                        <span className="sr-only">Account menu</span>
                    </button>
                ) : (
                    <button
                        className={TRIGGER_CLASS}
                        aria-label="Open menu"
                    >
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Open menu</span>
                    </button>
                )}
            </DropdownMenuTrigger>

            <DropdownMenuContent align={align}>
                {showNavLinks && (
                    <>
                        <DropdownMenuGroup>
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
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                    </>
                )}

                <ThemeMenuItem />

                <DropdownMenuSeparator />

                {isSignedIn ? (
                    <>
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                                <Link href="/write">{t('nav.write')}</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/me">{t('nav.myDrafts')}</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/me/saved">{t('nav.saved')}</Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => openUserProfile()}>
                            Manage account
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => signOut()}>
                            Sign out
                        </DropdownMenuItem>
                    </>
                ) : (
                    <SignInButton mode="modal">
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            Sign in
                        </DropdownMenuItem>
                    </SignInButton>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
