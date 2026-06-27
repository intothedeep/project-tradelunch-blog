// app/api/posts/load-more/route.ts
import { NextResponse } from 'next/server';
import { getBlogPostsByUsername } from '@/apis/getPosts.api';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Number(searchParams.get('limit')) || 10;
    const username = searchParams.get('username') || '';

    if (!username)
        return NextResponse.json(
            { error: 'username required' },
            { status: 400 }
        );

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
