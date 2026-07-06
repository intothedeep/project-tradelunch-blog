import pytest

from collector.config.watchlist_loader import (
    WatchlistError,
    load_watchlist,
    parse_watchlist,
)
from collector.transform.mapping import index_by_label


def test_real_watchlist_loads_45_globally_unique_labels():
    entries = load_watchlist()
    assert len(entries) == 45
    idx = index_by_label(entries)  # raises on collision
    assert len(idx) == 45


def test_real_watchlist_category_counts():
    entries = load_watchlist()
    counts: dict[str, int] = {}
    for e in entries:
        counts[e.category] = counts.get(e.category, 0) + 1
    assert counts == {"fx": 4, "crypto": 3, "rates": 4, "indices": 7, "stocks": 27}


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
