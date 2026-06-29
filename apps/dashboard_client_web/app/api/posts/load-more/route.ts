// app/api/posts/load-more/route.ts
import { NextResponse } from 'next/server';
import { getBlogPostsByUsername } from '@/apis/getPosts.api';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Number(searchParams.get('limit')) || 10;
    // Empty username => all-authors global feed (GET /v1/api/posts), used by the
    // homepage. A real username scopes to that author (/v1/api/posts/users/:u).
    const username = searchParams.get('username') ?? '';

    try {
        const data = await getBlogPostsByUsername(cursor, limit, username);

        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { error: 'Failed to load posts' },
            { status: 500 }
        );
    }
}
