import type { Metadata } from 'next';

import TerminalProfile from '@/app/MainPage';

// `/about` is the career/portfolio page (experience · projects · open source ·
// skills · education). It used to live at `/`, but Phase H repurposed `/` as the
// global blog feed, which orphaned `app/MainPage.tsx` (TerminalProfile) and left
// the nav "About" link pointing at the feed. This route restores it at a stable,
// blog-feed-independent URL so career content is no longer on `/`.
export const metadata: Metadata = {
    title: 'About · Taek Lim | Software Engineer',
    description:
        'Career of Taek Lim — professional experience, projects, open-source contributions, skills, and education.',
};

export default function AboutPage() {
    return <TerminalProfile />;
}
