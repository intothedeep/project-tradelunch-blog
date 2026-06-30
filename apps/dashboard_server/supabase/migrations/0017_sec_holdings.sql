-- =============================================================================
-- Migration: 0017_sec_holdings.sql
-- Purpose   : SEC EDGAR 13F-HR institutional holdings store (Phase J). Two
--             tables — filing-level metadata (sec_filings) + per-position rows
--             (sec_holdings) — written monthly by apps/stock_collector
--             (run_monthly, job='collector-monthly').
-- Note      : MANUAL — apply by hand AFTER 0016. Additive + idempotent.
--             Re-confirm next free number before applying (multi-session).
-- Soft-delete: BOTH tables carry deleted_at (domain data, NOT a batch/error_log
--             no-tombstone exception). Amendments (13F-HR/A) insert under a new
--             accession; the prior same-period filing is soft-deleted by the
--             collector (strict-earlier filing_date guard), never hard-deleted.
-- Units     : sec_holdings.value_usd is normalized to WHOLE USD by the collector;
--             sec_filings.value_units stamps the RAW unit ('usd' for periods
--             >= 2022-12-31, else 'usd_thousands') so the conversion is auditable.
-- =============================================================================

-- One row per (cik, accession) — filing-level metadata.
CREATE TABLE IF NOT EXISTS sec_filings (
    cik               TEXT NOT NULL,                 -- zero-padded 10-char, source-native
    accession         TEXT NOT NULL,                 -- e.g. 0001067983-25-000123
    period_of_report  DATE NOT NULL,                 -- reportDate (quarter-end) = as_of
    form_type         TEXT NOT NULL,                 -- '13F-HR' | '13F-HR/A'
    filer             TEXT NULL,
    filing_date       DATE NULL,
    value_units       TEXT NOT NULL DEFAULT 'usd',   -- 'usd' | 'usd_thousands'
    source            TEXT NOT NULL DEFAULT 'sec13f',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ NULL,
    CONSTRAINT sec_filings_pkey PRIMARY KEY (cik, accession)
);

CREATE INDEX IF NOT EXISTS idx_sec_filings_cik_period
    ON sec_filings(cik, period_of_report DESC) WHERE deleted_at IS NULL;

-- One row per (cik, accession, cusip, put_call, prn_type). put_call + prn_type are
-- NON-NULL sentinels ('') because Postgres treats NULL as distinct in a unique
-- key, which would silently break the ON CONFLICT upsert.
CREATE TABLE IF NOT EXISTS sec_holdings (
    cik              TEXT NOT NULL,
    accession        TEXT NOT NULL,
    period_of_report DATE NOT NULL,                  -- denormalized for fast as-of reads
    cusip            TEXT NOT NULL,
    name_of_issuer   TEXT NOT NULL,
    title_of_class   TEXT NULL,
    ticker           TEXT NULL,                       -- reserved; CUSIP->ticker is a later phase
    shares           BIGINT NULL,                     -- sshPrnamt when type=SH (summed across managers)
    prn_type         TEXT NOT NULL DEFAULT '',        -- 'SH' | 'PRN'
    value_usd        BIGINT NOT NULL,                 -- normalized whole USD (summed across managers)
    put_call         TEXT NOT NULL DEFAULT '',        -- '' | 'PUT' | 'CALL'
    discretion       TEXT NULL,
    source           TEXT NOT NULL DEFAULT 'sec13f',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ NULL,
    CONSTRAINT sec_holdings_pkey PRIMARY KEY (cik, accession, cusip, put_call, prn_type)
);

CREATE INDEX IF NOT EXISTS idx_sec_holdings_cik_period
    ON sec_holdings(cik, period_of_report DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sec_holdings_cusip
    ON sec_holdings(cusip) WHERE deleted_at IS NULL;
