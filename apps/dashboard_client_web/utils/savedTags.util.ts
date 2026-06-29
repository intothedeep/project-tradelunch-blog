// Purpose: PURE transforms for the "saved tags" localStorage list.
// Invariant: tags are canonicalized LOWERCASE and de-duped case-insensitively,
// newest-first, capped. Constraints: deterministic, no side effects.

export const SAVED_TAGS_CAP = 50;

export const canonicalizeTag = (tag: string): string =>
    tag.trim().toLowerCase();

// Add a canonicalized tag to the front; drop any case-insensitive duplicate and
// cap the list. Blank tags are ignored.
export const addSavedTag = (
    list: readonly string[],
    tag: string,
    cap: number = SAVED_TAGS_CAP
): string[] => {
    const canon = canonicalizeTag(tag);
    if (!canon) return [...list];
    const without = list.filter((entry) => canonicalizeTag(entry) !== canon);
    return [canon, ...without].slice(0, cap);
};

export const removeSavedTag = (
    list: readonly string[],
    tag: string
): string[] => {
    const canon = canonicalizeTag(tag);
    return list.filter((entry) => canonicalizeTag(entry) !== canon);
};

export const isSavedTag = (list: readonly string[], tag: string): boolean => {
    const canon = canonicalizeTag(tag);
    return list.some((entry) => canonicalizeTag(entry) === canon);
};
