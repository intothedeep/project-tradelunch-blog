// controllers/dashboard/dashboard.ts
// Purpose : Read-only market dashboard endpoints backed by market_snapshots /
//           market_history. Shapes match the client contract in
//           dashboard_client_web/types/{dashboard,history}.ts.
// Access  : PUBLIC BY DESIGN — generic market data, not user-scoped. These
//           routes intentionally carry no auth middleware (no optionalAuth/
//           requireAuth); callers forward no Clerk token. If the dashboard ever
//           becomes per-user, add optionalAuth here and forward a token from
//           the client Server Actions.
// Constraints: raw SQL, deterministic row→DTO mapping, no side effects beyond
//              pool reads. Domain shaping is done by pure helpers below.
import { pool } from '../../database';
import { Router, Request } from 'express';

export const router = Router();

type TCategory = 'fx' | 'crypto' | 'indices' | 'rates' | 'stocks';

const CATEGORIES: readonly TCategory[] = [
    'fx',
    'crypto',
    'indices',
    'rates',
    'stocks',
];

// Edge-CDN cache policy (validated by system-architect). Data mutates once/day
// at 21:30 UTC (collector cron), so both endpoints lean on s-maxage + a generous
// stale-while-revalidate: callers never wait on origin, correctness is preserved
// by the background refresh. NOTE: the SSR fetch wrapper sets next.revalidate to
// the SAME ttl per endpoint, or the two cache layers expire out of phase.
const SNAPSHOT_CACHE_CONTROL =
    'public, s-maxage=1800, stale-while-revalidate=86400'; // 30min fresh / 24h stale
const HISTORY_CACHE_CONTROL =
    'public, s-maxage=43200, stale-while-revalidate=604800'; // 12h fresh / 7d stale

// `range` -> lookback window in days. Whitelisted (no user value reaches SQL):
// an unknown value falls back to '1y'; 'max' (null) drops the date filter.
// Kept small + finite so the per-URL edge cache stays at ~labels × ranges keys.
const RANGE_DAYS: Record<string, number | null> = {
    '1m': 31,
    '3m': 93,
    '6m': 186,
    '1y': 366,
    '5y': 1830,
    max: null,
};
const DEFAULT_RANGE = '1y';

interface ISnapshotRow {
    category: TCategory;
    label: string;
    ticker: string | null;
    exchange: string | null;
    value: string;
    change_absolute: string;
    change_percent: string;
    as_of: Date;
    revalidate_seconds: number;
    fetched_at: Date;
}

interface IHistoryRow {
    bar_time: Date;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
}

// Pure: build a single dashboard item DTO from a snapshot row.
function toItem(row: ISnapshotRow) {
    const base = {
        label: row.label,
        value: Number(row.value),
        change: {
            absolute: Number(row.change_absolute),
            percent: Number(row.change_percent),
        },
    };
    if (row.category === 'stocks') {
        return { ...base, ticker: row.ticker ?? '', exchange: row.exchange };
    }
    return base;
}

// Pure: group snapshot rows into the IDashboardSnapshot shape.
function toSnapshot(rows: ISnapshotRow[]) {
    const fetchedAt = rows.length
        ? rows[0]!.fetched_at.toISOString()
        : new Date(0).toISOString();

    const snapshot: Record<string, unknown> = { fetchedAt };

    for (const category of CATEGORIES) {
        const categoryRows = rows.filter((r) => r.category === category);
        const meta = categoryRows.length
            ? {
                  asOf: categoryRows[0]!.as_of.toISOString(),
                  revalidateSeconds: categoryRows[0]!.revalidate_seconds,
              }
            : { asOf: fetchedAt, revalidateSeconds: 0 };
        snapshot[category] = { meta, items: categoryRows.map(toItem) };
    }

    return snapshot;
}

// Pure: build IItemOHLCHistory from history rows.
function toOHLCHistory(label: string, rows: IHistoryRow[]) {
    return {
        label,
        candles: rows.map((r) => ({
            time: r.bar_time.toISOString().slice(0, 10),
            open: Number(r.open),
            high: Number(r.high),
            low: Number(r.low),
            close: Number(r.close),
            volume: Number(r.volume),
        })),
    };
}

/**
 * @api {get} /api/dashboard/snapshot Get the full market snapshot
 * @apiName GetDashboardSnapshot
 * @apiGroup Dashboard
 *
 * @apiSuccess {Boolean} success
 * @apiSuccess {Object}  data  IDashboardSnapshot (categories + meta + fetchedAt)
 */
router.get('/snapshot', async (_req, res) => {
    try {
        const { rows } = await pool.query<ISnapshotRow>(
            `SELECT category, label, ticker, exchange, value,
                    change_absolute, change_percent, as_of,
                    revalidate_seconds, fetched_at
             FROM market_snapshots
             ORDER BY category, seq`
        );

        res.set('Cache-Control', SNAPSHOT_CACHE_CONTROL);
        res.json({ success: true, data: toSnapshot(rows) });
    } catch (error) {
        console.error('API Error fetching dashboard snapshot:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard snapshot',
        });
    }
});

/**
 * @api {get} /api/dashboard/history Get OHLC history for one item
 * @apiName GetDashboardHistory
 * @apiGroup Dashboard
 *
 * @apiQuery {String} label    Item label (e.g. "Apple").
 * @apiQuery {String} [interval=1d] Candle interval.
 * @apiQuery {String} [range=1y] Lookback window: 1m|3m|6m|1y|5y|max. Default 1y
 *           keeps the chart payload light now that the DB holds full history;
 *           pass range=max for the entire series on demand.
 *
 * @apiSuccess {Boolean} success
 * @apiSuccess {Object|null} data IItemOHLCHistory, or null for an unknown label.
 */
router.get(
    '/history',
    async (
        req: Request<
            {},
            {},
            {},
            { label?: string; interval?: string; range?: string }
        >,
        res
    ) => {
        try {
            const label = req.query.label;
            const interval = req.query.interval || '1d';
            const range = req.query.range || DEFAULT_RANGE;

            if (!label) {
                return res.json({ success: true, data: null });
            }

            // Whitelisted lookback -> a from-date param, or null for 'max'.
            const days = range in RANGE_DAYS ? RANGE_DAYS[range] : RANGE_DAYS[DEFAULT_RANGE];
            const fromDate =
                days === null
                    ? null
                    : new Date(Date.now() - days * 86_400_000).toISOString();

            const params: (string | null)[] = [label, interval];
            let where = 'WHERE label = $1 AND interval = $2';
            if (fromDate !== null) {
                params.push(fromDate);
                where += ' AND bar_time >= $3';
            }

            const { rows } = await pool.query<IHistoryRow>(
                `SELECT bar_time, open, high, low, close, volume
                 FROM market_history
                 ${where}
                 ORDER BY bar_time ASC`,
                params
            );

            if (rows.length === 0) {
                return res.json({ success: true, data: null });
            }

            res.set('Cache-Control', HISTORY_CACHE_CONTROL);
            res.json({ success: true, data: toOHLCHistory(label, rows) });
        } catch (error) {
            console.error('API Error fetching dashboard history:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard history',
            });
        }
    }
);
