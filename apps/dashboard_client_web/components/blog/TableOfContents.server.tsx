import type { TTocItem } from '@repo/markdown-parsing';
import { cn } from '@/lib/utils';

interface TableOfContentsProps {
    items: TTocItem[];
    className?: string;
}

// Mapping for indentation based on heading depth
const depthIndent: Record<number, string> = {
    1: 'pl-0',
    2: 'pl-4',
    3: 'pl-8',
    4: 'pl-12',
    5: 'pl-16',
    6: 'pl-20',
};

/**
 * Server-rendered Table of Contents component.
 * Renders a flat list of anchor links with indentation based on heading depth.
 */
export const TableOfContents = ({ items, className }: TableOfContentsProps) => {
    if (!items || items.length === 0) {
        return null;
    }

    return (
        <nav
            aria-label="Table of contents"
            className={cn(
                'my-4 p-4 rounded-lg',
                'bg-muted/50 border border-border',
                className
            )}
        >
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                Table of Contents
            </h2>
            <ul className="space-y-1">
                {items.map((item, index) => (
                    <li
                        key={`${item.slug}-${index}`}
                        className={cn(depthIndent[item.depth] || 'pl-0')}
                    >
                        <a
                            href={`#${item.slug}`}
                            className={cn(
                                'block py-1 text-sm',
                                'text-muted-foreground hover:text-primary',
                                'transition-colors duration-150',
                                'hover:underline underline-offset-2'
                            )}
                        >
                            {item.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default TableOfContents;
