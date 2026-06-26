-- =============================================================================
-- Migration: 0004_market_data.sql
-- Purpose   : Market dashboard tables backing the financial dashboard endpoints.
-- Source    : apps/dashboard_server/schema/tradelunch.schema.sql (authoritative)
-- Contract  : apps/dashboard_client_web/types/dashboard.ts (IDashboardSnapshot),
--             apps/dashboard_client_web/types/history.ts   (IItemOHLCHistory)
-- Note      : Pure DDL, additive + idempotent. Seed data is in supabase/seed.market.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- MARKET_SNAPSHOTS
-- One row per dashboard item. Columns cover every field of IDashboardItem /
-- IStockItem (value + IDayChange) plus per-category ICategoryMeta (as_of,
-- revalidate_seconds) and the top-level snapshot fetched_at.
--   category          → IDashboardSnapshot key (fx|crypto|indices|rates|stocks)
--   label             → IDashboardItem.label
--   value             → IDashboardItem.value
--   change_absolute   → IDashboardItem.change.absolute
--   change_percent    → IDashboardItem.change.percent
--   ticker / exchange → IStockItem.ticker / IStockItem.exchange (NULL for non-stocks)
--   as_of             → ICategoryMeta.asOf
--   revalidate_seconds→ ICategoryMeta.revalidateSeconds
--   fetched_at        → IDashboardSnapshot.fetchedAt
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_snapshots (
    seq                 int8 GENERATED ALWAYS AS IDENTITY(
                            INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
                            START 1 CACHE 1 NO CYCLE
                        ) NOT NULL,
    category            TEXT NOT NULL,
    label               TEXT NOT NULL,
    ticker              TEXT NULL,
    exchange            TEXT NULL,
    value               NUMERIC NOT NULL,
    change_absolute     NUMERIC NOT NULL,
    change_percent      NUMERIC NOT NULL,
    as_of               TIMESTAMPTZ NOT NULL,
    revalidate_seconds  INT NOT NULL,
    fetched_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT market_snapshots_category_check
        CHECK (category IN ('fx', 'crypto', 'indices', 'rates', 'stocks')),
    CONSTRAINT market_snapshots_pkey PRIMARY KEY (category, label)
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_category ON market_snapshots(category);

-- ---------------------------------------------------------------------------
-- MARKET_HISTORY
-- One row per OHLC candle per item per interval. Covers IOHLCPoint
-- (time/open/high/low/close/volume) grouped by label → IItemOHLCHistory.
--   label    → IItemOHLCHistory.label
--   interval → candle resolution (e.g. '1d')
--   bar_time → IOHLCPoint.time
--   open/high/low/close → IOHLCPoint.{open,high,low,close}
--   volume   → IOHLCPoint.volume
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_history (
    seq         int8 GENERATED ALWAYS AS IDENTITY(
                    INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
                    START 1 CACHE 1 NO CYCLE
                ) NOT NULL,
    label       TEXT NOT NULL,
    interval    TEXT NOT NULL,
    bar_time    TIMESTAMPTZ NOT NULL,
    open        NUMERIC NOT NULL,
    high        NUMERIC NOT NULL,
    low         NUMERIC NOT NULL,
    close       NUMERIC NOT NULL,
    volume      BIGINT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT market_history_pkey PRIMARY KEY (label, interval, bar_time)
);

CREATE INDEX IF NOT EXISTS idx_market_history_label_interval
    ON market_history(label, interval, bar_time);
