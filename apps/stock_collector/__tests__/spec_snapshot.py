from datetime import date, datetime

from collector.schema.rows import HistoryRow, WatchlistEntry
from collector.transform.snapshot import build_snapshot

FETCHED = datetime(2026, 1, 3, 12, 0, 0)


def _hist(label, d, close):
    return HistoryRow(label, "1d", d, close, close, close, close, 0)


def test_two_change_columns_computed():
    hist = [
        _hist("AAPL", date(2026, 1, 1), 100.0),
        _hist("AAPL", date(2026, 1, 2), 110.0),
    ]
    snap = build_snapshot(WatchlistEntry("AAPL", "AAPL", "stocks", "US"), hist, FETCHED)
    assert snap is not None
    assert snap.value == 110.0
    assert snap.change_absolute == 10.0
    assert abs(snap.change_percent - 10.0) < 1e-9


def test_stocks_set_ticker_and_exchange():
    hist = [_hist("AAPL", date(2026, 1, 1), 5.0), _hist("AAPL", date(2026, 1, 2), 6.0)]
    snap = build_snapshot(WatchlistEntry("AAPL", "AAPL", "stocks", "US"), hist, FETCHED)
    assert snap.ticker == "AAPL" and snap.exchange == "US"


def test_non_stocks_have_no_ticker_or_exchange():
    hist = [_hist("BTC/USD", date(2026, 1, 1), 1.0), _hist("BTC/USD", date(2026, 1, 2), 2.0)]
    snap = build_snapshot(WatchlistEntry("BTC-USD", "BTC/USD", "crypto"), hist, FETCHED)
    assert snap.ticker is None and snap.exchange is None
    assert snap.revalidate_seconds == 30  # crypto


def test_revalidate_per_category_and_as_of_is_latest_bar():
    hist = [_hist("USD/KRW", date(2026, 1, 2), 1300.0)]
    snap = build_snapshot(WatchlistEntry("KRW=X", "USD/KRW", "fx"), hist, FETCHED)
    assert snap.revalidate_seconds == 60  # fx
    assert snap.as_of == date(2026, 1, 2)
    assert snap.fetched_at == FETCHED


def test_single_bar_change_zero():
    hist = [_hist("X", date(2026, 1, 1), 100.0)]
    snap = build_snapshot(WatchlistEntry("X", "X", "stocks", "US"), hist, FETCHED)
    assert snap.change_absolute == 0.0 and snap.change_percent == 0.0


def test_empty_history_returns_none():
    assert build_snapshot(WatchlistEntry("X", "X", "stocks", "US"), [], FETCHED) is None
