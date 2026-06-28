// Purpose: synchronize a post's tag set inside the CALLER's transaction. Given
//          the desired (already-normalized, lowercase) tag list, it makes
//          post_tags match in two statements — no loops:
//            1) soft-delete links no longer wanted (tombstone, never hard-delete)
//            2) upsert the tags rows + (re)attach/resurrect the post_tags links
// Invariants:
//   * Runs on the supplied client so it shares the post write's transaction —
//     a failed tag sync rolls back the post mutation too.
//   * postId is a Snowflake BIGINT kept as a STRING (never Number()-ed).
//   * tags MUST be pre-normalized by normalizeTags (lowercase, deduped, capped).
//   * An EMPTY array clears the set: statement 1 tombstones every live link and
//     statement 2 is skipped.
//   * Soft-delete only — removed links keep their row (deleted_at = now()).
// Side effects: two parameterized SQL statements against post_tags / tags.
import type { PoolClient } from 'pg';

// Replace the post's live tag set with `tags`. Adds/resurrects wanted links and
// tombstones the rest. Returns nothing; throws on SQL error (caller's txn rolls
// back).
export async function syncPostTags(
    client: PoolClient,
    postId: string,
    tags: string[]
): Promise<void> {
    // 1) Tombstone links that are live but no longer in the desired set. With an
    // empty set, `<> ALL('{}')` is TRUE for every row, so all live links drop.
    await client.query(
        `UPDATE post_tags
         SET deleted_at = now()
         WHERE post_id = $1
           AND deleted_at IS NULL
           AND tag_title <> ALL($2::text[])`,
        [postId, tags]
    );

    if (tags.length === 0) {
        return;
    }

    // 2) Upsert tags rows (resurrecting any soft-deleted tag), then insert or
    // resurrect the post_tags links in one statement. DISTINCT guards against an
    // ON CONFLICT double-hit even though the input is already deduped.
    await client.query(
        `WITH upserted AS (
            INSERT INTO tags (title)
            SELECT DISTINCT t FROM unnest($2::text[]) AS t
            ON CONFLICT (title)
                DO UPDATE SET deleted_at = NULL, updated_at = now()
            RETURNING id, title
         )
         INSERT INTO post_tags (post_id, tag_id, tag_title)
         SELECT $1, u.id, u.title FROM upserted u
         ON CONFLICT (post_id, tag_title)
            DO UPDATE SET tag_id = EXCLUDED.tag_id,
                          deleted_at = NULL,
                          updated_at = now()`,
        [postId, tags]
    );
}
