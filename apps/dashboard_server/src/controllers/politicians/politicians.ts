// controllers/politicians/politicians.ts
// Purpose: Read-only per-politician profile (Q6.2).
//   GET /v1/api/politicians/:filerId
//   Returns filer metadata (politician_registry + 0023 aggregates), all
//   tickers they disclosed trading (v_politician_ticker_holders), and a
//   quarterly PTR timeline (v_politician_filer_timeline).
// Invariants:
//   - filerId validated with slug regex before any DB hit.
//   - Presence-guarded: absent politician_registry / views → { data: null }.
//   - Unknown filerId (no registry row) → { data: null }, never 500.
//   - Dollar amounts (est_volume, disclosed_value_usd) coarsened to bands —
//     never exact numbers in the response (PTR honesty contract).
//   - sharePctOfFilerVolume / rankInFilerVolume = honest PTR transaction
//     volume proxies, NOT portfolio weights or holdings.
//   - timeline volume-guard: <2 distinct quarters → timeline: [] (avoids a
//     1-point chart; pre-backfill most filers will return []).
//   - All aggregates in politician_registry are "as reported by kadoa source".
// Constraints: raw SQL, no ORM, no side effects beyond pool reads.

import { pool } from '../../database';
import { Router } from 'express';
import { toValueBand } from '../../helpers/valueBand';
import { getFilerTickerShares } from '../../helpers/politicianHolderShares';

export const router = Router();

const FUNDS_CACHE_CONTROL =
    'public, s-maxage=86400, stale-while-revalidate=604800';

// Slug: lowercase letters, digits, underscores (kadoa filer_id format).
const FILER_ID_RE = /^[a-z0-9_]+$/;

// --- Presence probe ---

interface IRawPresence {
    has_registry: boolean;
    has_ticker_holders: boolean;
    has_timeline: boolean;
}

async function probePresence(): Promise<{
    hasRegistry: boolean;
    hasTickerHolders: boolean;
    hasTimeline: boolean;
}> {
    const { rows } = await pool.query<IRawPresence>(
        `SELECT to_regclass('public.politician_registry')          IS NOT NULL AS has_registry,
                to_regclass('public.v_politician_ticker_holders')  IS NOT NULL AS has_ticker_holders,
                to_regclass('public.v_politician_filer_timeline')  IS NOT NULL AS has_timeline`
    );
    return {
        hasRegistry:       rows[0]?.has_registry       ?? false,
        hasTickerHolders:  rows[0]?.has_ticker_holders ?? false,
        hasTimeline:       rows[0]?.has_timeline        ?? false,
    };
}

// --- DB row shapes ---

interface IFilerRow {
    filer_id: string;
    filer_name: string;
    party: string | null;
    chamber: string | null;
    state: string | null;
    office: string | null;
    photo_url: string | null;
    trade_count: number | null;
    purchases: number | null;
    sales: number | null;
    late_filings: number | null;
    est_volume: string | null; // BIGINT
}

interface IHolderRow {
    ticker: string;
    disclosed_value_usd: string | null;
    trade_count: string;
    net_direction: string;
    latest_disclosure: Date | string;
}

interface ITimelineRow {
    quarter: Date | string;
    ticker: string;
    net_value_usd: string;
    direction: string;
}

