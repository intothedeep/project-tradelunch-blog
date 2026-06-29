// app/api/posts/load-more/route.ts
import { NextResponse } from 'next/server';
import { getBlogPostsByUsername } from '@/apis/getPosts.api';
import { getPostsByTag } from '@/apis/getPostsByTag.api';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Number(searchParams.get('limit')) || 10;
    // Empty username => all-authors global feed (GET /v1/api/posts), used by the
    // homepage. A real username scopes to that author (/v1/api/posts/users/:u).
    const username = searchParams.get('username') ?? '';
    // Non-empty tag => global by-tag feed; takes precedence over username. cursor
    // stays a STRING end-to-end (never Number()'d).
    const tag = searchParams.get('tag') ?? '';
    // Optional category-title filter for the per-author feed (categories are
    // per-author); carried through so paginated pages keep the same filter.
    const categoryTitle = searchParams.get('category_title') ?? undefined;

    try {
        if (tag) {
            const data = await getPostsByTag(tag, cursor, limit);
            return NextResponse.json(data);
        }

        const data = await getBlogPostsByUsername(
            cursor,
            limit,
            username,
            categoryTitle
        );
        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { error: 'Failed to load posts' },
            { status: 500 }
        );
    }
}
