// URL-segment contract under /@<handle>/. Static folders there win over the
// dynamic [slug] route, so a post whose slug equals one of these names could
// never be opened. Write paths (Express, blog_agent) reject them.
// Python mirror: apps/blog_agent/configs/routes.py — keep both lists identical.

export const RESERVED_HANDLE_SEGMENTS = [
    'posts',
    'projects',
    'about',
    'resume',
    'saved',
    'me',
    'logs',
] as const;

// Title of the category whose direct children are the user's projects.
export const PROJECTS_ROOT_CATEGORY_TITLE = 'projects';

export function isReservedSlug(slug: string): boolean {
    const normalized = slug.trim().toLowerCase();
    return (RESERVED_HANDLE_SEGMENTS as readonly string[]).includes(normalized);
}
