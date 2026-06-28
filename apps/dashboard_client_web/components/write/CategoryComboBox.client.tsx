// components/write/CategoryComboBox.client.tsx
// Purpose: ONE level of the category cascade — a shadcn Combobox (Popover + cmdk)
// listing this depth's categories with type-to-filter, a "— none" clear item, and
// a bottom Create "<typed>" row shown only when the typed text has no exact match.
// Selecting an item bubbles via onSelect; creating runs useCreateCategory and
// bubbles the resulting node via onCreated.
// Constraints: client-only, controlled (value = this level's selected id). Holds
// only transient UI state (popover open + filter query). Category ids are STRINGS.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { useCreateCategory } from '@/hooks/useCreateCategory.query.client';
import { cn } from '@/lib/utils';
import type { TCategoryItem } from '@/utils/categoryPath';
import type { TCategoryNode } from '@repo/types';

// Server caps a category title at 100 chars; mirror it to block the create row.
const MAX_TITLE_LEN = 100;

interface CategoryComboBoxProps {
    label: string;
    username: string | null | undefined;
    parentId: string | null;
    options: TCategoryItem[];
    value: string | null;
    onSelect: (id: string | null) => void;
    onCreated: (node: TCategoryNode) => void;
    autoOpen?: boolean;
}

export function CategoryComboBox({
    label,
    username,
    parentId,
    options,
    value,
    onSelect,
    onCreated,
    autoOpen,
}: CategoryComboBoxProps) {
    const t = useTranslations('write');
    const [open, setOpen] = useState(!!autoOpen);
    const [query, setQuery] = useState('');
    const createCategory = useCreateCategory(username);

    const selected = options.find((o) => o.id === value) ?? null;
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
        ? options.filter((o) => o.title.includes(normalizedQuery))
        : options;
    const hasExactMatch = options.some((o) => o.title === normalizedQuery);
    const canCreate =
        normalizedQuery.length > 0 &&
        normalizedQuery.length <= MAX_TITLE_LEN &&
        !hasExactMatch;

    const close = () => {
        setOpen(false);
        setQuery('');
    };

    const handlePick = (id: string | null) => {
        onSelect(id);
        close();
    };

    const handleCreate = async () => {
        if (!canCreate || createCategory.isPending) return;
        const node = await createCategory.mutateAsync({
            title: normalizedQuery,
            parentId,
        });
        onCreated(node);
        close();
    };

    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={label}
                    className="flex min-w-[10rem] items-center justify-between gap-2 border-2 border-primary/50 bg-transparent p-2 text-sm outline-none hover:border-primary"
                >
                    <span className="truncate">
                        {selected ? selected.title : label}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-[14rem] p-0"
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        value={query}
                        onValueChange={setQuery}
                        placeholder={t('category.searchPlaceholder')}
                        maxLength={MAX_TITLE_LEN}
                    />
                    <CommandList>
                        <CommandGroup>
                            <CommandItem
                                value="__none__"
                                onSelect={() => handlePick(null)}
                            >
                                <span className="text-muted-foreground">
                                    {t('category.none')}
                                </span>
                            </CommandItem>
                            {filtered.map((option) => (
                                <CommandItem
                                    key={option.id}
                                    value={option.id}
                                    onSelect={() => handlePick(option.id)}
                                >
                                    <Check
                                        className={cn(
                                            'h-4 w-4',
                                            value === option.id
                                                ? 'opacity-100'
                                                : 'opacity-0'
                                        )}
                                    />
                                    <span className="truncate">
                                        {option.title}
                                    </span>
                                </CommandItem>
                            ))}
                            {canCreate && (
                                <CommandItem
                                    value="__create__"
                                    disabled={createCategory.isPending}
                                    onSelect={() => void handleCreate()}
                                >
                                    {t('category.create', {
                                        title: normalizedQuery,
                                    })}
                                </CommandItem>
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
