import { RESERVED_HANDLE_SEGMENTS } from '@repo/types';

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

// Signed-in RSC navigation is not checked: the Suspense leaf gates it (200
// not-found view). Documents, and anonymous RSC, are checked here.
export function shouldCheck({
    signedIn,
    isRsc,
}: {
    signedIn: boolean;
    isRsc: boolean;
}): boolean {
    return !signedIn || !isRsc;
}
