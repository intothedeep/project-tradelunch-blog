"""Typed row + contract definitions for the stock collector.

Purpose: single source of truth for the DB-contract shapes the collector writes
(``market_history`` / ``market_snapshots`` and the Phase-2 ``tracked_symbols`` /
``market_rankings``) plus the watchlist input shape.

Invariants (verified against apps/dashboard_server/supabase/migrations/0004 + the
reader controllers/dashboard/dashboard.ts):
  * ``market_history`` PK = (label, interval, bar_time); NO category column ->
    history is keyed by LABEL, so every label MUST be globally unique.
  * ``market_snapshots`` PK = (category, label); CHECK category in the 5-set;
    TWO change columns ``change_absolute`` + ``change_percent`` (both NOT NULL);
    ``value``/``as_of``/``revalidate_seconds``/``fetched_at`` NOT NULL;
    ``ticker``/``exchange`` NULLABLE but stocks rows MUST set both.

Side effects: none (pure data definitions).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal, Optional

# --- Contract constants -----------------------------------------------------

Category = Literal["fx", "crypto", "indices", "rates", "stocks"]
Exchange = Literal["US", "KRX"]

VALID_CATEGORIES: tuple[str, ...] = ("fx", "crypto", "indices", "rates", "stocks")
VALID_EXCHANGES: tuple[str, ...] = ("US", "KRX")

DEFAULT_INTERVAL = "1d"

# Per-category client cache hint written into market_snapshots.revalidate_seconds.
# (Phase 1 collection is daily; these are client polling hints, not fetch cadence.)
REVALIDATE_SECONDS: dict[str, int] = {
    "fx": 60,
    "crypto": 30,
    "indices": 60,
    "rates": 86400,
    "stocks": 60,
}


# --- Input shape ------------------------------------------------------------


@dataclass(frozen=True)
class WatchlistEntry:
    """One watchlist symbol: its Yahoo ticker + globally-unique display label.

    ``exchange`` is only meaningful for the ``stocks`` category (the reader returns
    it for stocks; client ``IStockItem.exchange`` is a non-null 'US'|'KRX' union).
    For non-stocks it is ``None``.
    """

    symbol: str
    label: str
    category: str
    exchange: Optional[str] = None


@dataclass(frozen=True)
class FundEntry:
    """One 13F filer identity loaded from configs/funds.yaml.

    ``cik`` is the SEC-native zero-padded 10-character string (digits only).
    ``label`` is a globally unique human-readable name for the fund.
    """

    cik: str
    label: str


# --- Output rows (Phase 1) --------------------------------------------------


@dataclass(frozen=True)
class HistoryRow:
    """One OHLC candle -> market_history (keyed by label, interval, bar_time)."""

    label: str
    interval: str
    bar_time: date
    open: float
    high: float
    low: float
    close: float
    volume: int


@dataclass(frozen=True)
class SnapshotRow:
    """Latest value + 1-bar change -> market_snapshots.

    ``change_absolute`` = latest - prev ; ``change_percent`` = (latest-prev)/prev*100.
    Both columns are NOT NULL in the schema. ``as_of`` = latest bar date,
    ``fetched_at`` = run time, ``revalidate_seconds`` = per-category hint.
    """

    category: str
    label: str
    value: float
    change_absolute: float
    change_percent: float
    as_of: date
    revalidate_seconds: int
    fetched_at: datetime
    ticker: Optional[str] = None
    exchange: Optional[str] = None


# --- Output rows (Phase 2 — rankings / sticky universe) ---------------------


@dataclass(frozen=True)
class TrackedSymbol:
    """A symbol that has entered ranking at least once (sticky universe).

    Soft-delete only (``deleted_at``); never auto-removed. ``label`` is UNIQUE in
    the table to protect the global history-label namespace.
    """

    symbol: str
    category: str
    label: str
    sector: Optional[str] = None
    source: str = "yahoo"
    exchange: Optional[str] = None


@dataclass(frozen=True)
class RankingRow:
    """One weekly ranking observation -> market_rankings (append-only series)."""

    as_of: date
    symbol: str
    scope: Literal["global", "sector"]
    rank: int
    sector: Optional[str] = None
    market_cap: Optional[float] = None


@dataclass(frozen=True)
class FundamentalsRow:
    """Cached per-symbol fundamentals (I2.8) -> symbol_fundamentals.

    ``shares_outstanding`` is refreshed monthly (fast_info), ``sector`` quarterly
    (``.info``); each carries its own refresh clock so the upsert advances a clock
    only when that field was actually refetched (None = leave untouched).
    market_cap is NEVER stored — derived fresh from shares x local close.
    """

    symbol: str
    shares_outstanding: Optional[float] = None
    sector: Optional[str] = None
    shares_refreshed_at: Optional[datetime] = None
    sector_refreshed_at: Optional[datetime] = None


# --- Output rows (Phase J — SEC 13F holdings) -------------------------------


@dataclass(frozen=True)
class FilingRow:
    """One 13F filing header -> sec_filings (PK cik, accession).

    ``cik`` is the source-native zero-padded 10-char string. ``period_of_report``
    is the quarter-end (``reportDate`` from the submissions JSON), used as as_of.
    ``value_units`` records the RAW unit of the info-table value column ('usd'
    for periods >= 2022-12-31, else 'usd_thousands') so the USD normalization in
    HoldingRow.value_usd stays auditable. ``form_type`` is '13F-HR' | '13F-HR/A'.
    """

    cik: str
    accession: str
    period_of_report: date
    form_type: str
    filer: Optional[str] = None
    filing_date: Optional[date] = None
    value_units: str = "usd"
    source: str = "sec13f"


@dataclass(frozen=True)
class HoldingRow:
    """One aggregated 13F position -> sec_holdings.

    PK = (cik, accession, cusip, put_call, prn_type). Lines are aggregated across
    ``otherManager`` in the pure transform (multi-manager funds repeat a security
    once per sub-manager), so shares/value_usd are summed. ``cusip`` is source-
    native; ``ticker`` is reserved (NULL until a licensed CUSIP->ticker mapping).
    ``value_usd`` is normalized to whole USD; ``put_call`` is a NON-NULL sentinel
    ('' | 'PUT' | 'CALL') because NULL would break ON CONFLICT. ``prn_type`` is
    'SH' | 'PRN'.
    """

    cik: str
    accession: str
    period_of_report: date
    cusip: str
    name_of_issuer: str
    value_usd: int
    put_call: str = ""
    prn_type: Optional[str] = None
    title_of_class: Optional[str] = None
    shares: Optional[int] = None
    discretion: Optional[str] = None
    ticker: Optional[str] = None
    source: str = "sec13f"
