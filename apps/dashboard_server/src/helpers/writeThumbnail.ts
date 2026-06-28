// Purpose: persist (or clear) the single thumbnail row for a post in the `files`
//          table, owner-scoped, inside the caller's post-write transaction.
// Invariants:
//   * At most ONE live (deleted_at IS NULL) is_thumbnail=true row per post from
//     this writer: every call first soft-deletes any existing one, then inserts.
//   * Every write is bound to user_id = $caller, so a non-owner can never touch
//     another author's files row (mirrors writePost owner-scoping).
//   * The stored absolute URL IS the sign endpoint's publicUrl — the read JOIN
//     surfaces it opaquely as post.stored_uri, identical to blog_agent's writer.
// Constraints: parseThumbnailUrl is pure (deterministic, no I/O). upsertThumbnail
//              isolates the SQL side effects and must run on a PoolClient already
//              inside a BEGIN/COMMIT so a partial post+thumbnail write can't leak.
import type { PoolClient } from 'pg';

// ext → mime, reused for the NOT NULL content_type column. Mirrors the image
// allowlist in helpers/imagePath (the only ext values buildImagePath can emit).
const EXT_TO_MIME: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
};

export type TThumbnailParts = {
    key: string;
    storedName: string;
    ext: string;
    contentType: string;
};

export type TThumbnailConfig = { cdnBase: string; bucket: string };

// Derive storage metadata from an absolute thumbnail URL by stripping the
// `${cdnBase}/${bucket}/` prefix the sign endpoint added. Returns null when the
// URL does not carry that prefix (foreign / malformed) so the caller can reject.
export function parseThumbnailUrl(
    url: string,
    cfg: TThumbnailConfig
): TThumbnailParts | null {
    const prefix = `${cfg.cdnBase.replace(/\/+$/, '')}/${cfg.bucket}/`;
    if (!url.startsWith(prefix)) return null;
    const key = url.slice(prefix.length);
    if (key.length === 0) return null;

    const storedName = key.split('/').pop() ?? '';
    if (storedName.length === 0) return null;

    const dot = storedName.lastIndexOf('.');
    const ext = dot >= 0 ? storedName.slice(dot + 1).toLowerCase() : '';
    const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';

    return { key, storedName, ext, contentType };
}

// Soft-delete any existing thumbnail for the post, then (when a URL is given)
// upsert the new one. `thumbnailUrl === null` clears only. Reuses the
// UNIQUE(user_id, stored_name) constraint as the conflict target so re-selecting
// the same stored object revives its row instead of erroring.
export async function upsertThumbnail(
    db: PoolClient,
    userId: number,
    postId: string,
    thumbnailUrl: string | null,
    cfg: TThumbnailConfig
): Promise<void> {
    // Always clear first: guarantees a single live thumbnail and makes a clear
    // (null) idempotent. Soft-delete per the repo "rm -rf" convention.
    await db.query(
        `UPDATE files
            SET deleted_at = now(), updated_at = now()
          WHERE post_id = $1 AND user_id = $2
            AND is_thumbnail = true AND deleted_at IS NULL`,
        [postId, userId]
    );

    if (thumbnailUrl === null || thumbnailUrl.trim().length === 0) return;

    const parts = parseThumbnailUrl(thumbnailUrl, cfg);
    if (!parts) {
        throw new Error('thumbnailUrl does not match the storage CDN prefix');
    }

    await db.query(
        `INSERT INTO files
            (user_id, post_id, original_filename, stored_name, s3_key,
             stored_uri, ext, content_type, is_thumbnail)
         VALUES ($1, $2, $3, $3, $4, $5, $6, $7, true)
         ON CONFLICT (user_id, stored_name) DO UPDATE SET
             post_id      = EXCLUDED.post_id,
             stored_uri   = EXCLUDED.stored_uri,
             s3_key       = EXCLUDED.s3_key,
             ext          = EXCLUDED.ext,
             content_type = EXCLUDED.content_type,
             is_thumbnail = true,
             deleted_at   = NULL,
             updated_at   = now()`,
        [
            userId,
            postId,
            parts.storedName,
            parts.key,
            thumbnailUrl,
            parts.ext,
            parts.contentType,
        ]
    );
}
