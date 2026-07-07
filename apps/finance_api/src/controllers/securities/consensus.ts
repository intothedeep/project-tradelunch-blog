// controllers/securities/consensus.ts
// Purpose : Read-only cross-fund consensus for a CUSIP (Phase P, STEP 1 / P8).
//           Answers "how many funds hold this security, and how did each change
//           vs its prior filed quarter" at the security's latest 13F period.
// Invariants:
//   - Active vs total holder counts are split (v_sec_consensus): passive index
//     funds replicate the market cap, so only ACTIVE managers carry signal.
//   - Per-fund breakdown comes from v_sec_position_delta (Δ vs prior quarter).
//   - mappedTicker is best-effort from security_map (0019); null when absent.
//   - BIGINT columns → Number in the DTO (all < 2^53: fund position values, not
//     post ids — safe, unlike the BIGINT post-id case).
// Constraints: raw SQL only, no ORM, no side effects beyond pool reads.
//              View-absence guard returns null data, not 500.
import { pool } from '../../database';
import { Router } from 'express';

export const router = Router();

const FUNDS_CACHE_CONTROL =
    'public, s-maxage=86400, stale-while-revalidate=604800';

// CUSIP is 9 chars, but accept 6–9 alphanumerics (some feeds trim). Rejects
// anything that could be an injection vector before it reaches a query.
const CUSIP_RE = /^[A-Za-z0-9]{6,9}$/;

interface IPresence {
    analytics: boolean;
    secmap: boolean;
}

async function probePresence(): Promise<IPresence> {
    const { rows } = await pool.query<IPresence>(
        `SELECT to_regclass('public.v_sec_consensus')      IS NOT NULL
             AND to_regclass('public.v_sec_position_delta') IS NOT NULL
             AND to_regclass('public.fund_registry')        IS NOT NULL AS analytics,
                 to_regclass('public.security_map')          IS NOT NULL AS secmap`
    );
    return {
        analytics: rows[0]?.analytics ?? false,
        secmap: rows[0]?.secmap ?? false,
    };
}

// --- DB row shapes (only columns we SELECT) ---

interface IConsensusRow {
    period_of_report: Date | string;
    cusip: string;
    name_of_issuer: string;
    holder_count_active: string;
    holder_count_total: string;
    active_value_usd: string | null;
    mapped_ticker: string | null;
}

interface IHolderRow {
    cik: string;
    label: string;
    is_active_manager: boolean;
    shares: string | null;
    value_usd: string;
    weight_pct: string | null;
    delta_shares: string | null;
    delta_weight_pct: string | null;
    is_new: boolean;
}

// --- Pure helpers ---

function toIsoDate(d: Date | string): string {
    return typeof d === 'string'
        ? d.slice(0, 10)
        : d.toISOString().slice(0, 10);
}

function numOrNull(v: string | null): number | null {
    return v === null ? null : Number(v);
}

/**
 * @api {get} /v1/api/securities/:cusip/consensus Cross-fund consensus for a CUSIP
 * @apiSuccess {Object|null} data  { cusip, name, mappedTicker, periodOfReport,
 *                                   holderCountActive, holderCountTotal, holders[] }
 *                                  or null when cusip is invalid/unknown or views absent.
 */
router.get('/:cusip/consensus', async (req, res) => {
    try {
        res.set('Cache-Control', FUNDS_CACHE_CONTROL);
        const cusip = req.params.cusip;
        if (!CUSIP_RE.test(cusip)) {
            return res.json({ success: true, data: null });
        }

        const { analytics, secmap } = await probePresence();
        if (!analytics) {
            return res.json({ success: true, data: null });
        }

        // Query A — consensus row at the security's LATEST period. mappedTicker
        // join only when security_map (0019) is applied.
        const consensusSql = secmap
            ? `SELECT c.period_of_report, c.cusip, c.name_of_issuer,
                      c.holder_count_active, c.holder_count_total, c.active_value_usd,
                      sm.ticker AS mapped_ticker
                 FROM v_sec_consensus c
                 LEFT JOIN security_map sm
                        ON sm.cusip = c.cusip AND sm.deleted_at IS NULL
                WHERE c.cusip = $1
                ORDER BY c.period_of_report DESC
                LIMIT 1`
            : `SELECT c.period_of_report, c.cusip, c.name_of_issuer,
                      c.holder_count_active, c.holder_count_total, c.active_value_usd,
                      NULL::text AS mapped_ticker
                 FROM v_sec_consensus c
                WHERE c.cusip = $1
                ORDER BY c.period_of_report DESC
                LIMIT 1`;
        const { rows: cRows } = await pool.query<IConsensusRow>(consensusSql, [
            cusip,
        ]);
        const head = cRows[0];
        if (!head) {
            return res.json({ success: true, data: null });
        }

        // Query B — per-fund breakdown at that period (Δ vs prior filed quarter).
        const { rows: hRows } = await pool.query<IHolderRow>(
            `SELECT d.cik, r.label, r.is_active_manager,
                    d.shares, d.value_usd, d.weight_pct,
                    d.delta_shares, d.delta_weight_pct, d.is_new
               FROM v_sec_position_delta d
               JOIN fund_registry r ON r.cik = d.cik AND r.deleted_at IS NULL
              WHERE d.cusip = $1 AND d.period_of_report = $2
              ORDER BY d.value_usd DESC`,
            [cusip, head.period_of_report]
        );

        return res.json({
            success: true,
            data: {
                cusip: head.cusip,
                name: head.name_of_issuer,
                mappedTicker: head.mapped_ticker,
                periodOfReport: toIsoDate(head.period_of_report),
                holderCountActive: Number(head.holder_count_active),
                holderCountTotal: Number(head.holder_count_total),
                activeValueUsd: numOrNull(head.active_value_usd),
                holders: hRows.map((h) => ({
                    cik: h.cik,
                    label: h.label,
                    isActiveManager: h.is_active_manager,
                    shares: numOrNull(h.shares),
                    valueUsd: Number(h.value_usd),
                    weightPct: numOrNull(h.weight_pct),
                    deltaShares: numOrNull(h.delta_shares),
                    deltaWeightPct: numOrNull(h.delta_weight_pct),
                    isNew: h.is_new,
                })),
            },
        });
    } catch {
        // Never leak a 500 for a read; degrade to null like the funds endpoints.
        res.set('Cache-Control', FUNDS_CACHE_CONTROL);
        return res.json({ success: true, data: null });
    }
});
