// Purpose: owner-scoped authoring routes for posts (create / update / soft-delete)
//          plus image-upload signing. All routes are gated by requireAuth and act
//          ONLY on req.auth.userId — a client-supplied user_id is never trusted.
// Invariants:
//   * The author of a created post is req.auth.userId, always.
//   * PATCH/DELETE match WHERE id=$1 AND user_id=$caller AND deleted_at IS NULL,
//     so a non-owner gets 404 (never a cross-author mutation).
//   * COALESCE update semantics (see helpers/writePost.ts): a PATCH can change a
//     field or leave it untouched, but CANNOT null out an existing value.
// Side effects: DB writes via the writePost helpers; one network call when signing.
import { Router } from 'express';
import { pool } from '../../database';
import { requireAuth } from '../../middlewares/requireAuth';
import { validatePostInput } from '../../helpers/validatePostInput';
import { slugify } from '../../helpers/slugify';
import {
    createPost,
    updatePost,
    softDeletePost,
} from '../../helpers/writePost';
import { upsertThumbnail } from '../../helpers/writeThumbnail';
import { signImageUpload } from '../../helpers/signImageUpload';
import {
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    SUPABASE_STORAGE_BUCKET,
    CDN_ASSETS,
} from '../../config/env.schema';
import type { TImageSignResponse, TPostStatus } from '@repo/types';

export const router = Router();

// The base the thumbnail writer strips back off the stored URL. MUST mirror the
// sign route's publicBase (below) so parseThumbnailUrl's prefix-strip is exact.
const thumbnailCdnBase =
    CDN_ASSETS?.replace(/\/+$/, '') ||
    `${SUPABASE_URL}/storage/v1/object/public`;

router.post('', requireAuth, async (req, res) => {
    try {
        const parsed = validatePostInput(req.body);
        if (parsed.ok === false) {
            res.status(400).json({ success: false, message: parsed.reason });
            return;
        }

        const input = parsed.value;
        const slug = input.slug?.trim() || slugify(input.title);
        const status: TPostStatus = input.status ?? 'draft';
        const userId = req.auth!.userId;

        // Post + thumbnail share one transaction: a failed thumbnail write must
        // not leave an orphaned post row (and vice versa).
        const client = await pool.connect();
        let row;
        try {
            await client.query('BEGIN');
            row = await createPost(client, userId, {
                slug,
                title: input.title,
                content: input.content ?? null,
                description: input.description ?? null,
                categoryId: input.categoryId ?? null,
                status,
            });
            if (input.thumbnailUrl !== undefined) {
                await upsertThumbnail(
                    client,
                    userId,
                    row.id,
                    input.thumbnailUrl,
                    { cdnBase: thumbnailCdnBase, bucket: SUPABASE_STORAGE_BUCKET }
                );
            }
            await client.query('COMMIT');
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

        res.status(201).json({ success: true, data: row });
    } catch (error) {
        console.error('POST /api/posts error:', error);
        res.status(500).json({ success: false, message: 'failed to create post' });
    }
});

router.patch('/:postid', requireAuth, async (req, res) => {
    try {
        const postId = parseInt(String(req.params.postid), 10);
        if (!Number.isInteger(postId)) {
            res.status(400).json({ success: false, message: 'invalid post id' });
            return;
        }

        const parsed = validatePostInput(req.body);
        if (parsed.ok === false) {
            res.status(400).json({ success: false, message: parsed.reason });
            return;
        }

        const input = parsed.value;
        const userId = req.auth!.userId;

        // Update + thumbnail in one transaction. A non-owner/not-found PATCH
        // short-circuits to 404 BEFORE any files write (owner-scoping preserved).
        const client = await pool.connect();
        let row;
        try {
            await client.query('BEGIN');
            row = await updatePost(client, userId, postId, input);
            if (!row) {
                await client.query('ROLLBACK');
                res.status(404).json({
                    success: false,
                    message: 'Post not found',
                });
                return;
            }
            if (input.thumbnailUrl !== undefined) {
                await upsertThumbnail(
                    client,
                    userId,
                    row.id,
                    input.thumbnailUrl,
                    { cdnBase: thumbnailCdnBase, bucket: SUPABASE_STORAGE_BUCKET }
                );
            }
            await client.query('COMMIT');
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

        res.json({ success: true, data: row });
    } catch (error) {
        console.error('PATCH /api/posts/:postid error:', error);
        res.status(500).json({ success: false, message: 'failed to update post' });
    }
});

router.delete('/:postid', requireAuth, async (req, res) => {
    try {
        const postId = parseInt(String(req.params.postid), 10);
        if (!Number.isInteger(postId)) {
            res.status(400).json({ success: false, message: 'invalid post id' });
            return;
        }

        const deletedId = await softDeletePost(pool, req.auth!.userId, postId);
        if (deletedId === null) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }

        res.json({ success: true, data: { id: deletedId } });
    } catch (error) {
        console.error('DELETE /api/posts/:postid error:', error);
        res.status(500).json({ success: false, message: 'failed to delete post' });
    }
});

router.post('/images/sign', requireAuth, async (req, res) => {
    try {
        if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
            res.status(503).json({
                success: false,
                message: 'storage not configured',
            });
            return;
        }

        const body = req.body as { filename?: unknown; contentType?: unknown };
        if (
            typeof body?.filename !== 'string' ||
            typeof body?.contentType !== 'string'
        ) {
            res.status(400).json({
                success: false,
                message: 'filename and contentType are required',
            });
            return;
        }

        // Impure uniqueness suffix lives here, not in the pure path builder.
        const uniqueSuffix = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;
        const publicBase =
            CDN_ASSETS?.replace(/\/+$/, '') ||
            `${SUPABASE_URL}/storage/v1/object/public`;

        const result = await signImageUpload(
            {
                supabaseUrl: SUPABASE_URL,
                secretKey: SUPABASE_SECRET_KEY,
                publicBase,
                bucket: SUPABASE_STORAGE_BUCKET,
            },
            {
                userId: req.auth!.userId,
                filename: body.filename,
                contentType: body.contentType,
                uniqueSuffix,
            }
        );

        if (result.ok === false) {
            res.status(400).json({ success: false, message: result.reason });
            return;
        }

        const payload: TImageSignResponse = result.value;
        res.status(200).json({ success: true, data: payload });
    } catch (error) {
        console.error('POST /api/posts/images/sign error:', error);
        res.status(500).json({ success: false, message: 'failed to sign upload' });
    }
});

export default router;
