import Link from 'next/link';
import type { TProjectPost } from '@repo/types';
import { ProjectThumbnail } from '@/app/[handle]/components/ProjectThumbnail.server';
import { postPath } from '@/utils/routes';

type Props = { username: string; posts: TProjectPost[] };

// Rows keep the order they arrive in (priority ASC, seq ASC, #73); the number
// is the position in that order, not a stored value.
export const ProjectPostList = ({ username, posts }: Props) => {
    return (
        <ol className="flex flex-col gap-3">
            {posts.map((post, index) => (
                <li key={post.id}>
                    <Link
                        href={postPath(username, post.slug)}
                        prefetch={false}
                        className="flex items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-secondary"
                    >
                        <span className="w-6 shrink-0 text-sm text-muted-foreground">
                            {index + 1}
                        </span>
                        <ProjectThumbnail
                            storedUri={post.stored_uri}
                            alt={post.title}
                            className="aspect-video w-24 shrink-0 rounded-sm"
                        />
                        <span className="flex min-w-0 flex-col gap-1">
                            <span className="text-sm font-bold">
                                {post.title}
                            </span>
                            {post.description ? (
                                <span className="line-clamp-2 text-xs text-muted-foreground">
                                    {post.description}
                                </span>
                            ) : null}
                        </span>
                    </Link>
                </li>
            ))}
        </ol>
    );
};

export default ProjectPostList;
