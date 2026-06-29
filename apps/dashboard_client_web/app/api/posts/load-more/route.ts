// app/api/posts/load-more/route.ts
import { NextResponse } from 'next/server';
import { getBlogPostsByUsername } from '@/apis/getPosts.api';
import { getPostsByTag } from '@/apis/getPostsByTag.api';

// Split a comma-joined facet param into a trimmed, empty-dropped string[].
// Canonicalization (lowercase/dedupe/sort/cap) is the server's job — here we
// only thread the raw selection through to the action.
function splitFacet(raw: string | null): string[] {
    if (!raw) return [];
    return raw
        .split(',')
        .map((seg) => seg.trim())
        .filter((seg) => seg.length > 0);
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Number(searchParams.get('limit')) || 10;
    // Empty username => all-authors global feed (GET /v1/api/posts), used by the
    // homepage. A real username scopes to that author (/v1/api/posts/users/:u).
    const username = searchParams.get('username') ?? '';
    // Non-empty tag => global by-tag feed; takes precedence over username. cursor
    // stays a STRING end-to-end (never Number()'d). This is the singular
    // /tags/[tag] branch — left untouched by the multi-facet filter.
    const tag = searchParams.get('tag') ?? '';
    // Multi-facet feed filter for the per-author feed: categories OR
    // (ancestor-inclusive), tags OR, cross-attribute AND — resolved server-side.
    // Carried through so paginated pages keep the same filter.
    // Legacy single `category_title` is a FALLBACK for `categories` (precedence,
    // mirroring `parseFilterState` + the Express `??` handler) so paginated pages
    // resolve the same filter the initial SSR render did — plural wins when present.
    const categoriesParam = splitFacet(searchParams.get('categories'));
    const categories =
        categoriesParam.length > 0
            ? categoriesParam
            : splitFacet(searchParams.get('category_title'));
    const tags = splitFacet(searchParams.get('tags'));

    try {
        if (tag) {
            const data = await getPostsByTag(tag, cursor, limit);
            return NextResponse.json(data);
        }

        const data = await getBlogPostsByUsername(cursor, limit, username, {
            categories,
            tags,
        });
        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { error: 'Failed to load posts' },
            { status: 500 }
        );
    }
}
