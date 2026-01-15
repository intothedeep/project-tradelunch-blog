import axios from '@repo/axios';

import { getTranslations } from 'next-intl/server';

import clsx from 'clsx';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer.server';
import PostContent from '@/components/blog/PostContent.server';
import { Suspense } from 'react';

type Props = {
    params: Promise<{
        slug: string;
        username: string;
    }>;
};

export default async function BlogDetailPage({ params }: Props) {
    const { slug, username } = await params;

    const decodedUsername = decodeURIComponent(username ?? '').substring(1);
    console.log('username:', decodedUsername, slug);

    return (
        <section
            className={clsx(
                'blog-username-slug'
                // 'w-full xl:max-w-2xl ',
                // 'p-4',
                // 'text-sm',
                // 'bg-background',
                // 'border border-primary rounded-xl'
            )}
        >
            <PostContent slug={slug} />
        </section>
    );
}
