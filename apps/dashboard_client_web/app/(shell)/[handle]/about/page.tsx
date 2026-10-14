import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import TerminalProfile from '@/app/MainPage';
import { JsonLd } from '@/components/seo/JsonLd.server';
import { buildProfilePageLd } from '@/lib/jsonld';
import { HOME_FEED_AUTHOR } from '@/utils/blog-author';
import { isOwnerHandle } from '@/utils/owner-handle';
import { aboutPath } from '@/utils/routes';

// `/@<owner>/about` is the career/portfolio page (experience · projects · open
// source · skills · education). Content is hard-coded for the owner (PJ-2-01
// minimal option); any other handle is a 404. `/about` redirects here.
export const metadata: Metadata = {
    title: 'About · Taek Lim | Software Engineer',
    description:
        'Career of Taek Lim — professional experience, projects, open-source contributions, skills, and education.',
    alternates: {
        canonical: aboutPath(HOME_FEED_AUTHOR),
    },
};

export default async function AboutPage({
    params,
}: {
    params: Promise<{ handle: string }>;
}) {
    const { handle } = await params;
    if (!isOwnerHandle(handle)) notFound();

    return (
        <>
            <JsonLd data={buildProfilePageLd()} />
            <TerminalProfile />
        </>
    );
}
