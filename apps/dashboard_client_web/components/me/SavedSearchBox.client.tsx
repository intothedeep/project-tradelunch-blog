// components/me/SavedSearchBox.client.tsx
// Purpose: controlled search input for the saved-posts list, with a clear (×)
//   button. Emits the raw term up; the list debounces it into the query key, so
//   this component holds no query state of its own.
// Constraints: client-only (input event handlers). No side effects beyond
//   invoking the onChange callback.

'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SavedSearchBoxProps {
    value: string;
    onChange: (value: string) => void;
}

export function SavedSearchBox({ value, onChange }: SavedSearchBoxProps) {
    const t = useTranslations('write');

    return (
        <div className="relative mb-4">
            <Input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label={t('saved.searchLabel')}
                placeholder={t('saved.searchPlaceholder')}
                className="pr-9"
            />
            {value.length > 0 && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    aria-label={t('saved.clearSearch')}
                    className={cn(
                        'absolute right-2 top-1/2 -translate-y-1/2',
                        'flex items-center justify-center',
                        'text-muted-foreground transition-colors hover:text-foreground'
                    )}
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
}
