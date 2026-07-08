"""filter_universe — --symbols allow-list narrowing (Phase X backfill scoping)."""

import pytest

from collector.entrypoints.run_daily import filter_universe
from collector.schema.rows import WatchlistEntry

UNIVERSE = [
    WatchlistEntry("QQQ", "QQQ", "stocks", "US"),
    WatchlistEntry("JEPQ", "JEPQ", "stocks", "US"),
    WatchlistEntry("^GSPC", "S&P 500", "indices", None),
]


def test_empty_string_is_identity():
    assert filter_universe(UNIVERSE, "") == UNIVERSE


def test_filters_to_requested_labels_only():
    out = filter_universe(UNIVERSE, "QQQ,JEPQ")
    assert [e.label for e in out] == ["QQQ", "JEPQ"]


def test_case_and_space_insensitive():
    out = filter_universe(UNIVERSE, " qqq , Jepq ")
    assert [e.label for e in out] == ["QQQ", "JEPQ"]


def test_matches_by_symbol_when_label_differs():
    # indices carry a display label ("S&P 500") distinct from the ticker.
    out = filter_universe(UNIVERSE, "^GSPC")
    assert [e.label for e in out] == ["S&P 500"]


def test_unmatched_symbol_raises():
    with pytest.raises(SystemExit) as exc:
        filter_universe(UNIVERSE, "QQQ,NOSUCH")
    assert "NOSUCH" in str(exc.value)


def test_all_unmatched_raises():
    with pytest.raises(SystemExit):
        filter_universe(UNIVERSE, "ZZZ")
