// Purpose: derive the Supabase Storage object key for a post image.
// Invariants:
//   * The key is namespaced by userId (`${userId}/...`) so an author can only
//     ever write under their own prefix (isolation boundary).
//   * Path derivation is PURE — the uniqueness suffix is an explicit ARGUMENT;
//     this module performs no Date.now()/Math.random itself.
//   * Phase F always re-encodes to webp on the server, so the controller passes
//     ext `'webp'`. ALLOWED_IMAGE_TYPES is retained as the canonical ext map.
// Side effects: none.

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

export function buildImagePath(
    userId: number,
    filename: string,
    uniqueSuffix: string,
    ext: string
): string {
    const base = filename
        .toLowerCase()
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    const name = base || 'image';
    return `${userId}/${name}-${uniqueSuffix}.${ext}`;
}
