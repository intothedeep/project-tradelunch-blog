// Purpose: derive the public CDN URL for a stored object.
// Invariants:
//   * Pure — no I/O, no hidden state.
//   * Trailing slashes on cdnBase are normalized so the result never has `//`.
//   * Output is provider-independent: CDN_ASSETS + bucket + key is stable across
//     provider swaps, so no stored_uri row needs updating on migration.
// Side effects: none.

/**
 * buildPublicUrl returns `${cdnBase}/${bucket}/${key}` with trailing slashes
 * on cdnBase collapsed to a single separator.
 */
export function buildPublicUrl(
    cdnBase: string,
    bucket: string,
    key: string
): string {
    return `${cdnBase.replace(/\/+$/, '')}/${bucket}/${key}`;
}
