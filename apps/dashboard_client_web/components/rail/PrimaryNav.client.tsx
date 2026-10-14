'use client';

// Purpose: the left-rail primary navigation (Home / All posts / About / Resume /
// Write / Saved / My blog). Links come from usePrimaryNavLinks (which gates auth
// — Write/Saved/My blog hidden while signed out — and hides "My blog" when there
// is no resolved username). Active route is derived
// from usePathname and exposed via aria-current="page". Collapsed vs expanded is pure CSS
// off `<html data-rail>` (label hidden, icon centered), so the markup is identical
// for both states and the first paint is already final (no atom involved).
// Side effects: none beyond reading the current pathname + Clerk user.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    Home,
    Info,
    FileText,
    Newspaper,
    Compass,
    PenSquare,
    Bookmark,
    User,
    MessageSquare,
    Rocket,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrimaryNavLinks } from '@/hooks/useNavLinks.hook';
import { TONE_BG, toneOfNavKey } from '@/utils/section-tone';

export const ICON_BY_KEY: Record<string, LucideIcon> = {
    home: Home,
    allPosts: Newspaper,
    log: MessageSquare,
    about: Info,
    resume: FileText,
    explore: Compass,
    write: PenSquare,
    saved: Bookmark,
    myBlog: User,
    projects: Rocket,
};

// Pure: a link is active when it is the exact path; for non-root links the
// active state also covers nested sub-paths (e.g. /@u/saved/...). The index
// route '/' matches EXACT-only — otherwise it would light up on every page.
export function isActivePath(pathname: string, href: string): boolean {
    if (href === '/') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
}

// Server-rendered badge slots keyed by nav iconKey (e.g. the Projects count).
export type NavBadges = Partial<Record<string, React.ReactNode>>;

const ITEM_BASE =
    'flex items-center gap-3 rounded-none px-3 py-2 text-sm transition-colors in-data-[rail=collapsed]:justify-center';

export const PrimaryNav = ({ navBadges }: { navBadges?: NavBadges }) => {
    const pathname = usePathname();
    const links = usePrimaryNavLinks();
    const t = useTranslations('blog');

    return (
        <nav aria-label="Primary">
            <ul className="flex flex-col gap-1">
                {links.map((link) => {
                    const Icon = link.iconKey
                        ? ICON_BY_KEY[link.iconKey]
                        : undefined;
                    const label = link.labelKey ? t(link.labelKey) : link.title;

                    if (link.disabled) {
                        return (
                            <li key={link.href}>
                                <span
                                    aria-disabled="true"
                                    title={label}
                                    className={cn(
                                        ITEM_BASE,
                                        'cursor-not-allowed text-muted-foreground/50'
                                    )}
                                >
                                    {Icon ? (
                                        <Icon className="h-5 w-5 shrink-0" />
                                    ) : null}
                                    <span className="truncate in-data-[rail=collapsed]:hidden">
                                        {label}
                                    </span>
                                </span>
                            </li>
                        );
                    }

                    const active = isActivePath(pathname, link.href);
                    const tone = toneOfNavKey(link.iconKey);

                    return (
                        <li key={link.href}>
                            <Link
                                href={link.href}
                                aria-current={active ? 'page' : undefined}
                                aria-label={label}
                                title={label}
                                className={cn(
                                    ITEM_BASE,
                                    'relative',
                                    active
                                        ? tone
                                            ? cn(
                                                  TONE_BG[tone],
                                                  'font-medium text-foreground'
                                              )
                                            : 'bg-accent font-medium text-accent-foreground'
                                        : 'text-foreground hover:bg-accent/50'
                                )}
                            >
                                {Icon ? (
                                    <Icon className="h-5 w-5 shrink-0" />
                                ) : null}
                                <span className="truncate in-data-[rail=collapsed]:hidden">
                                    {label}
                                </span>
                                {link.iconKey && navBadges?.[link.iconKey] ? (
                                    // Expanded: number at the row end. Collapsed: a dot
                                    // on the icon corner (number text zeroed, box shrunk).
                                    <span className="ml-auto in-data-[rail=collapsed]:absolute in-data-[rail=collapsed]:top-1.5 in-data-[rail=collapsed]:right-1.5 in-data-[rail=collapsed]:*:size-2 in-data-[rail=collapsed]:*:min-w-0 in-data-[rail=collapsed]:*:p-0 in-data-[rail=collapsed]:*:text-[0px]">
                                        {navBadges[link.iconKey]}
                                    </span>
                                ) : null}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
};

export default PrimaryNav;
