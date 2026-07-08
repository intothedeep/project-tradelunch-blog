import pytest

from collector.config.watchlist_loader import (
    WatchlistError,
    load_watchlist,
    parse_watchlist,
)
from collector.transform.mapping import index_by_label


def test_real_watchlist_loads_47_globally_unique_labels():
    entries = load_watchlist()
    assert len(entries) == 47
    idx = index_by_label(entries)  # raises on collision
    assert len(idx) == 47


def test_real_watchlist_category_counts():
    entries = load_watchlist()
    counts: dict[str, int] = {}
    for e in entries:
        counts[e.category] = counts.get(e.category, 0) + 1
    assert counts == {"fx": 4, "crypto": 3, "rates": 4, "indices": 9, "stocks": 27}


def test_real_watchlist_fx_source_native_and_rates_yields():
    by_symbol = {e.symbol: e for e in load_watchlist()}
    assert by_symbol["KRW=X"].label == "USD/KRW"
    assert by_symbol["EURUSD=X"].label == "EUR/USD"
    for sym in ("^IRX", "^FVX", "^TNX", "^TYX"):
        assert sym in by_symbol and by_symbol[sym].category == "rates"


def test_real_watchlist_stocks_have_exchange():
    for e in load_watchlist():
        if e.category == "stocks":
            assert e.exchange in ("US", "KRX")
        else:
            assert e.exchange is None


def test_vol_indices_present_with_raw_symbol_labels():
    """^VXN and ^VIX use raw-symbol labels (synth inputs, not user-facing)."""
    by_symbol = {e.symbol: e for e in load_watchlist()}
    assert by_symbol["^VXN"].label == "^VXN"
    assert by_symbol["^VXN"].category == "indices"
    assert by_symbol["^VIX"].label == "^VIX"
    assert by_symbol["^VIX"].category == "indices"


def test_fx_label_must_be_source_native():
    # USD/EUR is the inverted (wrong) direction for EURUSD=X (-> EUR/USD)
    with pytest.raises(WatchlistError):
        parse_watchlist({"fx": [{"symbol": "EURUSD=X", "label": "USD/EUR"}]})


def test_invalid_category_rejected():
    with pytest.raises(WatchlistError):
        parse_watchlist({"bogus": [{"symbol": "X", "label": "X"}]})


def test_stocks_without_exchange_rejected():
    with pytest.raises(WatchlistError):
        parse_watchlist({"stocks": [{"symbol": "X", "label": "X"}]})


def test_non_stocks_with_exchange_rejected():
    with pytest.raises(WatchlistError):
        parse_watchlist({"fx": [{"symbol": "X=X", "label": "X", "exchange": "US"}]})


def test_duplicate_label_rejected():
    with pytest.raises(Exception):
        parse_watchlist(
            {
                "stocks": [
                    {"symbol": "A", "label": "DUP", "exchange": "US"},
                    {"symbol": "B", "label": "DUP", "exchange": "US"},
                ]
            }
        )
