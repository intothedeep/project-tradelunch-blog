-- =============================================================================
-- REVIEWED DRAFT — consolidated financial schema for a self-hosted PG 17 instance.
--
-- SOURCE  : apps/dashboard_server/supabase/migrations/ (0001–0035; 0026 absent)
-- ASSEMBLED: 2026-07-07 from migration sources by developer agent
--
-- AUTHORITY WARNING:
--   This file was assembled by reading individual migration files, then folding
--   later ALTER TABLE / CREATE OR REPLACE VIEW statements into their base
--   definitions.  At cutover, run:
--       pg_dump --schema-only -t <table> <supabase-connection-url>
--   against the live Supabase DB and treat that output as authoritative.
--
-- POST-LOAD:
--   REFRESH MATERIALIZED VIEW mv_sec_new_positions;
--
-- SUPABASE-ISMS STRIPPED:
--   - auth.* / storage.* schema references
--   - ENABLE ROW LEVEL SECURITY / CREATE POLICY
--   - supabase_* / authenticated / anon role GRANTs
--   - ALTER TABLE … OWNER TO
--
-- EXTENSIONS:
--   None required by the financial objects below.  pg_trgm appears only in
--   blog-side GIN indexes (0001) and is NOT referenced here.
--
-- ALTERS FOLDED INTO BASE CREATE STATEMENTS:
--   market_history      ← 0034  (dividends, stock_splits columns)
--   symbol_fundamentals ← 0018  (long_name column)
--   error_log           ← 0016  (resolved column + idx_error_log_resolved_created)
--   politician_registry ← 0023  (photo_url, trade_count, purchases, sales,
--                                 late_filings, est_volume columns)
--
-- SUPERSEDED OBJECTS (final version used, prior version discarded):
--   v_politician_activity      0022 version → replaced by 0024 (person-key rekey)
--   v_politician_filer_timeline 0023 version → replaced by 0033 (buy_value_usd/sell_value_usd)
--   mv_sec_new_positions        0029 version → DROPped + replaced by 0031 (mapped CTE)
--
-- OBJECTS EXCLUDED (blog / portfolio):
--   users, posts, categories, files, tags, post_tags, post_categories,
--   invites, post_favorites, post_likes, comments, and all their
--   indexes / views / triggers.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- SECTION 1: MARKET DATA  (migrations 0004, 0034)
-- ---------------------------------------------------------------------------

