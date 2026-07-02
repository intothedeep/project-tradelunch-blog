"""Tests for Phase Q backfill entrypoint and per-filer failure isolation.

Covers:
  * trades[] from kadoa_filer_detail_sample.json parse cleanly through parse_trades
  * per-filer failure isolation: one bad filer (network error) does not abort
    the loop; other filers are still processed
  * --dry-run path does not call any DB sink function
  * --limit N restricts how many filers are visited

No network calls; no DB; pure fixture + mocking.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from collector.transform.politician_parse import parse_trades

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_DETAIL_FIXTURE = Path(__file__).parent / "kadoa_filer_detail_sample.json"
_FILERS_FIXTURE = Path(__file__).parent / "kadoa_filers_sample.json"


@pytest.fixture(scope="module")
def filer_detail() -> dict:
    return json.loads(_DETAIL_FIXTURE.read_text())


@pytest.fixture(scope="module")
def filers_list() -> list[dict]:
    return json.loads(_FILERS_FIXTURE.read_text())


# ---------------------------------------------------------------------------
# parse_trades against filer_detail_sample trades[]
# ---------------------------------------------------------------------------


def test_filer_detail_trades_parse_without_error(filer_detail):
    """All trades in the filer detail fixture parse through parse_trades cleanly."""
    trades_raw = filer_detail["trades"]
    trade_rows, registry_rows = parse_trades(trades_raw)
    assert len(trade_rows) == len(trades_raw), (
        "every trade with valid id + filing_date + filer_id must produce a row"
    )


def test_filer_detail_trade_rows_have_expected_filer(filer_detail):
    """All parsed trade rows belong to the filer declared in the detail envelope."""
    trades_raw = filer_detail["trades"]
    expected_filer_id = filer_detail["filer"]["id"]
    trade_rows, _ = parse_trades(trades_raw)
    assert all(t.filer_id == expected_filer_id for t in trade_rows)


def test_filer_detail_registry_deduped_to_one(filer_detail):
    """All trades share the same filer -> exactly one registry row."""
    trades_raw = filer_detail["trades"]
    _, registry_rows = parse_trades(trades_raw)
    assert len(registry_rows) == 1
    assert registry_rows[0].filer_id == filer_detail["filer"]["id"]


def test_filer_detail_external_ids_unique(filer_detail):
    """external_id is distinct per trade (no duplicates in the fixture)."""
    trades_raw = filer_detail["trades"]
    trade_rows, _ = parse_trades(trades_raw)
    ids = [t.external_id for t in trade_rows]
    assert len(ids) == len(set(ids))


# ---------------------------------------------------------------------------
# Per-filer failure isolation (dry-run path)
# ---------------------------------------------------------------------------


def test_dry_run_isolates_filer_failure(filers_list):
    """A fetch error on one filer must NOT abort the loop.

    Simulate: first filer raises RuntimeError; second filer succeeds.
    Verify: filer_failures=1 is reported; return code is 0.
    """
    good_detail = json.loads(_DETAIL_FIXTURE.read_text())
    first_id = filers_list[0]["id"]

    def mock_fetch_filer_detail(filer_id: str) -> dict:
        if filer_id == first_id:
            raise RuntimeError("simulated network error")
        return good_detail

    captured_output: list[str] = []

    def mock_print(*args, **kwargs):
        captured_output.append(" ".join(str(a) for a in args))

    with (
        patch(
            "collector.entrypoints.backfill_politician_trades.fetch_filers",
            return_value=filers_list,
        ),
        patch(
            "collector.entrypoints.backfill_politician_trades.fetch_filer_detail",
            side_effect=mock_fetch_filer_detail,
        ),
        patch(
            "collector.entrypoints.backfill_politician_trades.database_url",
            return_value=None,
        ),
        patch("builtins.print", side_effect=mock_print),
    ):
        from collector.entrypoints.backfill_politician_trades import main
        rc = main(["--dry-run", "--limit", "2"])

    assert rc == 0, "dry-run must exit 0 even when a filer fails"

    summary_lines = [line for line in captured_output if "filer_failures" in line]
    assert summary_lines, "summary must log filer_failures"
    assert "filer_failures=1" in summary_lines[-1], (
        f"expected filer_failures=1 in: {summary_lines[-1]}"
    )


def test_dry_run_no_db_calls(filers_list):
    """--dry-run must never call upsert_trades or upsert_politicians."""
    good_detail = json.loads(_DETAIL_FIXTURE.read_text())

    with (
        patch(
            "collector.entrypoints.backfill_politician_trades.fetch_filers",
            return_value=filers_list[:1],
        ),
        patch(
            "collector.entrypoints.backfill_politician_trades.fetch_filer_detail",
            return_value=good_detail,
        ),
        patch(
            "collector.entrypoints.backfill_politician_trades.database_url",
            return_value=None,
        ),
        patch(
            "collector.entrypoints.backfill_politician_trades.upsert_trades"
        ) as mock_upsert_trades,
        patch(
            "collector.entrypoints.backfill_politician_trades.upsert_politicians"
        ) as mock_upsert_politicians,
        patch(
            "collector.entrypoints.backfill_politician_trades.upsert_politicians_enriched"
        ) as mock_upsert_enriched,
    ):
        from collector.entrypoints.backfill_politician_trades import main as backfill_main
        rc = backfill_main(["--dry-run"])

    assert rc == 0
    mock_upsert_trades.assert_not_called()
    mock_upsert_politicians.assert_not_called()
    mock_upsert_enriched.assert_not_called()


# ---------------------------------------------------------------------------
# --limit flag
# ---------------------------------------------------------------------------


def test_limit_restricts_filers_visited(filers_list):
    """--limit 3 must visit exactly 3 filers regardless of total filers count."""
    good_detail = json.loads(_DETAIL_FIXTURE.read_text())
    visited: list[str] = []

    def tracking_fetch(filer_id: str) -> dict:
        visited.append(filer_id)
        return good_detail

    with (
        patch(
            "collector.entrypoints.backfill_politician_trades.fetch_filers",
            return_value=filers_list,
        ),
        patch(
            "collector.entrypoints.backfill_politician_trades.fetch_filer_detail",
            side_effect=tracking_fetch,
        ),
        patch(
            "collector.entrypoints.backfill_politician_trades.database_url",
            return_value=None,
        ),
    ):
        from collector.entrypoints.backfill_politician_trades import main as backfill_main3
        rc = backfill_main3(["--dry-run", "--limit", "3"])

    assert rc == 0
    assert len(visited) == 3, f"expected 3 visited, got {len(visited)}"
