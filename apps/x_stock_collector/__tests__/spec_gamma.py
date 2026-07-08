"""Unit tests for transform/gamma.py — pure math, no network, no DB.

Covers:
  * bs_gamma: known Black-Scholes value (ATM, 1-year, 20% IV)
  * bs_gamma: degenerate guards (T→0, IV→0, spot/strike ≤ 0)
  * contract_gex: call returns positive value
  * contract_gex: put returns negative value
  * aggregate_gex: call/put sign convention (calls +, puts -)
  * aggregate_gex: skips rows with missing OI, zero IV, zero T
  * aggregate_gex: empty list → (0.0, 0.0, 0.0)
  * aggregate_gex: net_gex = call_gex - put_gex invariant
  * chain_provider registry: KeyError on unknown provider
  * chain_provider parse: hand-built fixture round-trip (no network)
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from collector.schema.chain_rows import ChainRow
from collector.sink.chain_provider import PROVIDER_YFINANCE, fetch_chain, fetch_spot
from collector.transform.gamma import aggregate_gex, bs_gamma, contract_gex


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row(
    *,
    put_call: str,
    strike: float = 100.0,
    oi: int | None = 1000,
    iv: float | None = 0.20,
    t_years: float | None = 1.0,
    underlying: str = "TEST",
) -> ChainRow:
    """Build a minimal ChainRow for test fixtures."""
    return ChainRow(
        underlying=underlying,
        expiry=date.today() + timedelta(days=int((t_years or 1.0) * 365)),
        strike=strike,
        put_call=put_call,
        open_interest=oi,
        iv=iv,
        t_years=t_years,
    )


# ---------------------------------------------------------------------------
# bs_gamma — known value
# ---------------------------------------------------------------------------

class TestBsGamma:
    def test_atm_one_year_20iv(self) -> None:
        """ATM option: S=K=100, T=1yr, σ=0.20, r=0.
        Expected γ = φ(d1) / (S·σ·√T) where d1 = σ/2 = 0.10.
        φ(0.10) ≈ 0.39695; denominator = 100 * 0.20 * 1.0 = 20.
        γ ≈ 0.01985.
        """
        g = bs_gamma(spot=100.0, strike=100.0, t_years=1.0, iv=0.20)
        assert g is not None
        assert abs(g - 0.01985) < 1e-4

    def test_itm_call(self) -> None:
        """Deep ITM (S >> K): gamma should be small positive (tails of φ)."""
        g = bs_gamma(spot=200.0, strike=100.0, t_years=1.0, iv=0.20)
        assert g is not None
        assert 0 < g < 0.001

    def test_otm_call(self) -> None:
        """Deep OTM (S << K): gamma should be small positive (tails of φ)."""
        g = bs_gamma(spot=50.0, strike=100.0, t_years=1.0, iv=0.20)
        assert g is not None
        assert 0 < g < 0.001

    def test_gamma_always_positive(self) -> None:
        """Gamma is always non-negative (calls and puts share the same γ)."""
        for s, k, t, v in [
            (100, 100, 0.5, 0.30),
            (150, 100, 2.0, 0.15),
            (80,  100, 0.25, 0.50),
        ]:
            g = bs_gamma(spot=s, strike=k, t_years=t, iv=v)
            assert g is not None and g >= 0.0

    def test_t_zero_returns_none(self) -> None:
        """T → 0 is degenerate; bs_gamma must return None."""
        assert bs_gamma(spot=100.0, strike=100.0, t_years=0.0, iv=0.20) is None
        assert bs_gamma(spot=100.0, strike=100.0, t_years=1e-7, iv=0.20) is None

    def test_iv_zero_returns_none(self) -> None:
        """σ → 0 is degenerate; bs_gamma must return None."""
        assert bs_gamma(spot=100.0, strike=100.0, t_years=1.0, iv=0.0) is None
        assert bs_gamma(spot=100.0, strike=100.0, t_years=1.0, iv=1e-7) is None

    def test_spot_zero_returns_none(self) -> None:
        assert bs_gamma(spot=0.0, strike=100.0, t_years=1.0, iv=0.20) is None

    def test_strike_zero_returns_none(self) -> None:
        assert bs_gamma(spot=100.0, strike=0.0, t_years=1.0, iv=0.20) is None

    def test_negative_spot_returns_none(self) -> None:
        assert bs_gamma(spot=-1.0, strike=100.0, t_years=1.0, iv=0.20) is None


# ---------------------------------------------------------------------------
# contract_gex — sign convention
# ---------------------------------------------------------------------------

class TestContractGex:
    def test_call_is_positive(self) -> None:
        g = bs_gamma(100.0, 100.0, 1.0, 0.20)
        assert g is not None
        result = contract_gex(g, 1000, 100.0, "CALL")
        assert result > 0.0

    def test_put_is_negative(self) -> None:
        g = bs_gamma(100.0, 100.0, 1.0, 0.20)
        assert g is not None
        result = contract_gex(g, 1000, 100.0, "PUT")
        assert result < 0.0

    def test_call_put_equal_magnitude(self) -> None:
        """Same inputs for CALL vs PUT → equal magnitude, opposite sign."""
        g = bs_gamma(100.0, 100.0, 1.0, 0.20)
        assert g is not None
        c = contract_gex(g, 500, 100.0, "CALL")
        p = contract_gex(g, 500, 100.0, "PUT")
        assert abs(c + p) < 1e-10

    def test_case_insensitive(self) -> None:
        g = bs_gamma(100.0, 100.0, 1.0, 0.20)
        assert g is not None
        assert contract_gex(g, 100, 100.0, "call") > 0.0
        assert contract_gex(g, 100, 100.0, "put") < 0.0

    def test_zero_oi_returns_zero(self) -> None:
        g = bs_gamma(100.0, 100.0, 1.0, 0.20)
        assert g is not None
        assert contract_gex(g, 0, 100.0, "CALL") == 0.0


# ---------------------------------------------------------------------------
# aggregate_gex — full chain aggregation
# ---------------------------------------------------------------------------

class TestAggregateGex:
    def test_empty_rows_returns_zeros(self) -> None:
        net, call, put = aggregate_gex([], spot=100.0)
        assert net == 0.0
        assert call == 0.0
        assert put == 0.0

    def test_net_equals_call_minus_put(self) -> None:
        rows = [_row(put_call="CALL"), _row(put_call="PUT")]
        net, call, put = aggregate_gex(rows, spot=100.0)
        assert abs(net - (call - put)) < 1e-10

    def test_call_gex_positive_component(self) -> None:
        rows = [_row(put_call="CALL")]
        net, call, put = aggregate_gex(rows, spot=100.0)
        assert call > 0.0
        assert put == 0.0
        assert net > 0.0

    def test_put_gex_reduces_net(self) -> None:
        rows = [_row(put_call="PUT")]
        net, call, put = aggregate_gex(rows, spot=100.0)
        assert put > 0.0
        assert call == 0.0
        assert net < 0.0

    def test_skips_none_oi(self) -> None:
        rows = [_row(put_call="CALL", oi=None)]
        net, call, put = aggregate_gex(rows, spot=100.0)
        assert net == 0.0

    def test_skips_zero_oi(self) -> None:
        rows = [_row(put_call="CALL", oi=0)]
        net, call, put = aggregate_gex(rows, spot=100.0)
        assert net == 0.0

    def test_skips_none_iv(self) -> None:
        rows = [_row(put_call="CALL", iv=None)]
        net, call, put = aggregate_gex(rows, spot=100.0)
        assert net == 0.0

    def test_skips_zero_iv(self) -> None:
        rows = [_row(put_call="CALL", iv=0.0)]
        net, call, put = aggregate_gex(rows, spot=100.0)
        assert net == 0.0

    def test_skips_none_t_years(self) -> None:
        rows = [_row(put_call="CALL", t_years=None)]
        net, call, put = aggregate_gex(rows, spot=100.0)
        assert net == 0.0

    def test_skips_expired_t_years(self) -> None:
        rows = [_row(put_call="CALL", t_years=0.0)]
        net, call, put = aggregate_gex(rows, spot=100.0)
        assert net == 0.0

    def test_mixed_call_put_sign(self) -> None:
        """Equal call and put OI at ATM → call_gex == put_gex, net ≈ 0."""
        rows = [
            _row(put_call="CALL", oi=500),
            _row(put_call="PUT", oi=500),
        ]
        net, call, put = aggregate_gex(rows, spot=100.0)
        assert abs(net) < 1e-10
        assert call > 0.0
        assert put > 0.0

    def test_additive_across_multiple_calls(self) -> None:
        """Two identical CALL rows → double the single-row GEX."""
        single = aggregate_gex([_row(put_call="CALL", oi=1000)], spot=100.0)
        double = aggregate_gex(
            [_row(put_call="CALL", oi=1000), _row(put_call="CALL", oi=1000)],
            spot=100.0,
        )
        assert abs(double[0] - 2 * single[0]) < 1e-10

    def test_contract_gex_formula_components(self) -> None:
        """Verify contract_gex = gamma * OI * 100 * S^2 * 0.01 (formula integrity)."""
        g = 0.02  # fixed synthetic gamma
        oi = 1000
        spot = 150.0
        expected = g * oi * 100.0 * (spot ** 2) * 0.01
        result = contract_gex(g, oi, spot, "CALL")
        assert abs(result - expected) < 1e-10


# ---------------------------------------------------------------------------
# chain_provider — registry + parse (no live network)
# ---------------------------------------------------------------------------

class TestChainProviderRegistry:
    def test_unknown_provider_fetch_chain_raises(self) -> None:
        with pytest.raises(KeyError, match="unknown_provider"):
            fetch_chain("unknown_provider", "AAPL")

    def test_unknown_provider_fetch_spot_raises(self) -> None:
        with pytest.raises(KeyError, match="unknown_provider"):
            fetch_spot("unknown_provider", "AAPL")

    def test_provider_yfinance_constant(self) -> None:
        assert PROVIDER_YFINANCE == "yfinance"


class TestChainRowParse:
    """Parse logic for _frame_to_rows via a hand-built fixture (no network)."""

    def test_valid_call_row(self) -> None:
        from collector.sink.chain_provider import _frame_to_rows  # type: ignore[attr-defined]
        import pandas as pd

        exp = date.today() + timedelta(days=30)
        frame = pd.DataFrame([{"strike": 150.0, "impliedVolatility": 0.25, "openInterest": 500}])
        rows = _frame_to_rows(frame, "AAPL", exp, "CALL", 30 / 365.25)
        assert len(rows) == 1
        row = rows[0]
        assert row.put_call == "CALL"
        assert row.strike == 150.0
        assert row.iv == pytest.approx(0.25)
        assert row.open_interest == 500

    def test_missing_strike_skipped(self) -> None:
        from collector.sink.chain_provider import _frame_to_rows
        import pandas as pd

        exp = date.today() + timedelta(days=30)
        frame = pd.DataFrame([{"strike": None, "impliedVolatility": 0.25, "openInterest": 100}])
        rows = _frame_to_rows(frame, "TEST", exp, "PUT", 30 / 365.25)
        assert rows == []

    def test_zero_strike_skipped(self) -> None:
        from collector.sink.chain_provider import _frame_to_rows
        import pandas as pd

        exp = date.today() + timedelta(days=30)
        frame = pd.DataFrame([{"strike": 0.0, "impliedVolatility": 0.25, "openInterest": 100}])
        rows = _frame_to_rows(frame, "TEST", exp, "PUT", 30 / 365.25)
        assert rows == []

    def test_zero_iv_stored_as_none(self) -> None:
        from collector.sink.chain_provider import _frame_to_rows
        import pandas as pd

        exp = date.today() + timedelta(days=30)
        frame = pd.DataFrame([{"strike": 100.0, "impliedVolatility": 0.0, "openInterest": 100}])
        rows = _frame_to_rows(frame, "TEST", exp, "CALL", 30 / 365.25)
        assert len(rows) == 1
        assert rows[0].iv is None

    def test_empty_frame_returns_empty(self) -> None:
        from collector.sink.chain_provider import _frame_to_rows
        import pandas as pd

        frame = pd.DataFrame()
        rows = _frame_to_rows(frame, "TEST", date.today(), "CALL", 0.5)
        assert rows == []