-- One row per dashboard item (per category+label).
CREATE TABLE IF NOT EXISTS market_snapshots (
    seq                 int8 GENERATED ALWAYS AS IDENTITY(
                            INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
                            START 1 CACHE 1 NO CYCLE
                        ) NOT NULL,
    category            TEXT    NOT NULL,
    label               TEXT    NOT NULL,
    ticker              TEXT    NULL,
    exchange            TEXT    NULL,
    value               NUMERIC NOT NULL,
    change_absolute     NUMERIC NOT NULL,
    change_percent      NUMERIC NOT NULL,
    as_of               TIMESTAMPTZ NOT NULL,
    revalidate_seconds  INT     NOT NULL,
    fetched_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT market_snapshots_category_check
        CHECK (category IN ('fx', 'crypto', 'indices', 'rates', 'stocks')),
    CONSTRAINT market_snapshots_pkey PRIMARY KEY (category, label)
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_category
    ON market_snapshots(category);

-- One row per OHLC candle per label per interval.
-- dividends + stock_splits columns folded in from 0034 (DEFAULT 0).
CREATE TABLE IF NOT EXISTS market_history (
    seq          int8 GENERATED ALWAYS AS IDENTITY(
                     INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
                     START 1 CACHE 1 NO CYCLE
                 ) NOT NULL,
    label        TEXT    NOT NULL,
    interval     TEXT    NOT NULL,
    bar_time     TIMESTAMPTZ NOT NULL,
    open         NUMERIC NOT NULL,
    high         NUMERIC NOT NULL,
    low          NUMERIC NOT NULL,
    close        NUMERIC NOT NULL,
    volume       BIGINT  NOT NULL,
    -- 0034: raw close is unchanged; dividends/splits stored separately
    -- so adj_close logic in the backtest engine avoids double-counting.
    dividends    NUMERIC DEFAULT 0,
    stock_splits NUMERIC DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT market_history_pkey PRIMARY KEY (label, interval, bar_time)
);

CREATE INDEX IF NOT EXISTS idx_market_history_label_interval
    ON market_history(label, interval, bar_time);


-- ---------------------------------------------------------------------------
-- SECTION 2: TRACKED SYMBOLS  (migration 0011)
-- ---------------------------------------------------------------------------

-- Sticky universe: a symbol that enters market-cap ranking is tracked forever.
-- Soft-delete only (deleted_at); manual admin action required to remove.
CREATE TABLE IF NOT EXISTS tracked_symbols (
    symbol          TEXT NOT NULL,
    category        TEXT NOT NULL,
    label           TEXT NOT NULL,
    sector          TEXT NULL,
    source          TEXT NOT NULL DEFAULT 'yahoo',
    exchange        TEXT NULL,
    first_ranked_at TIMESTAMPTZ NULL,
    last_ranked_at  TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMPTZ NULL,
    CONSTRAINT tracked_symbols_pkey PRIMARY KEY (symbol),
    CONSTRAINT tracked_symbols_label_key UNIQUE (label),
    CONSTRAINT tracked_symbols_category_check
        CHECK (category IN ('fx', 'crypto', 'indices', 'rates', 'stocks'))
);

-- Partial index: active-universe only (run_daily filters deleted_at IS NULL).
CREATE INDEX IF NOT EXISTS idx_tracked_symbols_category
    ON tracked_symbols(category) WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- SECTION 3: MARKET RANKINGS  (migrations 0012, 0032)
-- ---------------------------------------------------------------------------

-- Append-only weekly market-cap ranking series.
-- 0032: idx_market_rankings_scope_asof added for GET /rankings/flow.
CREATE TABLE IF NOT EXISTS market_rankings (
    as_of       DATE    NOT NULL,
    symbol      TEXT    NOT NULL,
    scope       TEXT    NOT NULL,
    sector      TEXT    NULL,
    rank        INT     NOT NULL,
    market_cap  NUMERIC NULL,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT market_rankings_pkey PRIMARY KEY (as_of, symbol, scope),
    CONSTRAINT market_rankings_scope_check CHECK (scope IN ('global', 'sector'))
);

CREATE INDEX IF NOT EXISTS idx_market_rankings_asof_scope
    ON market_rankings(as_of, scope, rank);

-- 0032: covers DISTINCT ON (date_trunc(granularity, as_of)) + WHERE scope='global' AND rank<=k.
CREATE INDEX IF NOT EXISTS idx_market_rankings_scope_asof
    ON market_rankings (scope, sector, as_of DESC, symbol, rank);


-- ---------------------------------------------------------------------------
-- SECTION 4: SYMBOL FUNDAMENTALS  (migrations 0013, 0018)
-- ---------------------------------------------------------------------------

-- Per-symbol fundamentals cache (shares_outstanding, sector, display name).
-- long_name column folded in from 0018.
CREATE TABLE IF NOT EXISTS symbol_fundamentals (
    symbol              TEXT    NOT NULL,
    shares_outstanding  NUMERIC NULL,
    sector              TEXT    NULL,
    shares_refreshed_at TIMESTAMPTZ NULL,
    sector_refreshed_at TIMESTAMPTZ NULL,
    source              TEXT    NOT NULL DEFAULT 'yahoo',
    -- 0018: company display name (longName/shortName from Yahoo .info)
    long_name           TEXT    NULL,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMPTZ NULL,
    CONSTRAINT symbol_fundamentals_pkey PRIMARY KEY (symbol)
);


-- ---------------------------------------------------------------------------
-- SECTION 5: OPERATIONAL LOGS  (migrations 0014, 0015, 0016)
-- ---------------------------------------------------------------------------

-- Browser / SSR error-boundary ingest.
-- EXCEPTION: no soft-delete (hard-delete by TTL is owner-approved pattern).
-- resolved column + index folded in from 0016.
CREATE TABLE IF NOT EXISTS error_log (
    id         BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    digest     TEXT   NULL,
    message    TEXT   NULL,
    stack      TEXT   NULL,
    path       TEXT   NULL,
    user_agent TEXT   NULL,
    source     TEXT   NOT NULL DEFAULT 'browser',
    -- 0016: triage tracker — 0 = open/unresolved, 1 = resolved.
    resolved   SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_log_created_at
    ON error_log(created_at);

-- 0016: open-error lookup.
CREATE INDEX IF NOT EXISTS idx_error_log_resolved_created
    ON error_log(resolved, created_at);

-- Collector batch-run operational sink.
-- EXCEPTION: no soft-delete (TTL prune; same owner-approved pattern as error_log).
CREATE TABLE IF NOT EXISTS batch_log (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    job         TEXT     NOT NULL,
    status      TEXT     NOT NULL,
    resolved    SMALLINT NOT NULL DEFAULT 0,
    started_at  TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NULL,
    descr       TEXT     NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_log_resolved_started
    ON batch_log(resolved, started_at);

CREATE INDEX IF NOT EXISTS idx_batch_log_job_started
    ON batch_log(job, started_at);


-- ---------------------------------------------------------------------------
-- SECTION 6: SEC 13F HOLDINGS  (migration 0017)
-- ---------------------------------------------------------------------------

-- Filing-level metadata; one row per (cik, accession).
CREATE TABLE IF NOT EXISTS sec_filings (
    cik               TEXT NOT NULL,
    accession         TEXT NOT NULL,
    period_of_report  DATE NOT NULL,
    form_type         TEXT NOT NULL,
    filer             TEXT NULL,
    filing_date       DATE NULL,
    value_units       TEXT NOT NULL DEFAULT 'usd',
    source            TEXT NOT NULL DEFAULT 'sec13f',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ NULL,
    CONSTRAINT sec_filings_pkey PRIMARY KEY (cik, accession)
);

CREATE INDEX IF NOT EXISTS idx_sec_filings_cik_period
    ON sec_filings(cik, period_of_report DESC) WHERE deleted_at IS NULL;

-- Per-position rows; put_call + prn_type are NOT NULL sentinels ('')
-- so ON CONFLICT upsert is unambiguous (NULL is not distinct in UNIQUE keys).
CREATE TABLE IF NOT EXISTS sec_holdings (
    cik              TEXT   NOT NULL,
    accession        TEXT   NOT NULL,
    period_of_report DATE   NOT NULL,
    cusip            TEXT   NOT NULL,
    name_of_issuer   TEXT   NOT NULL,
    title_of_class   TEXT   NULL,
    ticker           TEXT   NULL,
    shares           BIGINT NULL,
    prn_type         TEXT   NOT NULL DEFAULT '',
    value_usd        BIGINT NOT NULL,
    put_call         TEXT   NOT NULL DEFAULT '',
    discretion       TEXT   NULL,
    source           TEXT   NOT NULL DEFAULT 'sec13f',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ NULL,
    CONSTRAINT sec_holdings_pkey PRIMARY KEY (cik, accession, cusip, put_call, prn_type)
);

CREATE INDEX IF NOT EXISTS idx_sec_holdings_cik_period
    ON sec_holdings(cik, period_of_report DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sec_holdings_cusip
    ON sec_holdings(cusip) WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- SECTION 7: SECURITY MAP  (migration 0019)
-- ---------------------------------------------------------------------------

-- CUSIP → ticker → sector join bridge for 13F ↔ market data axes.
CREATE TABLE IF NOT EXISTS security_map (
    cusip           TEXT NOT NULL,
    ticker          TEXT NULL,
    name            TEXT NULL,
    sector          TEXT NULL,
    source          TEXT NOT NULL DEFAULT 'openfigi',
    confidence      TEXT NOT NULL DEFAULT 'exact',
    resolved_at     TIMESTAMPTZ NULL,
    attempt_count   INT  NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    CONSTRAINT security_map_pkey PRIMARY KEY (cusip)
);

CREATE INDEX IF NOT EXISTS idx_security_map_ticker
    ON security_map(ticker) WHERE deleted_at IS NULL AND ticker IS NOT NULL;


-- ---------------------------------------------------------------------------
-- SECTION 8: FUND REGISTRY + ANALYST SIGNALS  (migration 0020)
-- ---------------------------------------------------------------------------

-- Active vs passive fund classification for 13F consensus.
CREATE TABLE IF NOT EXISTS fund_registry (
    cik               TEXT    NOT NULL,
    label             TEXT    NOT NULL,
    is_active_manager BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ NULL,
    CONSTRAINT fund_registry_pkey PRIMARY KEY (cik)
);

INSERT INTO fund_registry (cik, label, is_active_manager) VALUES
    ('0001067983', 'Berkshire Hathaway',       TRUE),
    ('0001350694', 'Bridgewater Associates',   TRUE),
    ('0001037389', 'Renaissance Technologies', TRUE),
    ('0002012383', 'BlackRock',                FALSE),
    ('0000102909', 'Vanguard Group',           FALSE),
    ('0000093751', 'State Street',             FALSE)
ON CONFLICT (cik) DO NOTHING;


-- ---------------------------------------------------------------------------
-- SECTION 9: POLITICIAN DISCLOSURES  (migrations 0022–0025)
-- ---------------------------------------------------------------------------

-- One row per unique filer (politician or executive branch official).
-- 0023 additive columns folded in (photo_url, trade_count, purchases, sales,
-- late_filings, est_volume).
CREATE TABLE IF NOT EXISTS politician_registry (
    filer_id        TEXT NOT NULL,
    filer_name      TEXT NOT NULL,
    party           TEXT NULL,
    chamber         TEXT NULL,
    branch          TEXT NULL,
    state           TEXT NULL,
    office          TEXT NULL,
    agency          TEXT NULL,
    bioguide_id     TEXT NULL,
    source          TEXT NOT NULL DEFAULT 'kadoa',
    -- 0023: kadoa filers.json source aggregates
    photo_url       TEXT   NULL,
    trade_count     INT    NULL,
    purchases       INT    NULL,
    sales           INT    NULL,
    late_filings    INT    NULL,
    est_volume      BIGINT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    CONSTRAINT politician_registry_pkey PRIMARY KEY (filer_id)
);

-- One row per disclosed transaction event.
CREATE TABLE IF NOT EXISTS politician_trades (
    external_id          TEXT    NOT NULL,
    filer_id             TEXT    NOT NULL,
    disclosure_date      DATE    NOT NULL,
    transaction_date     DATE    NULL,
    transaction_type     TEXT    NOT NULL,
    transaction_type_raw TEXT    NULL,
    filer_owner          TEXT    NULL,
    owner_raw            TEXT    NULL,
    asset_type           TEXT    NOT NULL DEFAULT 'other',
    asset_type_raw       TEXT    NULL,
    ticker               TEXT    NULL,
    asset_name           TEXT    NULL,
    value_min            BIGINT  NULL,
    value_max            BIGINT  NULL,
    value_estimate       BIGINT  NULL,
    value_label          TEXT    NULL,
    doc_url              TEXT    NULL,
    source_id            TEXT    NULL,
    filing_type          TEXT    NULL,
    days_to_file         INT     NULL,
    is_late              BOOLEAN NULL,
    source               TEXT    NOT NULL DEFAULT 'kadoa',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ NULL,
    CONSTRAINT politician_trades_pkey PRIMARY KEY (external_id),
    CONSTRAINT politician_trades_filer_fk
        FOREIGN KEY (filer_id) REFERENCES politician_registry(filer_id)
);

CREATE INDEX IF NOT EXISTS idx_politician_trades_ticker_disc
    ON politician_trades(ticker, disclosure_date DESC)
    WHERE deleted_at IS NULL AND ticker IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_politician_trades_disc
    ON politician_trades(disclosure_date DESC)
    WHERE deleted_at IS NULL;

-- Committee membership per politician (current only; soft-delete for staleness).
CREATE TABLE IF NOT EXISTS politician_committees (
    bioguide_id          TEXT        NOT NULL,
    committee_thomas_id  TEXT        NOT NULL,
    committee_name       TEXT        NOT NULL,
    committee_type       TEXT        NOT NULL,
    title                TEXT            NULL,
    source               TEXT        NOT NULL DEFAULT 'congress-legislators',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ         NULL,
    PRIMARY KEY (bioguide_id, committee_thomas_id)
);

-- Fixed committee → sector mapping (seeded by collector).
CREATE TABLE IF NOT EXISTS committee_sector_map (
    committee_thomas_id  TEXT NOT NULL,
    sector               TEXT NOT NULL,
    PRIMARY KEY (committee_thomas_id, sector)
);


-- ---------------------------------------------------------------------------
-- SECTION 10: SIGNAL BACKTEST  (migration 0028)
-- ---------------------------------------------------------------------------

-- Event-study / forward-return observation store.
CREATE TABLE IF NOT EXISTS signal_backtest (
    signal_type  TEXT        NOT NULL,
    ticker       TEXT        NOT NULL,
    as_of        DATE        NOT NULL,
    horizon_days INT         NOT NULL,
    car          NUMERIC         NULL,
    is_hit       BOOLEAN         NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ         NULL,
    CONSTRAINT signal_backtest_pkey PRIMARY KEY (signal_type, ticker, as_of, horizon_days)
);


-- ---------------------------------------------------------------------------
-- SECTION 11: GEX DAILY  (migration 0030)
-- ---------------------------------------------------------------------------

-- Dealer Gamma Exposure daily scalar.
-- Sign convention: net_gex = call_gex - put_gex
--   net_gex > 0 → dealers net long gamma (dampening)
--   net_gex < 0 → dealers net short gamma (amplifying)
CREATE TABLE IF NOT EXISTS gex_daily (
    as_of       DATE    NOT NULL,
    ticker      TEXT    NOT NULL,
    net_gex     NUMERIC NOT NULL,
    call_gex    NUMERIC NOT NULL,
    put_gex     NUMERIC NOT NULL,
    spot        NUMERIC NOT NULL,
    source      TEXT    NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (as_of, ticker)
);

CREATE INDEX IF NOT EXISTS idx_gex_daily_active_ticker
    ON gex_daily (ticker, as_of DESC)
    WHERE deleted_at IS NULL;


-- =============================================================================
-- VIEWS (in dependency order)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 12: ENRICHED READ SURFACES  (migration 0019)
-- ---------------------------------------------------------------------------

-- 13F holdings + resolved ticker + sector (CUSIP-keyed join bridge).
-- sector = COALESCE(live symbol_fundamentals.sector, mapping-time security_map.sector).
CREATE OR REPLACE VIEW v_sec_holdings_enriched AS
SELECT h.*,
       m.ticker                      AS mapped_ticker,
       COALESCE(f.sector, m.sector)  AS sector,
       m.confidence                  AS map_confidence
FROM sec_holdings h
LEFT JOIN security_map m
       ON m.cusip = h.cusip AND m.deleted_at IS NULL
LEFT JOIN symbol_fundamentals f
       ON f.symbol = m.ticker AND f.deleted_at IS NULL
WHERE h.deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- SECTION 13: 13F ANALYTIC VIEWS  (migration 0020)
-- ---------------------------------------------------------------------------

-- Base: per-(cik, period, cusip) position with portfolio weight.
-- Aggregates across accessions (base + addenda all kept live per reconcile path).
CREATE OR REPLACE VIEW v_sec_positions AS
WITH pos AS (
    SELECT cik, period_of_report, cusip,
           MAX(name_of_issuer) AS name_of_issuer,
           SUM(shares)         AS shares,
           SUM(value_usd)      AS value_usd
    FROM sec_holdings
    WHERE deleted_at IS NULL AND put_call = '' AND prn_type <> 'PRN'
    GROUP BY cik, period_of_report, cusip
)
SELECT p.*,
       ROUND(p.value_usd * 100.0 / NULLIF(
           SUM(p.value_usd) OVER (PARTITION BY cik, period_of_report), 0), 4
       ) AS weight_pct
FROM pos p;

-- Adjacent filed-quarter ladder per fund (prev_period = actually-filed prior quarter).
CREATE OR REPLACE VIEW v_sec_fund_periods AS
SELECT cik, period_of_report,
       LAG(period_of_report) OVER (PARTITION BY cik ORDER BY period_of_report) AS prev_period
FROM (
    SELECT DISTINCT cik, period_of_report
    FROM sec_filings WHERE deleted_at IS NULL
) fp;

-- QoQ delta for held positions vs the fund's prior filed quarter.
CREATE OR REPLACE VIEW v_sec_position_delta AS
SELECT cur.cik, cur.period_of_report, cur.cusip, cur.name_of_issuer,
       cur.shares, cur.value_usd, cur.weight_pct,
       fp.prev_period,
       cur.shares     - prev.shares      AS delta_shares,
       cur.weight_pct - prev.weight_pct  AS delta_weight_pct,
       (fp.prev_period IS NOT NULL AND prev.cusip IS NULL) AS is_new,
       (fp.prev_period IS NULL)                            AS is_first_period
FROM v_sec_positions cur
JOIN v_sec_fund_periods fp
  ON fp.cik = cur.cik AND fp.period_of_report = cur.period_of_report
LEFT JOIN v_sec_positions prev
  ON prev.cik = cur.cik AND prev.period_of_report = fp.prev_period
 AND prev.cusip = cur.cusip;

-- EXIT positions: held in the prior filed quarter, absent now.
CREATE OR REPLACE VIEW v_sec_exits AS
SELECT fp.cik, fp.period_of_report, prev.cusip, prev.name_of_issuer,
       prev.shares AS prev_shares, prev.weight_pct AS prev_weight_pct
FROM v_sec_fund_periods fp
JOIN v_sec_positions prev
  ON prev.cik = fp.cik AND prev.period_of_report = fp.prev_period
LEFT JOIN v_sec_positions cur
  ON cur.cik = fp.cik AND cur.period_of_report = fp.period_of_report
 AND cur.cusip = prev.cusip
WHERE cur.cusip IS NULL;

-- Cross-fund consensus per (period, cusip): active vs total holder counts.
CREATE OR REPLACE VIEW v_sec_consensus AS
SELECT p.period_of_report, p.cusip,
       MAX(p.name_of_issuer)                                AS name_of_issuer,
       COUNT(*) FILTER (WHERE r.is_active_manager)          AS holder_count_active,
       COUNT(*)                                             AS holder_count_total,
       SUM(p.value_usd) FILTER (WHERE r.is_active_manager)  AS active_value_usd,
       ARRAY_AGG(p.cik ORDER BY p.value_usd DESC)           AS holder_ciks
FROM v_sec_positions p
JOIN fund_registry r ON r.cik = p.cik AND r.deleted_at IS NULL
GROUP BY p.period_of_report, p.cusip;

-- Derivatives (options) exposure complement to v_sec_positions (0027).
CREATE OR REPLACE VIEW v_sec_derivatives_exposure AS
SELECT cik, period_of_report, cusip,
       MAX(name_of_issuer)                             AS name_of_issuer,
       SUM(value_usd) FILTER (WHERE put_call = 'CALL') AS call_value_usd,
       SUM(value_usd) FILTER (WHERE put_call = 'PUT')  AS put_value_usd,
       SUM(shares)    FILTER (WHERE put_call = 'CALL') AS call_shares,
       SUM(shares)    FILTER (WHERE put_call = 'PUT')  AS put_shares,
       SUM(value_usd)                                  AS derivatives_value_usd
FROM sec_holdings
WHERE deleted_at IS NULL AND put_call IN ('PUT', 'CALL')
GROUP BY cik, period_of_report, cusip;


-- ---------------------------------------------------------------------------
-- SECTION 14: POLITICIAN ANALYTIC VIEWS  (migrations 0022, 0024, 0023, 0033, 0025)
-- ---------------------------------------------------------------------------

-- Enriched trade rows + filer metadata + sector (0022).
CREATE OR REPLACE VIEW v_politician_trades_enriched AS
SELECT pt.*,
       r.filer_name,
       r.party,
       r.chamber,
       r.branch,
       sm.sector                        AS map_sector,
       COALESCE(f.sector, sm.sector)    AS sector
FROM politician_trades pt
LEFT JOIN politician_registry r
       ON r.filer_id = pt.filer_id AND r.deleted_at IS NULL
LEFT JOIN security_map sm
       ON sm.ticker = pt.ticker AND sm.deleted_at IS NULL
LEFT JOIN symbol_fundamentals f
       ON f.symbol = pt.ticker AND f.deleted_at IS NULL
WHERE pt.deleted_at IS NULL;

-- Aggregate ticker activity over rolling 90-day window.
-- FINAL VERSION: 0024 (person-key rekey via bioguide_id-first identity).
-- 0022 version superseded — counts were over-counting multi-slug politicians.
CREATE OR REPLACE VIEW v_politician_activity AS
WITH trades AS (
    SELECT
        pt.ticker,
        pt.transaction_type,
        pt.disclosure_date,
        COALESCE(r.bioguide_id, pt.filer_id) AS person_key
    FROM politician_trades pt
    LEFT JOIN politician_registry r
           ON r.filer_id = pt.filer_id AND r.deleted_at IS NULL
    WHERE pt.ticker IS NOT NULL
      AND pt.deleted_at IS NULL
      AND pt.disclosure_date >= CURRENT_DATE - INTERVAL '90 days'
)
SELECT
    ticker,
    COUNT(DISTINCT person_key)                                                    AS traded_by_count,
    COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'buy')            AS buy_member_count,
    COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'sell')           AS sell_member_count,
    CASE
        WHEN COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'buy')
           > COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'sell')
            THEN 'buy_skew'
        WHEN COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'sell')
           > COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'buy')
            THEN 'sell_skew'
        ELSE 'mixed'
    END                                                                           AS net_direction,
    MAX(disclosure_date)                                                          AS latest_disclosure_date,
    (
        COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'buy')  >= 3
        OR
        COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'sell') >= 3
    )                                                                             AS cluster_flag
