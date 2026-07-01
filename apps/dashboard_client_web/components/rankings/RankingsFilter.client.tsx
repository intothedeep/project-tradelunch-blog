// components/rankings/RankingsFilter.client.tsx
// Purpose: scope toggle (Global / Sector) + sector picker for /rankings.
//   Navigation is URL-driven — each choice pushes new query params so the
//   server component re-fetches the matching slice (shareable, back-safe).
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
}

const TOGGLE_BASE = 'px-4 py-2 font-mono text-sm border transition-colors';
const TOGGLE_ACTIVE = 'bg-primary text-primary-foreground border-primary';
const TOGGLE_IDLE =
    'border-border text-muted-foreground hover:border-primary hover:text-foreground';

export default function RankingsFilter({
    scope,
    sector,
    sectors,
}: RankingsFilterProps) {
    const router = useRouter();

    const goGlobal = () => router.push('/rankings');
    const goSector = (name: string) =>
        router.push(
            `/rankings?scope=sector&sector=${encodeURIComponent(name)}`
        );

    // Entering sector scope defaults to the current/first sector.
    const enterSector = () => {
        const target = sector ?? sectors[0];
        if (target) goSector(target);
    };

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
                            className="flex items-center gap-2 px-4 py-2 font-mono text-sm border border-border hover:border-primary transition-colors"
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
        </div>
    );
}
