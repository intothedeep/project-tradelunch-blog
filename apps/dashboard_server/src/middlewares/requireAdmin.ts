// Purpose: requireAuth, then assert the resolved identity is an admin.
// Invariant: non-admin authenticated user → 403.
// Side effects: none beyond the composed requireAuth.
import { RequestHandler } from 'express';
import { requireAuth } from './requireAuth';

const assertAdmin: RequestHandler = (req, res, next) => {
    if (!req.auth?.isAdmin) {
        res.status(403).json({ success: false, message: 'admin only' });
        return;
    }
    next();
};

export const requireAdmin: RequestHandler[] = [requireAuth, assertAdmin];
