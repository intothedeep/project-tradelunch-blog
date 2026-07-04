"""Typed row definitions for options-chain + GEX pipeline (Phase V-collect).

ChainRow:    one contract row fetched from an options provider (intermediate).
GexDailyRow: derived daily scalar written to gex_daily (stored).

Side effects: none (pure data definitions).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional

__all__ = ["ChainRow", "GexDailyRow"]


@dataclass(frozen=True)
class ChainRow:
    """One options contract from a provider (not stored — intermediate shape).

    ``t_years``: time to expiry in years, computed as max((expiry - as_of).days, 0) / 365.25.
    ``iv``:      annualised implied volatility (decimal; e.g. 0.30 = 30 %).
    ``open_interest``: contracts outstanding; None when provider omits it (aggregate_gex skips).
    ``put_call``: normalised to upper-case 'CALL' | 'PUT' by the provider layer.
    """

    underlying: str
    expiry: date
    strike: float
    put_call: str              # 'CALL' | 'PUT'
    open_interest: Optional[int] = None
    iv: Optional[float] = None
    t_years: Optional[float] = None


@dataclass(frozen=True)
class GexDailyRow:
    """Derived daily GEX observation written to gex_daily (PK as_of, ticker).

    net_gex  = call_gex − put_gex  ($ per 1 % spot move, full chain).
    call_gex / put_gex: unsigned sub-totals; sign is implicit in the column name.
    spot:    underlying price used in the calculation (yfinance fast_info.last_price).
    source:  provider key that produced the chain (e.g. 'yfinance').

    Soft-delete aware: deleted_at managed by DB / upsert; not stored here.
    """

    as_of: date
    ticker: str
    net_gex: float
    call_gex: float
    put_gex: float
    spot: float
    source: str
