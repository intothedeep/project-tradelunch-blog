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
 *
 * @apiSuccess {Boolean} success
 * @apiSuccess {Object|null} data IItemOHLCHistory, or null for an unknown label.
 */
router.get(
    '/history',
    async (
        req: Request<{}, {}, {}, { label?: string; interval?: string }>,
        res
    ) => {
        try {
            const label = req.query.label;
            const interval = req.query.interval || '1d';

            if (!label) {
                return res.json({ success: true, data: null });
            }

            const { rows } = await pool.query<IHistoryRow>(
                `SELECT bar_time, open, high, low, close, volume
                 FROM market_history
                 WHERE label = $1 AND interval = $2
                 ORDER BY bar_time ASC`,
                [label, interval]
            );

            if (rows.length === 0) {
                return res.json({ success: true, data: null });
            }

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
