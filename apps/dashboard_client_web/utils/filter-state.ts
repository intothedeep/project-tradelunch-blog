// Purpose: pure, deterministic feed-filter state for the multi-category +
//          multi-tag per-author feed. Parses/serializes URL facets, toggles a
//          single value, and builds canonical feed hrefs.
// Invariants: every facet is lowercase, trimmed, empty-dropped, de-duplicated,
//             sorted (canonical), and capped at FILTER_MAX. Round-trip stable:
//             serializeFacet(parseFilterState(x).<facet>) yields a canonical
//             string that re-parses to the same set.
// Constraints: zero side effects, no hidden state, no I/O. Legacy single
//              `category_title` is a FALLBACK for `categories` (precedence,
//              mirroring the Express `??` handler — plural wins when present);
//              the output NEVER emits `category_title`.

export const FILTER_MAX = 20;

export type TFilterState = {
    categories: string[];
    tags: string[];
};

type TFacetKey = 'categories' | 'tags';

// Canonicalize a raw, comma-joined facet string into a sorted, de-duped,
// lowercase, capped string[]. Each segment is URL-decoded then trimmed.
function canonicalizeRaw(raw: string | undefined): string[] {
    if (!raw) return [];
    const decoded = raw.split(',').map((seg) => {
        try {
            return decodeURIComponent(seg);
        } catch {
            return seg;
        }
    });
    return canonicalize(decoded);
}

// Canonicalize an already-split list of values: trim, lowercase, drop empties,
// dedupe, sort, cap at FILTER_MAX.
function canonicalize(values: string[]): string[] {
    const seen = new Set<string>();
    for (const raw of values) {
        const v = raw.trim().toLowerCase();
        if (v.length === 0) continue;
        seen.add(v);
    }
    return Array.from(seen).sort().slice(0, FILTER_MAX);
}

export function parseFilterState(sp: {
    categories?: string;
    tags?: string;
    category_title?: string;
}): TFilterState {
    // Precedence (mirrors the Express `parseFeedFacet(categories) ??
    // parseFeedFacet(category_title)`): the plural `categories` facet wins when
    // it yields any value; the legacy single `category_title` is a fallback
    // only — never merged. Keeps the SSR page and the API in lock-step.
    const fromCategories = canonicalizeRaw(sp.categories);
    const categories =
        fromCategories.length > 0
            ? fromCategories
            : canonicalizeRaw(sp.category_title);
    const tags = canonicalizeRaw(sp.tags);
    return { categories, tags };
}

export function serializeFacet(values: string[]): string {
    const canonical = canonicalize(values);
    if (canonical.length === 0) return '';
    return canonical.map((v) => encodeURIComponent(v)).join(',');
}

export function toggleValue(values: string[], value: string): string[] {
    const target = value.trim().toLowerCase();
    if (target.length === 0) return [...values];
    if (values.includes(target)) {
        return values.filter((v) => v !== target);
    }
    return [...values, target];
}

export function buildFeedHref(username: string, next: TFilterState): string {
    const params: string[] = [];
    const categories = serializeFacet(next.categories);
    const tags = serializeFacet(next.tags);
    if (categories) params.push(`categories=${categories}`);
    if (tags) params.push(`tags=${tags}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    return `/blog/@${username}${query}`;
}

export function buildToggleHref(
    username: string,
    current: TFilterState,
    facet: TFacetKey,
    value: string
): string {
    const next: TFilterState = {
        categories: [...current.categories],
        tags: [...current.tags],
    };
    next[facet] = toggleValue(next[facet], value);
    return buildFeedHref(username, next);
}
