"""IO boundary: fetch options chains from string-keyed providers.

Provider registry: PROVIDER_* constants + fetch_chain() / fetch_spot() dispatchers.
Mirrors the PROVIDER_YAHOO / PROVIDER_MASSIVE string-key idiom in lib/constants.

No ABC, no DI graph (KISS per repo rules). Adding a second provider (e.g. 'cboe'):
  1. Define PROVIDER_CBOE = 'cboe'
  2. Write _fetch_cboe() / _spot_cboe()
  3. Register them with @_chain_registry / @_spot_registry

Side effects: network only (yfinance HTTP). Never raises on network/parse failures —
returns [] / None so the entrypoint can skip gracefully.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from typing import Any, Optional

import yfinance as yf

from collector.schema.chain_rows import ChainRow

__all__ = [
    "PROVIDER_YFINANCE",
    "fetch_chain",
    "fetch_spot",
]

PROVIDER_YFINANCE = "yfinance"

# --- internal registries ----------------------------------------------------

_CHAIN_REGISTRY: dict[str, Callable[[str], list[ChainRow]]] = {}
_SPOT_REGISTRY: dict[str, Callable[[str], Optional[float]]] = {}


def _chain_reg(key: str) -> Callable:
    def decorator(fn: Callable) -> Callable:
        _CHAIN_REGISTRY[key] = fn
        return fn
    return decorator


def _spot_reg(key: str) -> Callable:
    def decorator(fn: Callable) -> Callable:
        _SPOT_REGISTRY[key] = fn
        return fn
    return decorator


# --- yfinance implementation ------------------------------------------------

@_spot_reg(PROVIDER_YFINANCE)
def _spot_yfinance(ticker: str) -> Optional[float]:
    """Return current spot price for ``ticker`` via yfinance fast_info."""
    try:
        price = yf.Ticker(ticker).fast_info.last_price
        if price is None or price != price:   # None or NaN
            return None
        return float(price)
    except Exception:  # noqa: BLE001 — network / parse error
        return None


@_chain_reg(PROVIDER_YFINANCE)
def _chain_yfinance(ticker: str) -> list[ChainRow]:
    """Fetch all expiry chains for ``ticker`` via yfinance.

    Skips expired expirations (t_years < 1e-6). Rows with missing / zero OI or IV
    carry None in those fields — aggregate_gex handles the guard.
    """
    rows: list[ChainRow] = []
    today = date.today()
    try:
        t = yf.Ticker(ticker)
        expirations: tuple[str, ...] = t.options or ()
        for exp_str in expirations:
            try:
                exp_date = date.fromisoformat(exp_str)
            except ValueError:
                continue
            days = (exp_date - today).days
            if days <= 0:
                continue
            t_years = days / 365.25
            chain = t.option_chain(exp_str)
            for frame, pc in ((chain.calls, "CALL"), (chain.puts, "PUT")):
                rows.extend(_frame_to_rows(frame, ticker, exp_date, pc, t_years))
    except Exception as exc:  # noqa: BLE001 — network / parse error → []
        print(f"[chain_provider] {ticker} fetch failed ({type(exc).__name__}: {exc})")
    return rows


# --- helpers ----------------------------------------------------------------

def _num(value: Any) -> Optional[float]:
    """None / NaN → None; else float(value)."""
    if value is None or value != value:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _frame_to_rows(
    frame: Any,
    underlying: str,
    expiry: date,
    put_call: str,
    t_years: float,
) -> list[ChainRow]:
    """Convert one calls/puts DataFrame to ChainRow list (no network)."""
    if frame is None or getattr(frame, "empty", True):
        return []
    result: list[ChainRow] = []
    for rec in frame.to_dict("records"):
        strike = _num(rec.get("strike"))
        if strike is None or strike <= 0.0:
            continue
        iv = _num(rec.get("impliedVolatility"))
        oi_raw = rec.get("openInterest")
        oi: Optional[int] = None
        if oi_raw is not None and oi_raw == oi_raw and oi_raw > 0:
            try:
                oi = int(oi_raw)
            except (TypeError, ValueError):
                pass
        result.append(
            ChainRow(
                underlying=underlying,
                expiry=expiry,
                strike=strike,
                put_call=put_call,
                open_interest=oi,
                iv=iv if iv is not None and iv > 0.0 else None,
                t_years=t_years,
            )
        )
    return result


# --- public API -------------------------------------------------------------

def fetch_spot(provider: str, ticker: str) -> Optional[float]:
    """Return current spot price for ``ticker`` via the registered provider.

    Args:
        provider: one of PROVIDER_* constants.
        ticker:   underlying symbol in provider-native format.

    Returns:
        Float price or None on failure.

    Raises:
        KeyError: when ``provider`` is not registered.
    """
    fn = _SPOT_REGISTRY.get(provider)
    if fn is None:
        raise KeyError(
            f"Unknown spot provider: {provider!r}. "
            f"Registered: {list(_SPOT_REGISTRY)}"
        )
    return fn(ticker)


def fetch_chain(provider: str, ticker: str) -> list[ChainRow]:
    """Dispatch to the registered chain provider and return ChainRow list.

    Args:
        provider: one of PROVIDER_* constants.
        ticker:   underlying symbol in provider-native format.

    Returns:
        List of ChainRow; [] on network/parse failure.

    Raises:
        KeyError: when ``provider`` is not registered.
    """
    fn = _CHAIN_REGISTRY.get(provider)
    if fn is None:
        raise KeyError(
            f"Unknown chain provider: {provider!r}. "
            f"Registered: {list(_CHAIN_REGISTRY)}"
        )
    return fn(ticker)