FROM trades
GROUP BY ticker;

-- Per-(ticker, filer_id) trade summary (0023).
CREATE OR REPLACE VIEW v_politician_ticker_holders AS
SELECT
    ticker,
    filer_id,
    SUM(value_estimate)                                                  AS disclosed_value_usd,
    COUNT(*)                                                             AS trade_count,
    COUNT(*) FILTER (WHERE transaction_type = 'buy')                     AS buy_count,
    COUNT(*) FILTER (WHERE transaction_type = 'sell')                    AS sell_count,
    CASE
        WHEN COUNT(*) FILTER (WHERE transaction_type = 'buy')
           > COUNT(*) FILTER (WHERE transaction_type = 'sell')
            THEN 'buy_skew'
        WHEN COUNT(*) FILTER (WHERE transaction_type = 'sell')
           > COUNT(*) FILTER (WHERE transaction_type = 'buy')
            THEN 'sell_skew'
        ELSE 'mixed'
    END                                                                  AS net_direction,
    MAX(disclosure_date)                                                 AS latest_disclosure,
    MIN(disclosure_date)                                                 AS first_disclosure
FROM politician_trades
WHERE ticker IS NOT NULL
  AND deleted_at IS NULL
GROUP BY ticker, filer_id;

-- Quarterly net-flow per (filer, ticker).
-- FINAL VERSION: 0033 (adds buy_value_usd + sell_value_usd columns).
-- 0023 version superseded.
CREATE OR REPLACE VIEW v_politician_filer_timeline AS
SELECT
    filer_id,
    ticker,
    date_trunc('quarter', transaction_date)::date                                                AS quarter,
    COALESCE(SUM(value_estimate) FILTER (WHERE transaction_type = 'buy'), 0)
        - COALESCE(SUM(value_estimate) FILTER (WHERE transaction_type = 'sell'), 0)             AS net_value_usd,
    COUNT(*) FILTER (WHERE transaction_type = 'buy')                                             AS buy_count,
    COUNT(*) FILTER (WHERE transaction_type = 'sell')                                            AS sell_count,
    CASE
        WHEN COUNT(*) FILTER (WHERE transaction_type = 'buy')
           > COUNT(*) FILTER (WHERE transaction_type = 'sell')
            THEN 'buy'
        WHEN COUNT(*) FILTER (WHERE transaction_type = 'sell')
           > COUNT(*) FILTER (WHERE transaction_type = 'buy')
            THEN 'sell'
        ELSE 'mixed'
    END                                                                                          AS direction,
    -- 0033: gross buy / sell disclosed value (banded downstream).
    COALESCE(SUM(value_estimate) FILTER (WHERE transaction_type = 'buy'), 0)                     AS buy_value_usd,
    COALESCE(SUM(value_estimate) FILTER (WHERE transaction_type = 'sell'), 0)                    AS sell_value_usd
