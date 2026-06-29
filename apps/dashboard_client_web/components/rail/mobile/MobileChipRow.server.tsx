// Purpose: horizontal-scroll chip row for the mobile context header. Async SERVER
// component (chips are plain navigation <Link>s; native overflow scroll needs no
// JS). Renders categories + scoped tags as ≥44px-tall pills inside a keyboard-
// reachable (tabIndex=0), scroll-snapping, scrollbar-hidden container with a right
// edge-fade gradient cueing more content. Links are NAVIGATION — no
// role="tab"/"tablist". Renders nothing when there are no chips.
// Side effects: none (data passed in by the caller).

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { TMobileChip } from '@/components/rail/mobile/getMobileChips.server';
import { cn } from '@/lib/utils';

export const MobileChipRow = async ({ chips }: { chips: TMobileChip[] }) => {
    const t = await getTranslations('blog');

    if (!chips.length) return null;

    return (
        <div className="relative">
            <div
                tabIndex={0}
                aria-label={t('mobile.categoriesTags')}
                className={cn(
                    'flex gap-2 overflow-x-auto snap-x snap-proximity -mx-2 px-2',
                    '[&::-webkit-scrollbar]:hidden'
                )}
            >
                {chips.map((chip) => (
                    <Link
                        key={`${chip.kind}:${chip.href}`}
                        href={chip.href}
                        className={cn(
                            'snap-start shrink-0 inline-flex items-center min-h-11 gap-1',
                            'rounded-full border border-border px-2.5 py-1 text-xs',
                            'text-foreground transition-colors hover:bg-accent/50'
                        )}
                    >
                        {chip.kind === 'tag' ? (
                            <span className="truncate">#{chip.label}</span>
                        ) : (
                            <span className="truncate">{chip.label}</span>
                        )}
                        {typeof chip.count === 'number' ? (
                            <span className="text-muted-foreground">
                                {chip.count}
                            </span>
                        ) : null}
                    </Link>
                ))}
            </div>
            <span className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background" />
        </div>
    );
};

export default MobileChipRow;
