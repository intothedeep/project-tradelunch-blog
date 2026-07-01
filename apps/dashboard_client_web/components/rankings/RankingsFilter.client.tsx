// components/rankings/RankingsFilter.client.tsx
// Purpose: scope toggle (Global / Sector) + sector picker + week picker for
//   /rankings. Navigation is URL-driven — each choice pushes new query params so
//   the server component re-fetches the matching slice (shareable, back-safe).
//   The latest week is left UNPINNED (no asOf param) so the page tracks the
//   newest weekly snapshot; only an older week is pinned into the URL.
// Constraints: client component — owns only navigation intent, no data.
// Side effects: router.push (URL change).

'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { RankingScope } from '@/types/rankings';

interface RankingsFilterProps {
    scope: RankingScope;
    sector: string | null;
    sectors: string[];
    asOf: string; // resolved current week
    availableWeeks: string[]; // newest-first
}

const TOGGLE_BASE = 'px-4 py-2 font-mono text-sm border transition-colors';
const TOGGLE_ACTIVE = 'bg-primary text-primary-foreground border-primary';
const TOGGLE_IDLE =
    'border-border text-muted-foreground hover:border-primary hover:text-foreground';
const PICKER_TRIGGER =
    'flex items-center gap-2 px-4 py-2 font-mono text-sm border border-border hover:border-primary transition-colors disabled:opacity-40 disabled:hover:border-border';

export default function RankingsFilter({
    scope,
    sector,
    sectors,
    asOf,
    availableWeeks,
}: RankingsFilterProps) {
    const router = useRouter();

    const latestWeek = availableWeeks[0] ?? null;
    // Pin only a NON-latest week; latest stays live (no asOf param).
    const pinnedAsOf = asOf && asOf !== latestWeek ? asOf : null;

    // Build a /rankings href carrying scope + sector + week together. `next`
    // overrides one axis; unspecified axes keep the current value.
    const buildHref = (next: {
        scope?: RankingScope;
        sector?: string | null;
        asOf?: string | null;
    }): string => {
        const s = next.scope ?? scope;
        const params = new URLSearchParams();
        if (s === 'sector') {
            params.set('scope', 'sector');
            const sec = next.sector !== undefined ? next.sector : sector;
            if (sec) params.set('sector', sec);
        }
        const a = next.asOf !== undefined ? next.asOf : pinnedAsOf;
        if (a) params.set('asOf', a);
        const qs = params.toString();
        return qs ? `/rankings?${qs}` : '/rankings';
    };

    const goGlobal = () =>
        router.push(buildHref({ scope: 'global', sector: null }));
    const goSector = (name: string) =>
        router.push(buildHref({ scope: 'sector', sector: name }));
    // Entering sector scope defaults to the current/first sector.
    const enterSector = () => {
        const target = sector ?? sectors[0];
        if (target) goSector(target);
    };
    const goWeek = (week: string) =>
        router.push(buildHref({ asOf: week === latestWeek ? null : week }));

    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="flex">
                <button
                    type="button"
                    onClick={goGlobal}
                    className={cn(
                        TOGGLE_BASE,
                        scope === 'global' ? TOGGLE_ACTIVE : TOGGLE_IDLE
                    )}
                    aria-pressed={scope === 'global'}
                >
                    GLOBAL
                </button>
                <button
                    type="button"
                    onClick={enterSector}
                    disabled={sectors.length === 0}
                    className={cn(
                        TOGGLE_BASE,
                        '-ml-px disabled:opacity-40',
                        scope === 'sector' ? TOGGLE_ACTIVE : TOGGLE_IDLE
                    )}
                    aria-pressed={scope === 'sector'}
                >
                    SECTOR
                </button>
            </div>

            {scope === 'sector' && sectors.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className={PICKER_TRIGGER}
                        >
                            {sector ?? 'Select sector'}
                            <ChevronDown className="h-4 w-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        className="max-h-80 overflow-y-auto"
                    >
                        {sectors.map((name) => (
                            <DropdownMenuItem
                                key={name}
                                onSelect={() => goSector(name)}
                                className={cn(
                                    name === sector && 'font-semibold'
                                )}
                            >
                                {name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            {/* Week picker — time-travel across weekly snapshots. Disabled while
                only one week exists (the time-series view fills in weekly). */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        disabled={availableWeeks.length <= 1}
                        className={PICKER_TRIGGER}
                    >
                        Week of {asOf}
                        <ChevronDown className="h-4 w-4" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="max-h-80 overflow-y-auto"
                >
                    {availableWeeks.map((week) => (
                        <DropdownMenuItem
                            key={week}
                            onSelect={() => goWeek(week)}
                            className={cn(week === asOf && 'font-semibold')}
                        >
                            {week}
                            {week === latestWeek ? ' · latest' : ''}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
