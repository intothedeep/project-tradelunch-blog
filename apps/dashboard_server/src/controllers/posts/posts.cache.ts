// Purpose: one Cache-Control policy for the public post read routes.
// WHY (2026-09-23, Vercel 402 outage): the Express project blew its quota because
// every Next render fans out 1–4 calls here and none of them were edge-cacheable.
// Anonymous responses are viewer-agnostic, so the edge may share them. TTL is
// 24h by OWNER DECISION (same as the Cloudflare edge policy): after publishing,
// the Vercel edge copy is cleared by redeploying Express (cf-purge.sh does NOT
// reach it; once blogapi is behind the Cloudflare proxy, it will).
// Authenticated responses can carry an owner's drafts or viewerLiked, so they
// must never enter a shared cache.
import type { Request, Response } from 'express';

const PUBLIC_POST_CACHE = 'public, s-maxage=86400';

export function setPostReadCache(req: Request, res: Response): void {
    res.setHeader(
        'Cache-Control',
        req.auth ? 'private, no-store' : PUBLIC_POST_CACHE
    );
    // Keeps an edge from answering a token-bearing request with the anon copy.
    res.setHeader('Vary', 'Authorization');
}
