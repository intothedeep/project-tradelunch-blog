// controllers/funds/funds.ts
// Purpose : Read-only SEC 13F holdings endpoints backed by sec_filings /
//           sec_holdings. Shapes serve the Phase K funds viewer on the client.
// Access  : PUBLIC BY DESIGN — institutional holdings are public SEC data.
//           No auth middleware needed; if scoped per-user later, add optionalAuth.
// Constraints: raw SQL, deterministic row→DTO mapping, no side effects beyond
//              pool reads. Table-absence guard yields empty data (not 500) when
//              migration 0017 has not yet been applied.
import { pool } from '../../database';
import { Router } from 'express';

export const router = Router();

// 13F filings are published monthly (quarterly as-of). Long TTL matches the
// client SSR fetch revalidate=86400. stale-while-revalidate covers collector
// latency on the first miss after a new filing is ingested.
const FUNDS_CACHE_CONTROL =
    'public, s-maxage=86400, stale-while-revalidate=604800';

// Brief edge cache on 5xx so a hot error loop (e.g. DB blip) does not re-hit the
// origin on every request. Short TTL keeps a fixed backend from staying masked.
const ERROR_CACHE_CONTROL = 'public, s-maxage=10';

// Runaway guard on holdings rows. weight_pct uses SUM(value_usd) OVER () which
// is computed over the FULL matched set before LIMIT, so weights stay correct;
// LIMIT only truncates the smallest tail positions of pathologically large
// filers. No real 13F fund is meaningfully affected — this bounds worst-case
// payload, not normal output.
const MAX_HOLDINGS = 5000;

// Guard: probe whether migration 0017 has been applied.
// Returns false if either table is missing; callers return empty data, not 500.
async function holdingsTablesPresent(): Promise<boolean> {
    const { rows } = await pool.query<{ present: boolean }>(
        `SELECT to_regclass('public.sec_filings') IS NOT NULL
             AND to_regclass('public.sec_holdings') IS NOT NULL AS present`
    );
    return rows[0]?.present ?? false;
}

// Row shapes — only the columns we SELECT, not the full table definition.
interface IFundRow {
    cik: string;
    filer: string | null;
    period_of_report: Date;
    holdings_count: string; // COUNT() comes back as string from pg driver
}

interface IHoldingRow {
    cusip: string;
    name_of_issuer: string;
    title_of_class: string | null;
    ticker: string | null;
    shares: string | null; // BIGINT → string
    prn_type: string;
    value_usd: string; // BIGINT → string
    put_call: string;
    period_of_report: Date;
    weight_pct: string | null;
    filer: string | null;
}

// Pure: single fund DTO from a fund-list row.
function toFund(r: IFundRow) {
    return {
        cik: r.cik,
        label: r.filer ?? r.cik,
        periodOfReport: r.period_of_report.toISOString().slice(0, 10),
        holdingsCount: Number(r.holdings_count),
    };
}

// Pure: single holding DTO from a holdings row.
function toHolding(r: IHoldingRow) {
    return {
        cusip: r.cusip,
        nameOfIssuer: r.name_of_issuer,
        titleOfClass: r.title_of_class,
        ticker: r.ticker,
        shares: r.shares === null ? null : Number(r.shares),
        prnType: r.prn_type,
        valueUsd: Number(r.value_usd),
        putCall: r.put_call,
        weightPct: r.weight_pct === null ? null : Number(r.weight_pct),
    };
}

// Pure: fund holdings envelope from holdings rows + metadata.
function toFundHoldings(
    cik: string,
    label: string,
    period: string,
    rows: IHoldingRow[]
) {
    return {
        cik,
        label,
        periodOfReport: period,
        holdings: rows.map(toHolding),
    };
}

/**
 * @api {get} /api/funds Get all funds with non-deleted data (latest period only)
 * @apiName GetFunds
 * @apiGroup Funds
 *
 * @apiSuccess {Boolean} success
 * @apiSuccess {Array}   data  Array of { cik, label, periodOfReport, holdingsCount }
 */
