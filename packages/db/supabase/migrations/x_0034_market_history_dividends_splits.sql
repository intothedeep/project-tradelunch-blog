-- Phase X Slice 0: additive columns for dividend and split data on market_history.
-- raw close is UNCHANGED — dividends/splits are stored separately to avoid
-- double-counting with adj_close logic in the backtest engine (Slice 1).
-- DEFAULT 0 ensures existing rows have a well-defined value without a backfill.
ALTER TABLE market_history
    ADD COLUMN IF NOT EXISTS dividends    NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS stock_splits NUMERIC DEFAULT 0;
