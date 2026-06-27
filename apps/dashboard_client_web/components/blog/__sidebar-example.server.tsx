import React from 'react';

import { ChevronRight, File, Folder } from 'lucide-react';

import { AudioWaveform, Command } from 'lucide-react';

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
} from '@/components/ui/sidebar';
import Link from 'next/link';

const data = {
    teams: [
        {
            name: 'Acme Inc',
            logo: Command,
            plan: 'Enterprise',
        },
        {
            name: 'Acme Corp.',
            logo: AudioWaveform,
            plan: 'Startup',
        },
        {
            name: 'Evil Corp.',
            logo: Command,
            plan: 'Free',
        },
    ],
    headers: [
        {
            file: 'ABOUT',
            href: 'about',
            // state: 'M',
        },
        {
            file: 'BLOG',
            href: '',
            // state: 'M',
        },
        {
            file: 'PROJECTS',
            href: 'projects',

            // state: 'U',
        },
        {
            file: 'RESUME',
            href: 'resume',
            // state: 'M',
        },
    ],
    tree: [
        [
            'app',
            [
                'api',
                ['hello', ['route.ts']],
                ['blog', ['page.tsx']],
                'page.tsx',
                'layout.tsx',
            ],
        ],
        [
            'components',
            ['ui', 'button.tsx', 'card.tsx'],
            'header.tsx',
            'footer.tsx',
        ],
        ['lib', ['util.ts']],
        ['public', 'favicon.ico', 'vercel.svg'],
        '.eslintrc.json',
        '.gitignore',
        'next.config.js',
        'tailwind.config.js',
        'package.json',
        'README.md',
    ],
};

type Props = {
    username: string;
};

export default function SidebarNav({ username }: Props) {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>DASHBOARD</SidebarGroupLabel>

            <SidebarGroupContent>
                <SidebarMenu>
                    {data.headers.map((item, index) => (
                        <SidebarMenuItem key={index}>
                            <Link href={`/blog/@${username}/${item.href}`}>
                                <SidebarMenuButton>
                                    <File />
                                    {item.file}
                                </SidebarMenuButton>
                            </Link>

                            {/* <SidebarMenuBadge>
                                        {item.state}
                                    </SidebarMenuBadge> */}
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>

            {/* <SidebarGroup>
                    <SidebarGroupLabel>Files</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {data.tree.map((item, index) => (
                                <Tree
                                    key={index}
                                    item={item}
                                />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup> */}
        </SidebarGroup>
    );
}

type TreeItem = string | TreeItem[];

function Tree({ item }: { item: TreeItem }) {
    const [name, ...items] = Array.isArray(item) ? item : [item];
    // console.log('TREE ITEM:', item, name, items);

    if (!items.length) {
        return (
            <SidebarMenuButton
                isActive={name === 'button.tsx'}
                className="data-[active=true]:bg-transparent"
            >
                <File />
                {name}
            </SidebarMenuButton>
        );
    }

    return (
        <SidebarMenuItem>
            <Collapsible
                className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
                defaultOpen={name === 'components' || name === 'ui'}
            >
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                        <ChevronRight className="transition-transform" />
                        <Folder />
                        {name}
                    </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <SidebarMenuSub>
                        {items.map((subItem, index) => (
                            <Tree
                                key={index}
                                item={subItem}
                            />
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
        </SidebarMenuItem>
    );
}