router.get('/', async (_req, res) => {
    try {
        const present = await holdingsTablesPresent();
        if (!present) {
            res.set('Cache-Control', FUNDS_CACHE_CONTROL);
            return res.json({ success: true, data: [] });
        }

        const { rows } = await pool.query<IFundRow>(
            `WITH latest AS (
               SELECT cik, MAX(period_of_report) AS period
               FROM sec_filings WHERE deleted_at IS NULL GROUP BY cik
             )
             SELECT f.cik, f.filer, l.period AS period_of_report,
                    COUNT(h.cusip) AS holdings_count
             FROM latest l
             JOIN sec_filings f
               ON f.cik = l.cik AND f.period_of_report = l.period AND f.deleted_at IS NULL
             LEFT JOIN sec_holdings h
               ON h.cik = f.cik AND h.accession = f.accession AND h.deleted_at IS NULL
             GROUP BY f.cik, f.filer, l.period
             ORDER BY f.filer NULLS LAST, f.cik`
        );

        res.set('Cache-Control', FUNDS_CACHE_CONTROL);
        res.json({ success: true, data: rows.map(toFund) });
    } catch (error) {
        console.error('API Error fetching fund list:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch fund list',
        });
    }
});

/**
 * @api {get} /api/funds/:cik Holdings for one fund (defaults to latest period)
 * @apiName GetFundHoldings
 * @apiGroup Funds
 *
 * @apiParam  {String} cik       Fund CIK (digits only; auto-padded to 10 chars).
 * @apiQuery  {String} [period]  ISO date YYYY-MM-DD to pin a specific quarter.
 *
 * @apiSuccess {Boolean}     success
 * @apiSuccess {Object|null} data    { cik, label, periodOfReport, holdings[] } or null.
 */
router.get('/:cik', async (req, res) => {
    try {
        const rawCik = req.params.cik;

        // Validate: digits only. Reject anything else immediately.
        if (!/^\d+$/.test(rawCik)) {
            res.set('Cache-Control', FUNDS_CACHE_CONTROL);
            return res.json({ success: true, data: null });
        }
        const cik = rawCik.padStart(10, '0');

        // Validate optional period query param — only YYYY-MM-DD accepted.
        const rawPeriod = req.query.period;
        const period =
            typeof rawPeriod === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(rawPeriod)
                ? rawPeriod
                : null;

        const present = await holdingsTablesPresent();
        if (!present) {
            res.set('Cache-Control', FUNDS_CACHE_CONTROL);
            return res.json({ success: true, data: null });
        }

        const { rows } = await pool.query<IHoldingRow>(
            `WITH target AS (
               SELECT accession, period_of_report,
                      COALESCE(
                        (SELECT filer FROM sec_filings
                         WHERE cik = $1 AND deleted_at IS NULL
                         ORDER BY period_of_report DESC LIMIT 1),
                        $1
                      ) AS filer
               FROM sec_filings
               WHERE cik = $1 AND deleted_at IS NULL
                 AND ($2::date IS NULL OR period_of_report = $2::date)
               ORDER BY period_of_report DESC LIMIT 1
             )
             SELECT h.cusip, h.name_of_issuer, h.title_of_class, h.ticker,
                    h.shares, h.prn_type, h.value_usd, h.put_call,
                    t.period_of_report, t.filer,
                    COALESCE(ROUND(
                      h.value_usd * 100.0 / NULLIF(SUM(h.value_usd) OVER (), 0),
                      4
                    ), 0) AS weight_pct
             FROM sec_holdings h
             JOIN target t ON t.accession = h.accession AND h.cik = $1
             WHERE h.deleted_at IS NULL
             ORDER BY h.value_usd DESC
             LIMIT $3`,
            [cik, period, MAX_HOLDINGS]
        );

        if (rows.length === 0) {
            res.set('Cache-Control', FUNDS_CACHE_CONTROL);
            return res.json({ success: true, data: null });
        }

        const firstRow = rows[0]!;
        const label = firstRow.filer ?? cik;
        const periodOfReport = firstRow.period_of_report
            .toISOString()
            .slice(0, 10);

        res.set('Cache-Control', FUNDS_CACHE_CONTROL);
        res.json({
            success: true,
            data: toFundHoldings(cik, label, periodOfReport, rows),
        });
    } catch (error) {
        console.error('API Error fetching fund holdings:', error);
        res.set('Cache-Control', ERROR_CACHE_CONTROL);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch fund holdings',
        });
    }
});
