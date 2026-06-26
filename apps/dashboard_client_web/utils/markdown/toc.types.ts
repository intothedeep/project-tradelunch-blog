/**
 * Purpose: Client-side TOC type definition.
 * Inlined from @repo/markdown-parsing when that package was retired.
 * Only TTocItem is copied here (YAGNI — TNestedTocItem/Article/TProcessedMarkdown
 * are not used by any client component).
 * Invariants: depth is 1–6 matching markdown heading levels.
 * Side effects: none.
 */

export type TTocItem = {
    depth: number;
    text: string;
    slug: string;
};
