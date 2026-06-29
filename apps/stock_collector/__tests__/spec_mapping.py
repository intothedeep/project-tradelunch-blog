import pytest

from collector.schema.rows import WatchlistEntry
from collector.transform.mapping import (
    LabelCollisionError,
    index_by_label,
    resolve_exchange,
)


def test_krx_suffix_resolves_to_krx():
    assert resolve_exchange("036570.KS") == "KRX"
    assert resolve_exchange("247540.KQ") == "KRX"


def test_non_krx_resolves_to_us():
    assert resolve_exchange("AAPL") == "US"
    assert resolve_exchange("BTC-USD") == "US"


def test_index_by_label_unique_ok():
    entries = [
        WatchlistEntry("AAPL", "AAPL", "stocks", "US"),
        WatchlistEntry("^GSPC", "S&P 500", "indices"),
    ]
    idx = index_by_label(entries)
    assert idx["AAPL"].symbol == "AAPL"
    assert idx["S&P 500"].symbol == "^GSPC"


def test_index_by_label_collision_raises():
    entries = [
        WatchlistEntry("AAPL", "DUP", "stocks", "US"),
        WatchlistEntry("MSFT", "DUP", "stocks", "US"),
    ]
    with pytest.raises(LabelCollisionError):
        index_by_label(entries)
