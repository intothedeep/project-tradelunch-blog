'use client';

// Purpose: top-bar tag jump. Submitting routes to the /tags/<q> feed (P2) —
// pure client navigation, no backend call. Trim guards against empty queries.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const SearchBar = () => {
    const router = useRouter();
    const t = useTranslations('blog');
    const [query, setQuery] = useState('');

    const placeholder = t('tags.jumpPlaceholder');

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const trimmed = query.trim();
        if (trimmed.length === 0) return;
        router.push('/tags/' + encodeURIComponent(trimmed));
    };

    return (
        <form
            role="search"
            onSubmit={handleSubmit}
            className="flex items-center border border-primary/40 bg-background focus-within:border-primary"
        >
            <button
                type="submit"
                aria-label={placeholder}
                className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-primary transition-colors"
            >
                <Search
                    className="h-4 w-4"
                    aria-hidden
                />
            </button>
            <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="w-36 lg:w-52 bg-transparent py-1.5 pr-2 font-mono text-sm outline-none placeholder:text-muted-foreground"
            />
        </form>
    );
};

export default SearchBar;
