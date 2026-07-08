"""Spec: backtest universe exemption from market_history prune (XE.6).

Tests:
  1. BACKTEST_RETAIN_LABELS contains exactly the 13 expected labels (pure).
  2. read_prune_candidates with exempt_labels excludes an exempt label (QQQ)
     even when the DB would return it.
  3. read_prune_candidates without exempt_labels still returns all labels
     (non-exempt behaviour unchanged).
  4. A non-exempt label (AAPL) IS included in candidates as before.

No network, no real DB — all IO dependencies are mocked.
"""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock

import pytest

from collector.transform.retention import BACKTEST_RETAIN_LABELS
from collector.sink.db_sink import read_prune_candidates


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _mock_conn(rows: list[tuple]) -> MagicMock:
    """Build a mock psycopg Connection whose cursor().fetchall() returns rows."""
    mock_cur = MagicMock()
    mock_cur.__enter__ = lambda s: mock_cur
    mock_cur.__exit__ = MagicMock(return_value=False)
    mock_cur.fetchall.return_value = rows
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cur
    return mock_conn


_CUTOFF = date(2026, 1, 1)

# Simulate DB returning rows that include both an exempt and a non-exempt label
_DB_ROWS = [
    ("QQQ",  date(1999, 3, 10), 6752),   # exempt — deep history since 1999
    ("AAPL", date(2018, 1, 2),  1825),   # non-exempt — regular label
]


# ---------------------------------------------------------------------------
# 1. Allowlist constant — pure checks
# ---------------------------------------------------------------------------

class TestBacktestRetainLabels:
    def test_contains_exactly_13_labels(self):
        assert len(BACKTEST_RETAIN_LABELS) == 13

    def test_contains_all_expected_labels(self):
        expected = {
            "QQQ", "QQQM", "QLD", "TQQQ",
            "SPY", "SCHD", "JEPQ", "VOO", "VOOG",
            "NASDAQ Composite", "NASDAQ 100",
            "^VXN", "^VIX",
        }
        assert BACKTEST_RETAIN_LABELS == expected

    def test_is_frozenset(self):
        assert isinstance(BACKTEST_RETAIN_LABELS, frozenset)

    def test_vol_indices_included(self):
        """^VXN and ^VIX must be exempt so structural-synth backtest history is preserved."""
        assert "^VXN" in BACKTEST_RETAIN_LABELS
        assert "^VIX" in BACKTEST_RETAIN_LABELS


# ---------------------------------------------------------------------------
# 2. Exempt label is excluded from candidates
# ---------------------------------------------------------------------------

class TestExemptLabelNotPruned:
    def test_qqq_not_in_candidates_when_exempt(self):
        conn = _mock_conn(_DB_ROWS)
        result = read_prune_candidates(conn, _CUTOFF, exempt_labels=BACKTEST_RETAIN_LABELS)
        assert "QQQ" not in result

    def test_exempt_label_with_ancient_bars_excluded(self):
        """QQQ has bars from 1999 — would be a prune candidate without exemption."""
        conn = _mock_conn(_DB_ROWS)
        result = read_prune_candidates(conn, _CUTOFF, exempt_labels=BACKTEST_RETAIN_LABELS)
        # Verify QQQ's ancient bars don't appear even though min_date is 1999
        for label, (min_date, _) in result.items():
            assert label != "QQQ"

    def test_all_backtest_labels_excluded(self):
        """All 13 backtest labels are excluded when BACKTEST_RETAIN_LABELS is passed."""
        rows = [(label, date(2000, 1, 1), 100) for label in BACKTEST_RETAIN_LABELS]
        rows.append(("MSFT", date(2015, 1, 1), 500))  # non-exempt
        conn = _mock_conn(rows)
        result = read_prune_candidates(conn, _CUTOFF, exempt_labels=BACKTEST_RETAIN_LABELS)
        for label in BACKTEST_RETAIN_LABELS:
            assert label not in result
        assert "MSFT" in result

    def test_vol_indices_excluded_from_candidates(self):
        """^VXN and ^VIX with deep history are excluded when exempt_labels is passed."""
        rows = [
            ("^VXN", date(2001, 1, 2), 6500),
            ("^VIX", date(1990, 1, 2), 9000),
            ("AAPL", date(2018, 1, 2), 1825),
        ]
        conn = _mock_conn(rows)
        result = read_prune_candidates(conn, _CUTOFF, exempt_labels=BACKTEST_RETAIN_LABELS)
        assert "^VXN" not in result
        assert "^VIX" not in result
        assert "AAPL" in result


# ---------------------------------------------------------------------------
# 3. Non-exempt label is still pruned (existing behaviour unchanged)
# ---------------------------------------------------------------------------

class TestNonExemptLabelStillPruned:
    def test_aapl_is_in_candidates(self):
        conn = _mock_conn(_DB_ROWS)
        result = read_prune_candidates(conn, _CUTOFF, exempt_labels=BACKTEST_RETAIN_LABELS)
        assert "AAPL" in result

    def test_aapl_candidate_data_preserved(self):
        conn = _mock_conn(_DB_ROWS)
        result = read_prune_candidates(conn, _CUTOFF, exempt_labels=BACKTEST_RETAIN_LABELS)
        min_date, count = result["AAPL"]
        assert min_date == date(2018, 1, 2)
        assert count == 1825

    def test_no_exempt_arg_returns_all_labels(self):
        """Default behaviour (no exempt_labels) is backward-compatible."""
        conn = _mock_conn(_DB_ROWS)
        result = read_prune_candidates(conn, _CUTOFF)
        assert "QQQ" in result
        assert "AAPL" in result
