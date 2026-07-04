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
    ``long_name`` (company name) rides the SAME ``.info`` call as ``sector`` and
    shares its clock. market_cap is NEVER stored — derived fresh from shares x close.
    """

    symbol: str
    shares_outstanding: Optional[float] = None
    sector: Optional[str] = None
    long_name: Optional[str] = None
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


# --- Output rows (Phase Q — Congressional / executive trade disclosures) ----


@dataclass(frozen=True)
class PoliticianRow:
    """One filer in politician_registry (PK filer_id).

    Carries stable identity metadata per kadoa filer slug. ``bioguide_id`` is
    reserved for future congress-legislators enrichment (None until resolved).

    Q10.2 aggregate fields (photo_url … est_volume) are populated from the filers.json
    enrichment path (upsert_politicians_enriched). The trades-path upsert
    (upsert_politicians) omits these columns from its SQL entirely, so a
    trades-derived PoliticianRow with all aggregates=None will never clobber
    values already written by the enrichment path.

    Soft-delete only (``deleted_at`` managed by DB / upsert; not stored here).
    """

    filer_id: str
    filer_name: str
    party: Optional[str] = None
    chamber: Optional[str] = None
    branch: Optional[str] = None
    state: Optional[str] = None
    office: Optional[str] = None
    agency: Optional[str] = None
    bioguide_id: Optional[str] = None
    source: str = "kadoa"
    # Q10.2 — aggregate stats from kadoa filers.json (None on trades-path upsert)
    photo_url: Optional[str] = None
    trade_count: Optional[int] = None
    purchases: Optional[int] = None
    sales: Optional[int] = None
    late_filings: Optional[int] = None
    est_volume: Optional[int] = None  # BIGINT in DB; JSON float rounded in parse_filers


@dataclass(frozen=True)
class PoliticianTradeRow:
    """One disclosed transaction event -> politician_trades (PK external_id).

    ``external_id`` is the kadoa ``id`` field (globally unique dedup key).
    ``disclosure_date`` is kadoa ``filing_date`` (the signal date; NOT NULL).
    ``transaction_date`` is the actual trade date (nullable — kadoa may omit).
    ``value_estimate`` is the geometric-mean midpoint of [value_min, value_max];
    None when either bound is absent.
    Soft-delete only (``deleted_at`` managed by DB / upsert; not stored here).
    """

    external_id: str
    filer_id: str
    disclosure_date: date
    transaction_type: str                  # 'buy'|'sell'|'exchange'
    asset_type: str                        # 'equity'|'bond'|'option'|'other'
    transaction_date: Optional[date] = None
    transaction_type_raw: Optional[str] = None
    filer_owner: Optional[str] = None     # 'self'|'spouse'|'joint'|'dependent'
    owner_raw: Optional[str] = None
    asset_type_raw: Optional[str] = None
    ticker: Optional[str] = None
    asset_name: Optional[str] = None
    value_min: Optional[int] = None
    value_max: Optional[int] = None
    value_estimate: Optional[int] = None
    value_label: Optional[str] = None
    doc_url: Optional[str] = None
    source_id: Optional[str] = None
    filing_type: Optional[str] = None
    days_to_file: Optional[int] = None
    is_late: Optional[bool] = None
    source: str = "kadoa"


@dataclass(frozen=True)
class PoliticianCommitteeRow:
    """One committee membership for a current-serving member (PK bioguide_id, committee_thomas_id).

    Source: unitedstates/congress-legislators committees-current.yaml +
    committee-membership-current.yaml (CC0). Current members only — historical
    committee memberships are not available. Soft-delete (deleted_at) managed
    by DB / upsert; not stored here.
    """

    bioguide_id: str
    committee_thomas_id: str
    committee_name: str
    committee_type: str            # 'house' | 'senate' | 'joint'
    title: Optional[str] = None   # 'Chair', 'Ranking Member', etc.
    source: str = "congress-legislators"


# --- Output rows (Phase R — signal backtest) --------------------------------


@dataclass(frozen=True)
class SignalBacktestRow:
    """One forward-return observation -> signal_backtest (PK signal_type, ticker, as_of, horizon_days).

    ``car`` is the cumulative (abnormal) return over the horizon window.
    ``is_hit`` is True when the directional prediction was correct (car>0 for
    buy-like signals; car<0 for sell-like). Both may be None when price data is
    insufficient. Soft-delete (deleted_at) managed by DB / upsert; not stored here.
    """

    signal_type: str           # 'politician_buy' | 'politician_sell' | '13f_new_position'
    ticker: str
    as_of: date                # event date (disclosure_date / filing_date)
    horizon_days: int          # 1 | 5 | 21
    car: Optional[float] = None
    is_hit: Optional[bool] = None
