// Purpose: Follow/unfollow routes (Phase Y-M2).
//   POST /follow/:username — toggle follow on a user by username (requireAuth).
//
// Auth rules:
//   * requireAuth on every route — anonymous access rejected with 401.
//   * Self-follow returns 400 (also enforced by DB CHECK constraint).
//   * Unknown username returns 404.
//
// Feature-guard: when migration 0024 has not been applied (follows table absent),
//   toggle returns 503. Keeps existing test suite green.
//
// Invariants:
//   * BIGINT ids are STRINGS end-to-end. userId is resolved from username via
//     users table and passed as a number to the helper (PG bound as int8).
//   * sendOk/sendError from helpers/response (shared { success, data } envelope).
//   * Touches only follows and users tables.
// Side effects: DB reads/writes via pool.
import { Router } from 'express';
import { pool } from '../../database';
import { requireAuth } from '../../middlewares/requireAuth';
import { sendOk, sendError } from '../../helpers/response';
import { toggleFollow } from '../../helpers/follows';

export const followsRouter = Router();

// POST /follow/:username — toggle follow on a user identified by username.
followsRouter.post('/:username', requireAuth, async (req, res) => {
    try {
        const targetUsername = String(req.params.username);

        // Resolve username → user id.
        const { rows } = await pool.query<{ id: string }>(
            `SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL`,
            [targetUsername]
        );
        if (rows.length === 0) {
            sendError(res, 404, 'user not found');
            return;
        }

        const targetId = Number(rows[0]!.id);
        const callerId = req.auth!.userId;

        // Self-follow guard (also enforced at DB level via CHECK constraint).
        if (callerId === targetId) {
            sendError(res, 400, 'cannot follow yourself');
            return;
        }

        const result = await toggleFollow(pool, callerId, targetId);
        if (result === null) {
            sendError(
                res,
                503,
                'follow feature not available (migration pending)'
            );
            return;
        }
        sendOk(res, result);
    } catch (error) {
        const err = error as { code?: string };
        if (err.code === 'SELF_FOLLOW') {
            sendError(res, 400, 'cannot follow yourself');
            return;
        }
        console.error('POST /api/follow/:username error:', error);
        sendError(res, 500, 'failed to toggle follow');
    }
});