FROM politician_trades
WHERE ticker IS NOT NULL
  AND transaction_date IS NOT NULL
  AND deleted_at IS NULL
GROUP BY filer_id, ticker, date_trunc('quarter', transaction_date);

-- Sectors a politician's committee jurisdiction covers (0025).
CREATE OR REPLACE VIEW v_politician_sector_oversight AS
SELECT DISTINCT
    pc.bioguide_id,
    csm.sector
FROM politician_committees pc
JOIN committee_sector_map csm
    ON csm.committee_thomas_id = pc.committee_thomas_id
WHERE pc.deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- SECTION 15: SIGNAL BACKTEST SUMMARY  (migration 0028)
-- ---------------------------------------------------------------------------

-- Roll-up: mean CAR, hit-rate, n, t-stat per (signal_type, horizon_days).
CREATE OR REPLACE VIEW v_signal_backtest_summary AS
SELECT
    signal_type,
    horizon_days,
    AVG(car)                                                               AS mean_car,
    AVG(is_hit::int)                                                       AS hit_rate,
    COUNT(*)                                                               AS n,
    AVG(car) / NULLIF(STDDEV_SAMP(car) / SQRT(COUNT(*)), 0)               AS t_stat
FROM signal_backtest
WHERE deleted_at IS NULL
  AND car IS NOT NULL
