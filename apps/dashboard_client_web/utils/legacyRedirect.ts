import { aboutPath, resumePath } from './routes';

// Old author URLs (/blog/(at)u/..., /blog/%40u/..., /blog/u/...) and the owner
// pages (/about, /resume) move to /(at)u/... (Phase PJ). Pure: pathname in, new
// pathname out, null when the path is not a legacy one. Lived in next.config
// `redirects()` until 2026-10-13, but Next drops `headers()` on those
// responses (resolve-routes.js returns `resHeaders: null` for a redirect), so
// they could not carry a Cache-Control. proxy.ts now answers them.
const BLOG_PATH = /^\/blog\/([^/]+)(?:\/([^/]+))?(?:\/(opengraph-image))?\/?$/;

export function legacyRedirectPath(
    pathname: string,
    owner: string
): string | null {
    if (pathname === '/blog' || pathname === '/blog/') return '/';
    if (owner && (pathname === '/about' || pathname === '/about/'))
        return aboutPath(owner);
    if (owner && (pathname === '/resume' || pathname === '/resume/'))
        return resumePath(owner);

    const m = BLOG_PATH.exec(pathname);
    if (!m) return null;
    const who = m[1] as string;
    const slug = m[2];
    const og = m[3];
    // `opengraph-image` is only a suffix after a slug: /blog/(at)u/opengraph-image
    // is the slug rule, as it was in next.config. The regex gives it to `slug`.
    let handle: string;
    if (who.startsWith('@')) handle = who;
    else if (who.startsWith('%40')) handle = `@${who.slice(3)}`;
    else if (who.startsWith('%'))
        return null; // only %40 is an encoded '@'
    else handle = `@${who}`;
    if (handle.length < 2) return null;

    if (!slug) return `/${handle}/posts`;
    return og ? `/${handle}/${slug}/${og}` : `/${handle}/${slug}`;
}
