'use client';

// Purpose: collapsed state of the top-bar search — icon + key hint. The hint is
// resolved after mount (navigator is client-only) so SSR and the first client
// render match.

import { forwardRef, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { isMacPlatform } from '@/components/topbar/searchHotkey.util';

type Props = { expanded: boolean; onOpen: () => void };

export const SearchTrigger = forwardRef<HTMLButtonElement, Props>(
    ({ expanded, onOpen }, ref) => {
        const t = useTranslations('blog');
        const [hint, setHint] = useState('');

        useEffect(() => {
            setHint(isMacPlatform() ? '⌘K' : 'Ctrl K');
        }, []);

        return (
            <button
                ref={ref}
                type="button"
                onClick={onOpen}
                aria-label={t('tags.searchOpen')}
                aria-expanded={expanded}
                aria-keyshortcuts="Meta+K Control+K"
                className="flex h-8 items-center gap-2 border border-primary/40 bg-background px-2 font-mono text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
                <Search
                    className="h-4 w-4"
                    aria-hidden
                />
                <kbd className="min-w-[2.5rem] text-xs font-mono">{hint}</kbd>
            </button>
        );
    }
);
SearchTrigger.displayName = 'SearchTrigger';

export default SearchTrigger;
