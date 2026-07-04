"""Pure Black-Scholes gamma + Gamma Exposure (GEX) aggregation.

GEX sign convention (standard dealer-centric):
  * Calls → +GEX  (market-makers sold calls to retail → dealers are long gamma)
  * Puts  → −GEX  (market-makers sold puts to retail → dealers are short gamma)
  * net_gex = call_gex − put_gex   ($ per 1 % spot move, over full chain)

When net_gex > 0: dealers are net long gamma — they sell into rallies / buy dips
(dampening effect on vol). When net_gex < 0: dealers are net short gamma —
they buy into rallies / sell dips (amplifying effect).

Formula reference:
  d1 = [ln(S/K) + (r + σ²/2)·T] / (σ·√T)
  γ  = φ(d1) / (S·σ·√T)          where φ is the standard-normal PDF
  contract_gex = γ × OI × 100 × S² × 0.01

Invariants:
  * No imports of IO modules — pure math + schema only.
  * Never raises: degenerate inputs return None / skip silently.

Side effects: none.
"""

from __future__ import annotations

import math
from typing import Optional

from collector.schema.chain_rows import ChainRow

__all__ = [
    "bs_gamma",
    "contract_gex",
    "aggregate_gex",
]

_INV_SQRT_2PI: float = 1.0 / math.sqrt(2.0 * math.pi)


def _phi(x: float) -> float:
    """Standard-normal PDF φ(x). Deterministic, no side effects."""
    return _INV_SQRT_2PI * math.exp(-0.5 * x * x)


def bs_gamma(
    spot: float,
    strike: float,
    t_years: float,
    iv: float,
    r: float = 0.0,
) -> Optional[float]:
    """Black-Scholes gamma for a European option.

    Args:
        spot:    current underlying price S (must be > 0).
        strike:  option strike K (must be > 0).
        t_years: time to expiry in years (T).  Must be > 1e-6.
        iv:      annualised implied volatility σ (decimal; must be > 1e-6).
        r:       continuous risk-free rate (default 0.0).

    Returns:
        Gamma scalar; None when any input is degenerate (T→0, σ→0, S/K ≤ 0).

    WHY guard 1e-6: below this threshold the σ√T denominator underflows to
    ~0 and d1 diverges, producing meaningless spikes that corrupt aggregate GEX.
    """
    if spot <= 0.0 or strike <= 0.0:
        return None
    if t_years < 1e-6 or iv < 1e-6:
        return None
    sv = iv * math.sqrt(t_years)           # σ√T
    if sv < 1e-12:
        return None
    d1 = (math.log(spot / strike) + (r + 0.5 * iv * iv) * t_years) / sv
    return _phi(d1) / (spot * sv)


def contract_gex(
    gamma: float,
    open_interest: int,
    spot: float,
    put_call: str,
) -> float:
    """Dollar gamma contribution of a single contract row.

    unit: USD per 1 % underlying spot move.
    Calls return a positive value; puts return a negative value.

    Args:
        gamma:         BS gamma for this contract.
        open_interest: number of open contracts.
        spot:          current underlying price.
        put_call:      'CALL' or 'PUT' (case-insensitive).
    """
    raw = gamma * open_interest * 100.0 * (spot ** 2) * 0.01
    return raw if put_call.upper() == "CALL" else -raw


def aggregate_gex(
    rows: list[ChainRow],
    spot: float,
) -> tuple[float, float, float]:
    """Sum GEX across all contract rows for one underlying.

    Skips rows with missing / zero OI, zero IV, zero T, or degenerate gamma.
    Both call_gex and put_gex are returned as *unsigned* totals; net is signed.

    Args:
        rows: list of ChainRow for a single underlying symbol.
        spot: current underlying price used for all gamma calculations.

    Returns:
        (net_gex, call_gex, put_gex) — all floats; (0.0, 0.0, 0.0) when empty.
    """
    call_sum = 0.0
    put_sum = 0.0

    for row in rows:
        if row.open_interest is None or row.open_interest <= 0:
            continue
        if row.iv is None or row.iv <= 0.0:
            continue
        if row.t_years is None or row.t_years < 1e-6:
            continue

        g = bs_gamma(spot, row.strike, row.t_years, row.iv)
        if g is None:
            continue

        # unsigned scalar contribution
        contrib = g * row.open_interest * 100.0 * (spot ** 2) * 0.01
        if row.put_call.upper() == "CALL":
            call_sum += contrib
        else:
            put_sum += contrib

    net = call_sum - put_sum
    return net, call_sum, put_sum
