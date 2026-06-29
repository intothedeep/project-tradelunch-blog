from collector.schema.rows import TrackedSymbol, WatchlistEntry
from collector.transform.universe_resolve import resolve_universe


def test_union_includes_tracked_only_symbol():
    yaml = [WatchlistEntry("AAPL", "AAPL", "stocks", "US")]
    tracked = [TrackedSymbol("NVDA", "stocks", "NVDA", exchange="US")]
    out = resolve_universe(yaml, tracked)
    symbols = [e.symbol for e in out]
    assert symbols == ["AAPL", "NVDA"]


def test_yaml_wins_on_overlap():
    yaml = [WatchlistEntry("AAPL", "Apple Inc", "stocks", "US")]
    tracked = [TrackedSymbol("AAPL", "stocks", "AAPL-tracked", exchange="KRX")]
    out = resolve_universe(yaml, tracked)
    assert len(out) == 1
    assert out[0].label == "Apple Inc" and out[0].exchange == "US"


def test_empty_tracked_returns_yaml_only():
    yaml = [WatchlistEntry("AAPL", "AAPL", "stocks", "US")]
    out = resolve_universe(yaml, [])
    assert [e.symbol for e in out] == ["AAPL"]


def test_dedupe_within_yaml():
    yaml = [
        WatchlistEntry("AAPL", "AAPL", "stocks", "US"),
        WatchlistEntry("AAPL", "AAPL2", "stocks", "US"),
    ]
    out = resolve_universe(yaml, [])
    assert len(out) == 1 and out[0].label == "AAPL"
