// Purpose: owner-scoped category creation route (POST /v1/api/categories).
//          Gated by requireAuth; acts ONLY on req.auth.userId (a client-supplied
//          user id is never trusted). Create + placement run in one transaction.
// Invariants:
//   * Author of a created category is req.auth.userId, always.
//   * Conflict scope is (user_id, parent_id, title) — an ACTIVE duplicate yields
//     409 with the existing node; a soft-deleted one is resurrected (201).
//   * title is lowercase-normalized by validateCategoryInput.
// HTTP map: 201 created · 409 conflict (+ existing node) · 400 invalid body or
//           bad/unowned parent · 401 (requireAuth) · 500 unexpected.
// Side effects: DB writes via createCategory inside a transaction.
import { Router } from 'express';
import { pool } from '../../database';
import { requireAuth } from '../../middlewares/requireAuth';
import { validateCategoryInput } from '../../helpers/validateCategoryInput';
import { createCategory, CategoryParentError } from '../../helpers/writeCategory';

export const router = Router();

router.post('', requireAuth, async (req, res) => {
    const parsed = validateCategoryInput(req.body);
    if (parsed.ok === false) {
        res.status(400).json({ success: false, message: parsed.reason });
        return;
    }

    const userId = req.auth!.userId;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await createCategory(client, userId, parsed.value);
        await client.query('COMMIT');

        if (result.status === 'conflict') {
            res.status(409).json({
                success: false,
                message: 'category already exists',
                data: result.node,
            });
            return;
        }
        res.status(201).json({ success: true, data: result.node });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof CategoryParentError) {
            res.status(400).json({ success: false, message: error.message });
            return;
        }
        console.error('POST /api/categories error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to create category',
        });
    } finally {
        client.release();
    }
});

export default router;
