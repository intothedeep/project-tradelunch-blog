import { TPost } from '@/apis/blog.types';
import { MoveBack } from '@/app/blog/components/MoveBack';
import { formatPostDate } from '@/utils/formatPostDate';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

type Props = {
    post: TPost;
    hasBack?: boolean;
};

export const PostContentHeader: React.FC<Props> = ({
    post,
    hasBack = false,
}) => {
    const username = post.username;

    // Graceful byline label: prefer the human-readable display_name, then the
    // username; if neither exists, render no author chip.
    const bylineLabel = post.display_name ?? username;
    const avatarUrl = post.avatar_url;

    return (
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            {hasBack && <MoveBack />}

            {bylineLabel && (
                <span className="flex items-center gap-1">
                    {avatarUrl ? (
                        <Image
                            src={avatarUrl}
                            alt={bylineLabel}
                            width={16}
                            height={16}
                            className="rounded-full"
                        />
                    ) : (
                        <span className="text-primary">👤</span>
                    )}

                    {username ? (
                        // Author byline acts like an action: raised above the
                        // card's overlay link (z-10) and given a clear hover
                        // affordance so it reads as clickable → /blog/@<username>.
                        <Link
                            href={`/blog/@${username}`}
                            aria-label={`View ${bylineLabel}'s blog`}
                            className="relative z-10 font-semibold text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
                        >
                            <span>{bylineLabel.toLocaleUpperCase()}</span>
                        </Link>
                    ) : (
                        <span>{bylineLabel.toLocaleUpperCase()}</span>
                    )}
                </span>
            )}

            {bylineLabel && <span>•</span>}

            <span>{formatPostDate(post.date)}</span>
        </div>
    );
};
