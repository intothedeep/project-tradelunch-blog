// middlewares/blockCrawlers.ts
// Purpose: User-Agent bot/crawler filter for the DB-backed finance API routers
//   (funds / securities / rankings / politicians / dashboard). Those endpoints
//   are the Supabase-egress surface; crawlers have no reason to hit them
//   directly. Legit SSR calls arrive with the Next server's own UA (not a bot
//   UA), so they pass — only direct crawler/scraper hits are 403'd BEFORE any
//   DB query, cutting bot-driven egress.
// Invariants:
//   - Never touches DB / does no I/O — a pure header check.
//   - UA is SPOOFABLE: this stops honest bots (the egress bulk), not a
//     determined scraper faking a browser UA. Pair with response caching for
//     the residual. Blog routes are NOT gated here (Googlebot still indexes).
//   - Empty UA is allowed through (too broad a signal; avoid blocking legit
//     health-checks / server-to-server callers).

import type { Request, Response, NextFunction } from 'express';

// Search + AI + SEO crawlers. `\bbot\b`-style tokens plus named offenders.
const BOT_UA_RE =
    /bot\b|crawler|spider|crawling|slurp|googlebot|bingbot|duckduckbot|baiduspider|yandex|sogou|gptbot|chatgpt|ccbot|claudebot|anthropic|bytespider|perplexity|amazonbot|applebot|meta-externalagent|facebookexternalhit|semrush|ahrefs|mj12bot|dotbot|dataforseo|scrapy/i;

export function blockCrawlers(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const ua = req.get('user-agent') ?? '';
    if (ua !== '' && BOT_UA_RE.test(ua)) {
        res.status(403).json({
            success: false,
            error: 'crawlers not permitted',
        });
        return;
    }
    next();
}
