// Purpose: pure normalization + validation of a post's tag set.
// Invariants: input is a string[]; each tag is trimmed, empties dropped,
//             lowercased (canonical), then de-duplicated case-insensitively
//             (order of first appearance preserved). A tag longer than
//             TAG_MAX_LEN chars or a set larger than TAG_MAX_COUNT is rejected.
//             An empty/all-empty array normalizes to [] (a valid "clear" set).
// Constraints: deterministic, zero side effects. Mirrors validatePostInput's
//             result shape ({ ok, value } | { ok:false, reason }).
type TNormalizeTagsResult =
    | { ok: true; value: string[] }
    | { ok: false; reason: string };

const TAG_MAX_LEN = 50;
const TAG_MAX_COUNT = 20;

export function normalizeTags(input: unknown): TNormalizeTagsResult {
    if (!Array.isArray(input)) {
        return { ok: false, reason: 'tags must be an array' };
    }

    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const raw of input) {
        if (typeof raw !== 'string') {
            return { ok: false, reason: 'each tag must be a string' };
        }
        const tag = raw.trim().toLowerCase();
        if (tag.length === 0) {
            continue;
        }
        if (tag.length > TAG_MAX_LEN) {
            return {
                ok: false,
                reason: `each tag must be ${TAG_MAX_LEN} characters or fewer`,
            };
        }
        if (seen.has(tag)) {
            continue;
        }
        seen.add(tag);
        normalized.push(tag);
    }

    if (normalized.length > TAG_MAX_COUNT) {
        return {
            ok: false,
            reason: `at most ${TAG_MAX_COUNT} tags are allowed`,
        };
    }

    return { ok: true, value: normalized };
}