GROUP BY signal_type, horizon_days
ORDER BY signal_type, horizon_days;


-- ---------------------------------------------------------------------------
-- SECTION 16: MATERIALIZED VIEW — NEW POSITIONS  (migrations 0029 → 0031)
-- ---------------------------------------------------------------------------
-- 0029 definition (expensive v_sec_position_delta full-history self-join)
-- was replaced by 0031 (mapped-CUSIP CTE, ~4.6s vs >600s timeout).
-- 0031 is the authoritative definition; the DROP below handles any existing
-- 0029 shape on the target instance.
--
-- NOTE: REFRESH MATERIALIZED VIEW mv_sec_new_positions; must be run after load.

DROP MATERIALIZED VIEW IF EXISTS mv_sec_new_positions;

CREATE MATERIALIZED VIEW mv_sec_new_positions AS
WITH mapped AS (
    SELECT DISTINCT cusip, ticker
    FROM security_map
    WHERE deleted_at IS NULL AND ticker IS NOT NULL
),
pos AS (
    SELECT h.cik, h.period_of_report, h.cusip
    FROM sec_holdings h
    JOIN mapped m ON m.cusip = h.cusip
    WHERE h.deleted_at IS NULL AND h.put_call = '' AND h.prn_type <> 'PRN'
    GROUP BY h.cik, h.period_of_report, h.cusip
),
periods AS (
    SELECT cik, period_of_report,
           LAG(period_of_report) OVER (PARTITION BY cik ORDER BY period_of_report) AS prev_period
    FROM (SELECT DISTINCT cik, period_of_report FROM sec_filings WHERE deleted_at IS NULL) fp
),
newpos AS (
    SELECT cur.cik, cur.period_of_report, cur.cusip
    FROM pos cur
    JOIN periods p ON p.cik = cur.cik AND p.period_of_report = cur.period_of_report
    LEFT JOIN pos prev ON prev.cik = cur.cik
        AND prev.period_of_report = p.prev_period
        AND prev.cusip = cur.cusip
    WHERE p.prev_period IS NOT NULL AND prev.cusip IS NULL
)
SELECT n.cik, n.period_of_report, n.cusip, m.ticker, f.filing_date
FROM newpos n
JOIN mapped m ON m.cusip = n.cusip
JOIN (
    SELECT cik, period_of_report, MIN(filing_date) AS filing_date
    FROM sec_filings
    WHERE filing_date IS NOT NULL AND deleted_at IS NULL
    GROUP BY cik, period_of_report
) f ON f.cik = n.cik AND f.period_of_report = n.period_of_report
WITH DATA;

