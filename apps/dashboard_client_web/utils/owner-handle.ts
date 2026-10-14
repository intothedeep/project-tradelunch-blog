import { HOME_FEED_AUTHOR, stripUsernameAt } from '@/utils/blog-author';

// True when the route's `[handle]` segment is the site owner. About and Resume
// are hard-coded owner content (PJ-2-01), so any other handle is a 404. The
// segment is decoded first so `%40taeklim` equals `@taeklim`. An empty owner
// (HOME_FEED_AUTHOR unset) matches nobody.
export function isOwnerHandle(rawHandle: string): boolean {
    if (!HOME_FEED_AUTHOR) return false;
    return stripUsernameAt(decodeURIComponent(rawHandle)) === HOME_FEED_AUTHOR;
}
