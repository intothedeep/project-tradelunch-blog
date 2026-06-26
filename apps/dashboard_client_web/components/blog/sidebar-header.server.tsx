import React from 'react';
import clsx from 'clsx';
import { Command } from 'lucide-react';
import { SidebarHeader } from '@/components/ui/sidebar';
import Link from 'next/link';
import { ModeToggle } from '@/components/mode-toggle';

type Props = {
    username: string;
    // Human-readable author name; falls back to the username when absent.
    displayName?: string;
};

export const BlogSidebarheader = ({ username, displayName }: Props) => {
    const name = displayName ?? username;

    return (
        <SidebarHeader>
            <div
                className={clsx('flex justify-between align-middle', 'px-1.5')}
            >
                <div className={clsx('flex gap-2')}>
                    <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                        <Link href="/">
                            <Command className="size-5" />
                        </Link>
                    </div>

                    <span className="truncate font-semibold text-2xl">
                        <Link href={`/blog/@${username}`}>{name}</Link>
                    </span>
                </div>

                <ModeToggle />
            </div>
        </SidebarHeader>
    );
};
