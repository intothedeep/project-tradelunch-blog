// Purpose: owner-scoped authoring routes for posts (create / update / soft-delete)
//          plus image upload. All routes are gated by requireAuth and act
//          ONLY on req.auth.userId — a client-supplied user_id is never trusted.
// Invariants:
//   * The author of a created post is req.auth.userId, always.
//   * PATCH/DELETE match WHERE id=$1 AND user_id=$caller AND deleted_at IS NULL,
//     so a non-owner gets 404 (never a cross-author mutation).
//   * COALESCE update semantics (see helpers/writePost.ts): a PATCH can change a
//     field or leave it untouched, but CANNOT null out an existing value.
// Side effects: DB writes via the writePost helpers; sharp resize + one network
//          upload to the active storage provider on the image route.
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
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
import { syncPostTags } from '../../helpers/writePostTags';
import { buildImagePath } from '../../helpers/imagePath';
import { transformImage } from '../../helpers/transformImage';
import { getStorageProvider, isStorageConfigured } from '../../lib/storage/factory';
import { buildPublicUrl } from '../../lib/storage/publicUrl';
import {
    SUPABASE_URL,
    CDN_ASSETS,
} from '../../config/env.schema';
import type { TImageUploadResponse, TPostStatus } from '@repo/types';

export const router = Router();

// In-memory upload: the buffer is handed straight to sharp, never to disk. The
// 5MB route cap is the transport ceiling (Vercel's body limit is ~4.5MB; the
// client pre-resizes below it). The authoritative size check is transformImage.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});

// Wrap upload.single so a multer LIMIT_FILE_SIZE maps to 413 instead of bubbling
// to a generic 500. Other multer errors are 400 (malformed multipart).
function uploadSingleFile(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    upload.single('file')(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
            const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            const message =
                err.code === 'LIMIT_FILE_SIZE'
                    ? 'file too large'
                    : 'invalid upload';
            res.status(status).json({ success: false, message });
            return;
        }
        if (err) {
            res.status(400).json({ success: false, message: 'invalid upload' });
            return;
        }
        next();
    });
}

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
                    { cdnBase: thumbnailCdnBase }
                );
            }
            // Tag set: undefined = leave untouched; an array (incl. empty)
            // replaces the post's whole tag set. Shares this transaction.
            if (input.tags !== undefined) {
                await syncPostTags(client, row.id, input.tags);
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
        res.status(500).json({
            success: false,
            message: 'failed to create post',
        });
    }
});

router.patch('/:postid', requireAuth, async (req, res) => {
    try {
        // BIGINT id: keep it a string (never parseInt — JS numbers lose
        // precision past 2^53 and would target the wrong row).
        const postId = String(req.params.postid);
        if (!/^\d+$/.test(postId)) {
            res.status(400).json({
                success: false,
                message: 'invalid post id',
            });
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
            row = await updatePost(
                client,
                userId,
                postId,
                input,
                req.auth!.isAdmin
            );
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
                    { cdnBase: thumbnailCdnBase }
                );
            }
            // Tag set: undefined = leave untouched; an array (incl. empty)
            // replaces the post's whole tag set. Shares this transaction.
            if (input.tags !== undefined) {
                await syncPostTags(client, row.id, input.tags);
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
        res.status(500).json({
            success: false,
            message: 'failed to update post',
        });
    }
});

router.delete('/:postid', requireAuth, async (req, res) => {
    try {
        // BIGINT id: keep it a string (never parseInt — see PATCH above).
        const postId = String(req.params.postid);
        if (!/^\d+$/.test(postId)) {
            res.status(400).json({
                success: false,
                message: 'invalid post id',
            });
            return;
        }

        const deletedId = await softDeletePost(
            pool,
            req.auth!.userId,
            postId,
            req.auth!.isAdmin
        );
        if (deletedId === null) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }

        res.json({ success: true, data: { id: deletedId } });
    } catch (error) {
        console.error('DELETE /api/posts/:postid error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to delete post',
        });
    }
});

// Browser → Express (multipart) → sharp resize/normalize → provider.put().
// The browser never talks to storage directly; the provider is selected by env.
router.post('/images', requireAuth, uploadSingleFile, async (req, res) => {
    try {
        if (!isStorageConfigured()) {
            res.status(503).json({
                success: false,
                message: 'storage not configured',
            });
            return;
        }

        if (!req.file) {
            res.status(400).json({
                success: false,
                message: 'file is required',
            });
            return;
        }

        const transformed = await transformImage(req.file.buffer, {
            longEdge: 1600,
            quality: 80,
            maxBytes: 3 * 1024 * 1024,
        });
        if (transformed.ok === false) {
            if (transformed.reason === 'not_an_image') {
                res.status(415).json({
                    success: false,
                    message: 'unsupported media type',
                });
                return;
            }
            res.status(413).json({ success: false, message: 'file too large' });
            return;
        }

        // Impure uniqueness suffix lives here, not in the pure path builder.
        const uniqueSuffix = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;
        const key = buildImagePath(
            req.auth!.userId,
            req.file.originalname || 'image',
            uniqueSuffix,
            'webp'
        );

        const provider = getStorageProvider();
        try {
            await provider.put(key, transformed.value.buffer, 'image/webp', {
                upsert: false,
            });
        } catch {
            res.status(502).json({
                success: false,
                message: 'storage upload failed',
            });
            return;
        }

        const publicUrl = buildPublicUrl(CDN_ASSETS, key);

        const payload: TImageUploadResponse = { publicUrl };
        res.status(200).json({ success: true, data: payload });
    } catch (error) {
        console.error('POST /api/posts/images error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to upload image',
        });
    }
});

export default router;
