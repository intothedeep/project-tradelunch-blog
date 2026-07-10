// Purpose: derive the public CDN URL for a stored object.
// Invariants:
//   * Pure — no I/O, no hidden state.
//   * Trailing slashes on cdnBase are normalized so the result never has `//`.
//   * Output is provider-independent: CDN_ASSETS + key is stable across
//     provider swaps, so no stored_uri row needs updating on migration
//     (only a CDN_ASSETS domain change rewrites stored_uri, not a bucket rename).
// Side effects: none.

/**
 * buildPublicUrl returns `${cdnBase}/${key}` with trailing slashes
 * on cdnBase collapsed to a single separator.
 */
export function buildPublicUrl(cdnBase: string, key: string): string {
    return `${cdnBase.replace(/\/+$/, '')}/${key}`;
}
