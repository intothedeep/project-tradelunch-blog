// Purpose: gate a route behind a verified, provisioned Clerk identity.
// Invariants: 401 = no/invalid token; 403 = valid token but no users row.
//             Never surfaces 500 for the unprovisioned case.
// Side effects: delegates DB + token verification to resolveAuth.
import { RequestHandler } from 'express';
import { resolveAuth } from './resolveAuth';

export const requireAuth: RequestHandler = async (req, res, next) => {
    try {
        const result = await resolveAuth(req.headers.authorization);

        if (result.kind === 'anonymous') {
            res.status(401).json({ success: false, message: 'unauthorized' });
            return;
        }
        if (result.kind === 'unprovisioned') {
            res.status(403).json({
                success: false,
                message: 'account not provisioned',
            });
            return;
        }

        req.auth = result.identity;
        next();
    } catch (error) {
        console.error('requireAuth error:', error);
        res.status(500).json({ success: false, message: 'auth failure' });
    }
};
