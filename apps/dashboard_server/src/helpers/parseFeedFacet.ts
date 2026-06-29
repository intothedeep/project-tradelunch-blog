// Purpose: pure parse of a comma-joined feed-filter facet query value
//          (e.g. ?categories=a,b or ?tags=x,y) into a canonical text[] for
//          node-pg binding, or null when empty (so the SQL `IS NULL` no-op
//          short-circuits and skips the predicate).
// Invariants: split on ',', trim, lowercase, drop empties, dedupe (first-seen
//             order is irrelevant — overlap/EXISTS are set ops), cap at
//             FEED_FACET_MAX. Empty input => null.
// Constraints: deterministic, zero side effects. Never returns an empty array.

export const FEED_FACET_MAX = 20;

export function parseFeedFacet(raw: unknown): string[] | null {
    if (typeof raw !== 'string') return null;
    const seen = new Set<string>();
    for (const seg of raw.split(',')) {
        const v = seg.trim().toLowerCase();
        if (v.length === 0) continue;
        seen.add(v);
    }
    if (seen.size === 0) return null;
    return Array.from(seen).slice(0, FEED_FACET_MAX);
}
