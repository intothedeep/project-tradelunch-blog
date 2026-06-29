'use client';

// Purpose: top-bar "Write" entry point. Mirrors the existing nav idiom —
// signed-in only (middleware also protects /write). Renders nothing when
// signed out so the bar stays clean.

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { SquarePen } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const CreateButton = () => {
    const { isSignedIn } = useUser();
    const t = useTranslations('write');

    if (!isSignedIn) return null;

    return (
        <Link
            href="/write"
            className="flex items-center gap-2 px-4 py-2 font-mono text-sm border border-transparent hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
        >
            <SquarePen
                className="h-4 w-4"
                aria-hidden
            />
            {t('nav.write')}
        </Link>
    );
};

export default CreateButton;