-- UNIQUE index enables REFRESH ... CONCURRENTLY and dedupes the event source.
CREATE UNIQUE INDEX IF NOT EXISTS mv_sec_new_positions_pk
    ON mv_sec_new_positions (cik, cusip, period_of_report);

CREATE INDEX IF NOT EXISTS mv_sec_new_positions_filing_idx
    ON mv_sec_new_positions (filing_date);


-- ---------------------------------------------------------------------------
-- SECTION 17: 13F CONSENSUS AS-OF (filing-date gated)  (migration 0035)
-- ---------------------------------------------------------------------------
-- View chain: v_sec_fund_period_public → v_sec_fund_latest_asof → v_sec_consensus_asof
-- Fixes look-ahead bias and staggered-filing undercount vs v_sec_consensus.

-- Step 1: one row per (cik, period) with known filing_date.
CREATE OR REPLACE VIEW v_sec_fund_period_public AS
SELECT cik,
       period_of_report,
       MIN(filing_date) AS first_filed
FROM sec_filings
WHERE filing_date IS NOT NULL
  AND deleted_at IS NULL
GROUP BY cik, period_of_report;

-- Step 2: each fund's most-recent publicly-filed period as of CURRENT_DATE.
CREATE OR REPLACE VIEW v_sec_fund_latest_asof AS
SELECT DISTINCT ON (cik)
    cik,
    period_of_report AS as_of_period,
    first_filed
FROM v_sec_fund_period_public
WHERE first_filed <= CURRENT_DATE
ORDER BY cik, period_of_report DESC;

-- Step 3: cross-fund consensus with mixed (per-fund) periods.
-- max_period = MAX over joined positions (periods differ across funds).
CREATE OR REPLACE VIEW v_sec_consensus_asof AS
SELECT p.cusip,
       MAX(p.period_of_report)                              AS max_period,
       MAX(p.name_of_issuer)                                AS name_of_issuer,
       COUNT(*) FILTER (WHERE r.is_active_manager)          AS holder_count_active,
       COUNT(*)                                             AS holder_count_total,
       SUM(p.value_usd) FILTER (WHERE r.is_active_manager)  AS active_value_usd,
       ARRAY_AGG(p.cik ORDER BY p.value_usd DESC)           AS holder_ciks
FROM v_sec_fund_latest_asof la
JOIN v_sec_positions p
  ON p.cik = la.cik AND p.period_of_report = la.as_of_period
JOIN fund_registry r
  ON r.cik = p.cik AND r.deleted_at IS NULL
GROUP BY p.cusip;
