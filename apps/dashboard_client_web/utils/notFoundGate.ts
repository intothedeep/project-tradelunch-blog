import { RESERVED_HANDLE_SEGMENTS } from '@repo/types';
import { KNOWN_TOP_LEVEL_SEGMENTS } from './knownTopLevelSegments';

// Pure path classifier for the proxy 404 gate (cc.design.md §18). Pathname in,
// the kind of page it names out; no I/O. `null` = nothing to check.
export type TGatePath =
    | { kind: 'user'; username: string }
    | { kind: 'project'; username: string; project: string }
    | { kind: 'post'; username: string; slug: string }
    | { kind: 'ownerOnly'; username: string };

// Rewrite target for a missing page. Four segments deep and no `@`, so it
// matches no route and Next answers its default 404 (root not-found.tsx).
export const NOT_FOUND_PATH = '/__nf/__/__/__';

const USER_SEGMENTS = ['posts', 'projects'];
const OWNER_ONLY_SEGMENTS = ['me', 'saved'];
// About and Resume are hard-coded owner content: any other handle is a 404.
const OWNER_CONTENT_SEGMENTS = ['about', 'resume'];
const KNOWN_TOP_LEVEL = new Set<string>(KNOWN_TOP_LEVEL_SEGMENTS);
// Reserved segments with their own page need no existence check.
const RESERVED = new Set<string>(RESERVED_HANDLE_SEGMENTS);

function decodeSegments(pathname: string): string[] | null {
    try {
        return pathname
            .split('/')
            .filter(Boolean)
            .map((s) => decodeURIComponent(s));
    } catch {
        return null;
    }
}

export function classifyGatePath(pathname: string): TGatePath | null {
    const segs = decodeSegments(pathname);
    if (!segs || segs.length < 2 || segs.length > 3) return null;
    const [handle, second, third] = segs as [string, string, string?];
    if (!handle.startsWith('@') || handle.length < 2) return null;
    const username = handle.slice(1);

    if (segs.length === 3) {
        return second === 'projects' && third
            ? { kind: 'project', username, project: third }
            : null;
    }
    if (USER_SEGMENTS.includes(second)) return { kind: 'user', username };
    if (OWNER_ONLY_SEGMENTS.includes(second))
        return { kind: 'ownerOnly', username };
    if (RESERVED.has(second)) return null;
    return { kind: 'post', username, slug: second };
}

// Paths that can only be a 404, decided from the pathname alone (no I/O), so
// the proxy answers before ISR renders them (cc.design.md section 18, S0 and
// candidate A). Two cases: a first segment that is neither `@handle` nor a known
// top-level route, and /@u/about or /@u/resume for a handle that is not the
// owner. `isOwner` is injected to keep this pure. Undecodable paths pass.
export function isUnknownPath(
    pathname: string,
    isOwner: (rawHandle: string) => boolean
): boolean {
    const segs = decodeSegments(pathname);
    if (!segs || segs.length === 0) return false;
    const [first, second] = segs as [string, string?];
    if (!first.startsWith('@')) return !KNOWN_TOP_LEVEL.has(first);
    if (segs.length !== 2 || !second) return false;
    const rawHandle = pathname.split('/').filter(Boolean)[0] as string;
    return OWNER_CONTENT_SEGMENTS.includes(second) && !isOwner(rawHandle);
}

// True when the last segment holds a dot (scanner probes, files). The proxy
// answers these itself: a real file passes, anything else is a 404 (A2).
export const isDottedPath = (pathname: string): boolean =>
    /\.[^/]*$/.test(pathname);
