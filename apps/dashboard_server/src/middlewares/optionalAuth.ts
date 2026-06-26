// Purpose: best-effort identity resolution that NEVER rejects the request.
// Invariant: sets req.auth only when a valid token resolves a provisioned
//            users row; otherwise leaves it undefined and continues.
// Side effects: delegates DB + token verification to resolveAuth.
import { RequestHandler } from 'express';
import { resolveAuth } from './resolveAuth';

export const optionalAuth: RequestHandler = async (req, _res, next) => {
    try {
        const result = await resolveAuth(req.headers.authorization);
        if (result.kind === 'authenticated') {
            req.auth = result.identity;
        }
    } catch (error) {
        console.error('optionalAuth error (ignored):', error);
    }
    next();
};
