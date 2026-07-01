// controllers/rankings/rankings.ts
// Purpose : Read-only market-cap ranking endpoint backed by market_rankings.
//           Serves the weekly screen (global top-N + within-sector top-N) to
//           the client /rankings viewer.
// Access  : PUBLIC BY DESIGN — market-cap rankings are derived public data.
// Constraints: raw SQL, deterministic row→DTO mapping, no side effects beyond
//              pool reads. Table-absence guard yields data:null (not 500) when
//              migration 0012 has not yet been applied. `scope` is one of
//              'global' | 'sector' (the DDL CHECK constraint); the sector NAME
//              lives in the `sector` column, never in `scope`.
import { pool } from '../../database';
import { Router } from 'express';

export const router = Router();

// Weekly series — a new as_of lands once a week. Long TTL matches the client
// SSR fetch revalidate=86400; stale-while-revalidate covers the first miss
// after a new weekly run before the cache refreshes.
const RANKINGS_CACHE_CONTROL =
    'public, s-maxage=86400, stale-while-revalidate=604800';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Guard: probe whether migration 0012 (market_rankings) has been applied.
async function rankingsTablePresent(): Promise<boolean> {
    const { rows } = await pool.query<{ present: boolean }>(
        `SELECT to_regclass('public.market_rankings') IS NOT NULL AS present`
    );
    return rows[0]?.present ?? false;
}

// Row shape — only the columns we SELECT.
interface IRankingRow {
    rank: number; // INT → number
    symbol: string;
    sector: string | null;
    market_cap: string | null; // NUMERIC → string (or null on carry-forward)
}

// Pure: single ranking DTO from a row.
function toEntry(r: IRankingRow) {
    return {
        rank: r.rank,
        symbol: r.symbol,
        sector: r.sector,
        marketCap: r.market_cap === null ? null : Number(r.market_cap),
    };
}

// Pure: clamp a raw limit query param into [1, MAX_LIMIT] with a default.
function clampLimit(raw: unknown): number {
    const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n)) return DEFAULT_LIMIT;
    return Math.min(Math.max(n, 1), MAX_LIMIT);
}

/**
 * @api {get} /api/rankings Weekly market-cap ranking (latest week)
 * @apiName GetRankings
 * @apiGroup Rankings
 *
 * @apiQuery {String="global","sector"} [scope=global] Ranking scope.
 * @apiQuery {String} [sector]  Sector name (only when scope=sector; defaults to
 *                              the first available sector for the latest week).
 * @apiQuery {String} [asOf]    ISO date YYYY-MM-DD to pin a specific week; an
 *                              unknown/older date snaps to the nearest ≤ week.
 * @apiQuery {Number} [limit=50] Surfacing depth (1..200).
 *
 * @apiSuccess {Boolean}     success
 * @apiSuccess {Object|null} data  { asOf, scope, sector, sectors[],
 *                                 availableWeeks[], rows[] } or null when the
 *                                 table/weekly data is absent.
 */
router.get('/', async (req, res) => {
    try {
        const present = await rankingsTablePresent();
        if (!present) {
            res.set('Cache-Control', RANKINGS_CACHE_CONTROL);
            return res.json({ success: true, data: null });
        }

        // Resolve the target week. `asOf` pins a specific week; an unknown/older
        // date snaps to the nearest week <= requested (robust deep-links). Absent
        // → latest. ::text avoids the pg driver's local-midnight Date coercion.
        const rawAsOf = req.query.asOf;
        const requestedAsOf =
            typeof rawAsOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawAsOf)
                ? rawAsOf
                : null;
        const { rows: asOfRows } = await pool.query<{ as_of: string | null }>(
            `SELECT MAX(as_of)::text AS as_of FROM market_rankings
             WHERE ($1::date IS NULL OR as_of <= $1::date)`,
            [requestedAsOf]
        );
        let asOf = asOfRows[0]?.as_of ?? null;
        // Requested date older than the whole series → nothing <= it; fall back
        // to the latest week rather than an empty page.
        if (asOf === null && requestedAsOf !== null) {
            const { rows: latestRows } = await pool.query<{
                as_of: string | null;
            }>(`SELECT MAX(as_of)::text AS as_of FROM market_rankings`);
            asOf = latestRows[0]?.as_of ?? null;
        }
        if (asOf === null) {
            res.set('Cache-Control', RANKINGS_CACHE_CONTROL);
            return res.json({ success: true, data: null });
        }

        // Week picker options — distinct weeks, newest-first, capped (~5yr).
        const { rows: weekRows } = await pool.query<{ as_of: string }>(
            `SELECT DISTINCT as_of::text AS as_of FROM market_rankings
             ORDER BY as_of DESC
             LIMIT 260`
        );
        const availableWeeks = weekRows.map((w) => w.as_of);

        // Sector filter options for the latest week (drives the client dropdown).
        const { rows: sectorRows } = await pool.query<{ sector: string }>(
            `SELECT DISTINCT sector FROM market_rankings
             WHERE as_of = $1::date AND scope = 'sector' AND sector IS NOT NULL
             ORDER BY sector`,
            [asOf]
        );
        const sectors = sectorRows.map((s) => s.sector);

        const scope = req.query.scope === 'sector' ? 'sector' : 'global';
        const limit = clampLimit(req.query.limit);

        let entries: IRankingRow[] = [];
        let selectedSector: string | null = null;

        if (scope === 'sector') {
            // Use the requested sector if valid, else fall back to the first.
            const requested =
                typeof req.query.sector === 'string' ? req.query.sector : null;
            selectedSector =
                requested !== null && sectors.includes(requested)
                    ? requested
                    : (sectors[0] ?? null);

            if (selectedSector !== null) {
                const { rows } = await pool.query<IRankingRow>(
                    `SELECT rank, symbol, sector, market_cap
                     FROM market_rankings
                     WHERE as_of = $1::date AND scope = 'sector' AND sector = $2
                     ORDER BY rank ASC
                     LIMIT $3`,
                    [asOf, selectedSector, limit]
                );
                entries = rows;
            }
        } else {
            const { rows } = await pool.query<IRankingRow>(
                `SELECT rank, symbol, sector, market_cap
                 FROM market_rankings
                 WHERE as_of = $1::date AND scope = 'global'
                 ORDER BY rank ASC
                 LIMIT $2`,
                [asOf, limit]
            );
            entries = rows;
        }

        res.set('Cache-Control', RANKINGS_CACHE_CONTROL);
        res.json({
            success: true,
            data: {
                asOf,
                scope,
                sector: selectedSector,
                sectors,
                availableWeeks,
                rows: entries.map(toEntry),
            },
        });
    } catch (error) {
        console.error('API Error fetching rankings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch rankings',
        });
    }
});
