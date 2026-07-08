// controllers/dashboard/seriesBatch.ts
// Purpose: one-round-trip batch price-series fetch for multiple labels.
// Feeds the client backtest engine (Phase X). User input never reaches raw SQL —
// labels is whitelisted by count/trim, from/to validated against ISO_DATE_RE.
// Access: PUBLIC (no auth) — same posture as /history; blockCrawlers applied at
// the dashboard mount point in controllers/index.ts.
// Cache-Control: identical to /history (12h fresh / 7d stale).

import { pool } from '../../database';
import { Router, Request } from 'express';

export const router = Router();

const MAX_LABELS = 15;

// Same 12h/7d policy as the /history endpoint — data mutates once/day at the
// daily cron boundary; edge-CDN serves stale while origin refreshes silently.
const BATCH_CACHE_CONTROL =
    'public, s-maxage=43200, stale-while-revalidate=604800';

// Accepts YYYY-MM-DD only; rejects any time component or non-date strings.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface ISeriesRow {
    label: string;
    bar_time: Date;
    close: string;
    dividends: string;
    stock_splits: string;
}

interface ISeriesBar {
    date: string;
    close: number;
    dividends: number;
    stockSplits: number;
}

// Pure: fold flat SQL rows into a per-label map.
// Relies on ORDER BY label, bar_time from the query; safe even if order varies.
function toSeriesMap(rows: ISeriesRow[]): Record<string, ISeriesBar[]> {
    const map: Record<string, ISeriesBar[]> = {};
    for (const row of rows) {
        const bar: ISeriesBar = {
            date: row.bar_time.toISOString().slice(0, 10),
            close: Number(row.close),
            dividends: Number(row.dividends),
            stockSplits: Number(row.stock_splits),
        };
        if (!map[row.label]) map[row.label] = [];
        map[row.label]!.push(bar);
    }
    return map;
}

/**
 * @api {get} /api/dashboard/history/batch Batch price-series for N labels
 * @apiGroup Dashboard
 *
 * @apiQuery {String} labels  Comma-separated label list; ≤15; trimmed.
 * @apiQuery {String} from    ISO date YYYY-MM-DD (inclusive range start).
 * @apiQuery {String} to      ISO date YYYY-MM-DD (inclusive range end).
 *
 * @apiSuccess {Boolean} success
 * @apiSuccess {Object}  data  { series: Record<label, ISeriesBar[]> }
 *            Labels with no data in the range are absent from the map (not an error).
 */
router.get(
    '/history/batch',
    async (
        req: Request<
            {},
            {},
            {},
            { labels?: string; from?: string; to?: string }
        >,
        res
    ) => {
        try {
            const { labels: rawLabels, from, to } = req.query;

            if (!rawLabels || !from || !to) {
                return res.status(400).json({
                    success: false,
                    message: 'labels, from, and to are required',
                });
            }

            if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
                return res.status(400).json({
                    success: false,
                    message: 'from and to must be ISO dates (YYYY-MM-DD)',
                });
            }

            const labels = rawLabels
                .split(',')
                .map((l) => l.trim())
                .filter(Boolean);

            if (labels.length === 0 || labels.length > MAX_LABELS) {
                return res.status(400).json({
                    success: false,
                    message: `labels must contain 1–${MAX_LABELS} entries`,
                });
            }

            // Single round-trip: label = ANY($1::text[]) avoids N individual queries.
            // $1 = labels array, $2 = from date, $3 = to date — no user string interpolation.
            const { rows } = await pool.query<ISeriesRow>(
                `SELECT label, bar_time, close, dividends, stock_splits
                 FROM market_history
                 WHERE interval = '1d'
                   AND label = ANY($1::text[])
                   AND bar_time >= $2
                   AND bar_time <= $3
                 ORDER BY label, bar_time ASC`,
                [labels, from, to]
            );

            res.set('Cache-Control', BATCH_CACHE_CONTROL);
            res.json({ success: true, data: { series: toSeriesMap(rows) } });
        } catch (error) {
            console.error('API Error fetching batch price series:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch batch price series',
            });
        }
    }
);
