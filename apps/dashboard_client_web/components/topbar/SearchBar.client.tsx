'use client';

// Purpose: expanded top-bar tag jump — a full-width input that replaces the
// header content. Submitting routes to /tags/<q> (P2): pure client navigation,
// no backend call. Trim guards against empty queries. Esc / close button /
// submit / outside click all close it.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = { onClose: (returnFocus: boolean) => void };

export const SearchBar = ({ onClose }: Props) => {
    const router = useRouter();
    const t = useTranslations('blog');
    const [query, setQuery] = useState('');
    const formRef = useRef<HTMLFormElement>(null);

    const placeholder = t('tags.jumpPlaceholder');

    useEffect(() => {
        const handleMouseDown = (event: MouseEvent) => {
            if (
                formRef.current &&
                !formRef.current.contains(event.target as Node)
            )
                onClose(false);
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [onClose]);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const trimmed = query.trim();
        if (trimmed.length === 0) return;
        router.push('/tags/' + encodeURIComponent(trimmed));
        onClose(true);
    };

    return (
        <form
            ref={formRef}
            role="search"
            onSubmit={handleSubmit}
            onKeyDown={(event) => {
                if (event.key === 'Escape') onClose(true);
            }}
            className="flex w-full items-center border border-primary bg-background"
        >
            <Search
                className="mx-2 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
            />
            <input
                type="text"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="h-10 w-full bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
                type="button"
                onClick={() => onClose(true)}
                aria-label={t('tags.searchClose')}
                className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
            >
                <X
                    className="h-4 w-4"
                    aria-hidden
                />
            </button>
        </form>
    );
};

export default SearchBar;