function toIsoDate(d: Date | string): string {
    return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

/**
 * @api {get} /v1/api/politicians/:filerId Per-politician profile
 * @apiSuccess {Object|null} data  { filer, tickers[], timeline[] } or null
 */
router.get('/:filerId', async (req, res) => {
    try {
        res.set('Cache-Control', FUNDS_CACHE_CONTROL);
        const { filerId } = req.params;

        if (!FILER_ID_RE.test(filerId)) {
            return res.json({ success: true, data: null });
        }

        const { hasRegistry, hasTickerHolders, hasTimeline } = await probePresence();

        if (!hasRegistry) {
            return res.json({ success: true, data: null });
        }

        // Query A — filer registry row (includes 0023 aggregate columns).
        const { rows: filerRows } = await pool.query<IFilerRow>(
            `SELECT filer_id, filer_name, party, chamber, state, office,
                    photo_url, trade_count, purchases, sales, late_filings, est_volume
               FROM politician_registry
              WHERE filer_id = $1 AND deleted_at IS NULL
              LIMIT 1`,
            [filerId]
        );

        if (filerRows.length === 0) {
            return res.json({ success: true, data: null });
        }

        const f = filerRows[0];
        const filer = {
            filerId: f.filer_id,
            filerName: f.filer_name,
            party: f.party,
            chamber: f.chamber,
            state: f.state,
            office: f.office,
            photoUrl: f.photo_url,
            tradeCount: f.trade_count,
            purchases: f.purchases,
            sales: f.sales,
            lateFilings: f.late_filings,
            /** Coarse band — "as reported by kadoa source" */
            estVolumeBand: toValueBand(f.est_volume === null ? null : Number(f.est_volume)),
        };

        // Query B — tickers from v_politician_ticker_holders (presence-guarded).
        let tickers: Array<{
            ticker: string;
            disclosedValueBand: ReturnType<typeof toValueBand>;
            sharePctOfFilerVolume: number | null;
            rankInFilerVolume: number | null;
            totalTickerCount: number | null;
            netDirection: string;
            latestDisclosure: string;
            tradeCount: number;
        }> = [];

        if (hasTickerHolders) {
            const { rows: hRows } = await pool.query<IHolderRow>(
                `SELECT ticker, disclosed_value_usd, trade_count, net_direction, latest_disclosure
                   FROM v_politician_ticker_holders
                  WHERE filer_id = $1
                  ORDER BY disclosed_value_usd DESC NULLS LAST`,
                [filerId]
            );

            if (hRows.length > 0) {
                const shareMap = await getFilerTickerShares(filerId);

                tickers = hRows.map((h) => {
                    const share = shareMap.get(h.ticker);
                    return {
                        ticker: h.ticker,
                        disclosedValueBand: toValueBand(
                            h.disclosed_value_usd === null ? null : Number(h.disclosed_value_usd)
                        ),
                        sharePctOfFilerVolume: share?.sharePctOfFilerVolume ?? null,
                        rankInFilerVolume: share?.rankInFilerVolume ?? null,
                        totalTickerCount: share?.totalTickerCount ?? null,
                        netDirection: h.net_direction,
                        latestDisclosure: toIsoDate(h.latest_disclosure),
                        tradeCount: Number(h.trade_count),
                    };
                });
            }
        }

        // Query C — quarterly timeline (presence-guarded).
        // Volume-guard: <2 distinct quarters → return [].
        let timeline: Array<{
            quarter: string;
            ticker: string;
            netValueBand: ReturnType<typeof toValueBand>;
            direction: string;
        }> = [];

        if (hasTimeline) {
            const { rows: tRows } = await pool.query<ITimelineRow>(
                `SELECT quarter, ticker, net_value_usd, direction
                   FROM v_politician_filer_timeline
                  WHERE filer_id = $1
                  ORDER BY quarter ASC, ticker ASC`,
                [filerId]
            );

            const distinctQuarters = new Set(tRows.map((r) => toIsoDate(r.quarter)));
            if (distinctQuarters.size >= 2) {
                timeline = tRows.map((t) => ({
                    quarter: toIsoDate(t.quarter),
                    ticker: t.ticker,
                    netValueBand: toValueBand(Math.abs(Number(t.net_value_usd))),
                    direction: t.direction,
                }));
            }
        }

        return res.json({
            success: true,
            data: { filer, tickers, timeline },
        });
    } catch {
        res.set('Cache-Control', FUNDS_CACHE_CONTROL);
        return res.json({ success: true, data: null });
    }
});
