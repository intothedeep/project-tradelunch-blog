// Pure: which pastel section tone a route / nav item belongs to (owner trial,
// 2026-10-14). Tokens `--tone-*` live in styles/globals.css. Class names are
// literal strings so Tailwind can see them.
export type SectionTone =
    | 'home'
    | 'projects'
    | 'saved'
    | 'about'
    | 'posts'
    | 'write';

export const TONE_BG: Record<SectionTone, string> = {
    home: 'bg-tone-home',
    projects: 'bg-tone-projects',
    saved: 'bg-tone-saved',
    about: 'bg-tone-about',
    posts: 'bg-tone-posts',
    write: 'bg-tone-write',
};

// Fainter variant for wide surfaces (the top bar): 15% of the tone over the page.
export const TONE_BG_FAINT: Record<SectionTone, string> = {
    home: 'bg-tone-home/15',
    projects: 'bg-tone-projects/15',
    saved: 'bg-tone-saved/15',
    about: 'bg-tone-about/15',
    posts: 'bg-tone-posts/15',
    write: 'bg-tone-write/15',
};

const TONE_BY_HANDLE_SECTION: Record<string, SectionTone> = {
    projects: 'projects',
    saved: 'saved',
    about: 'about',
    resume: 'about',
    posts: 'posts',
};

export function sectionTone(pathname: string): SectionTone | null {
    const [first, section] = pathname.split('/').filter(Boolean);
    if (first === undefined || first === 'tags') return 'home';
    if (first === 'write') return 'write';
    if (!first.startsWith('@') || section === undefined) return null;
    return TONE_BY_HANDLE_SECTION[section] ?? null;
}

// Nav items carry an icon key, not a route; "My blog" (iconKey myBlog) is the
// viewer's posts list.
const TONE_BY_NAV_KEY: Record<string, SectionTone> = {
    home: 'home',
    projects: 'projects',
    saved: 'saved',
    about: 'about',
    resume: 'about',
    myBlog: 'posts',
    write: 'write',
};

export function toneOfNavKey(iconKey: string | undefined): SectionTone | null {
    return iconKey ? (TONE_BY_NAV_KEY[iconKey] ?? null) : null;
}
