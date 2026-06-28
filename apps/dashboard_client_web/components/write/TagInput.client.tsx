// components/write/TagInput.client.tsx
// Purpose: tag editor — chips with per-chip remove, a text input that commits on
// Enter/comma, and empty-input Backspace removing the last chip. Tags are lowercase
// canonical; add is blocked on empty / duplicate (case-insensitive) / >50 chars /
// >=20 count, each surfacing a localized hint.
// Constraints: client-only, controlled (value = string[]). The add rule is a pure
// exported helper (addTag) so it can be unit-tested without the DOM.

'use client';

import { useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

export const TAG_MAX_LEN = 50;
export const TAG_MAX_COUNT = 20;

export type TagError = 'duplicate' | 'tooLong' | 'limit';

export interface TagAddResult {
    tags: string[];
    error: TagError | null;
}

// Pure add rule: trim → lowercase → validate. Empty input is a silent no-op
// (returns the list unchanged with no error). Order: length cap → count cap →
// duplicate. Never mutates the input array.
export function addTag(tags: string[], raw: string): TagAddResult {
    const normalized = raw.trim().toLowerCase();
    if (normalized.length === 0) return { tags, error: null };
    if (normalized.length > TAG_MAX_LEN) return { tags, error: 'tooLong' };
    if (tags.length >= TAG_MAX_COUNT) return { tags, error: 'limit' };
    if (tags.includes(normalized)) return { tags, error: 'duplicate' };
    return { tags: [...tags, normalized], error: null };
}

interface TagInputProps {
    value: string[];
    onChange: (tags: string[]) => void;
}

export function TagInput({ value, onChange }: TagInputProps) {
    const t = useTranslations('write');
    const [draft, setDraft] = useState('');
    const [error, setError] = useState<TagError | null>(null);

    const commit = () => {
        const result = addTag(value, draft);
        if (result.error) {
            setError(result.error);
            return;
        }
        setError(null);
        if (result.tags !== value) onChange(result.tags);
        setDraft('');
    };

    const removeAt = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
        setError(null);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
            return;
        }
        if (e.key === 'Backspace' && draft.length === 0 && value.length > 0) {
            e.preventDefault();
            removeAt(value.length - 1);
        }
    };

    const errorMessage =
        error === 'limit'
            ? t('tags.limitReached')
            : error === 'duplicate'
              ? t('tags.duplicate')
              : error === 'tooLong'
                ? t('tags.tooLong')
                : null;

    return (
        <div className="font-mono">
            <span className="block text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                {t('tags.label')}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-2 border-2 border-primary/50 p-2 focus-within:border-primary">
                {value.map((tag, index) => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1 border border-primary/50 px-2 py-0.5 text-xs"
                    >
                        {tag}
                        <button
                            type="button"
                            aria-label={t('tags.remove', { tag })}
                            onClick={() => removeAt(index)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <input
                    value={draft}
                    onChange={(e) => {
                        setDraft(e.target.value);
                        if (error) setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={commit}
                    maxLength={TAG_MAX_LEN}
                    placeholder={t('tags.placeholder')}
                    aria-label={t('tags.label')}
                    className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none"
                />
            </div>
            {errorMessage && (
                <p
                    role="alert"
                    className="mt-1 text-xs text-destructive"
                >
                    {errorMessage}
                </p>
            )}
        </div>
    );
}
