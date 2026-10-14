import type { Metadata } from 'next';
import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import clsx from 'clsx';
import { getPostBySlug } from '@/apis/getPost.api';
import PostContent from '@/components/blog/PostContent.server';
import { PostContentCard } from '@/components/blog/PostContentCard.server';
import { PostContentToc } from '@/components/blog/PostContentToc.server';
import { PostCardSkeleton } from '@/components/blog/PostCardSkeleton';
import { MobileToc } from '@/components/blog/MobileToc.client';
import { PostJsonLd } from '@/components/projects/PostJsonLd.server';
import { ProjectsMobileMenu } from '@/components/projects/ProjectsMobileMenu.server';
import { getProjectsTree } from '@/apis/getProjectsTree.api';
import { stripUsernameAt } from '@/utils/blog-author';
import { buildDescription } from '@/utils/post-description';

type Props = {
    params: Promise<{
        slug: string;
        handle: string;
    }>;
};

// No dynamic request reads here (design §7.3): metadata is built from the public post, so a
// private post gets the generic title for its owner too (Q11). The token-aware
// read lives in the PostJsonLd and PostContent leaves.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, handle } = await params;
    const author = stripUsernameAt(decodeURIComponent(handle));
    const canonicalPath = `/@${author}/${slug}`;

    try {
        const post = await getPostBySlug(slug, null);
        const title = post.title as string;
        const description = buildDescription(post);
        // Only pass stored_uri as an explicit override — when absent, Next.js
        // auto-injects the colocated opengraph-image.tsx dynamic OG card.
        // Including a fallback here would create duplicate og:image tags.
        const storedImage = post.stored_uri as string | undefined;
        const authorName = (post.display_name as string | undefined) ?? author;

        return {
            title,
            description,
            alternates: { canonical: canonicalPath },
            openGraph: {
                type: 'article',
                title,
                description,
                url: canonicalPath,
                ...(storedImage ? { images: [storedImage] } : {}),
                publishedTime: post.created_at as string | undefined,
                modifiedTime: post.updated_at as string | undefined,
                authors: [authorName],
            },
            twitter: {
                card: 'summary_large_image',
                title,
                description,
            },
        };
    } catch (error) {
        unstable_rethrow(error);
        return { title: 'Post' };
    }
}

export default async function PostDetailPage({ params }: Props) {
    const { slug, handle } = await params;
    const ownerUsername = stripUsernameAt(decodeURIComponent(handle));
    // Same anonymous tree read as the layout (cache() dedupes it); see the
    // layout for why a failed read means "not a project post".
    const { projectOfSlug } = await getProjectsTree(ownerUsername, null).catch(
        (error) => {
            unstable_rethrow(error);
            return { projectOfSlug: {} as Record<string, string> };
        }
    );
    const isProjectPost = Boolean(projectOfSlug[decodeURIComponent(slug)]);

    return (
        <section className={clsx('blog-username-slug')}>
            <Suspense fallback={null}>
                <PostJsonLd
                    slug={slug}
                    author={ownerUsername}
                />
            </Suspense>
            {isProjectPost ? (
                // PostContent minus its built-in MobileToc, so the < lg order is
                // TOC first, then the projects tree, then the post (#74).
                <div>
                    <div className="mb-3 lg:hidden">
                        <MobileToc />
                    </div>
                    <ProjectsMobileMenu username={ownerUsername} />
                    <Suspense fallback={<PostCardSkeleton />}>
                        <PostContentCard
                            slug={slug}
                            ownerUsername={ownerUsername}
                        />
                    </Suspense>
                    <Suspense fallback={null}>
                        <PostContentToc slug={slug} />
                    </Suspense>
                </div>
            ) : (
                <PostContent
                    slug={slug}
                    ownerUsername={ownerUsername}
                />
            )}
        </section>
    );
}
