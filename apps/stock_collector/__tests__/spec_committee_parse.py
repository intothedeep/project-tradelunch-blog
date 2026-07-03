"""Unit tests for transform/committee_parse.py — pure, no network, no DB.

Covers:
  * Armed Services (defense) member → PoliticianCommitteeRow + "Industrials" sector
  * Banking committee → Financial Services + Real Estate sector map
  * No-match committee (Judiciary) → zero sector_map rows
  * Membership entry missing bioguide key → silently skipped
  * Membership thomas_id absent from committees dict → silently skipped
  * parse_committees with empty inputs → ([], [])
"""

from __future__ import annotations

import pytest

from collector.schema.rows import PoliticianCommitteeRow
from collector.transform.committee_parse import COMMITTEE_SECTOR_PATTERNS, parse_committees

# ---------------------------------------------------------------------------
# Minimal YAML-shaped fixtures (no network needed)
# ---------------------------------------------------------------------------

_ARMED_SERVICES = {
    "thomas_id": "HSAS",
    "name": "Armed Services",
    "type": "house",
}

_BANKING = {
    "thomas_id": "SSBK",
    "name": "Banking, Housing, and Urban Affairs",
    "type": "senate",
}

_JUDICIARY = {
    "thomas_id": "SSJU",
    "name": "Judiciary",
    "type": "senate",
}

_COMMITTEES = [_ARMED_SERVICES, _BANKING, _JUDICIARY]

_MEMBERSHIP = {
    "HSAS": [
        {"bioguide": "A000001", "title": "Chair"},
        {"bioguide": "A000002"},  # no title
    ],
    "SSBK": [
        {"bioguide": "B000001"},
    ],
    "SSJU": [
        {"bioguide": "C000001"},
    ],
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestParseCommittees:
    def test_armed_services_member_rows(self) -> None:
        rows, _ = parse_committees([_ARMED_SERVICES], {"HSAS": _MEMBERSHIP["HSAS"]})
        assert len(rows) == 2
        row_chair = next(r for r in rows if r.title == "Chair")
        assert row_chair == PoliticianCommitteeRow(
            bioguide_id="A000001",
            committee_thomas_id="HSAS",
            committee_name="Armed Services",
            committee_type="house",
            title="Chair",
        )
        row_no_title = next(r for r in rows if r.bioguide_id == "A000002")
        assert row_no_title.title is None

    def test_armed_services_sector_map(self) -> None:
        _, sector_map_rows = parse_committees([_ARMED_SERVICES], {})
        assert ("HSAS", "Industrials") in sector_map_rows
        assert len(sector_map_rows) == 1

    def test_banking_sector_map_multi_sector(self) -> None:
        _, sector_map_rows = parse_committees([_BANKING], {})
        sectors = {s for _, s in sector_map_rows}
        assert "Financial Services" in sectors
        assert "Real Estate" in sectors

    def test_judiciary_no_sector_rows(self) -> None:
        _, sector_map_rows = parse_committees([_JUDICIARY], {})
        # "Judiciary" matches no COMMITTEE_SECTOR_PATTERNS entry.
        assert sector_map_rows == []

    def test_membership_missing_bioguide_skipped(self) -> None:
        bad_membership = {"HSAS": [{"title": "Chair"}]}  # no 'bioguide' key
        rows, _ = parse_committees([_ARMED_SERVICES], bad_membership)
        assert rows == []

    def test_membership_thomas_id_not_in_committees_skipped(self) -> None:
        orphan_membership = {"ZZZZ": [{"bioguide": "X000001"}]}
        rows, sector_map_rows = parse_committees([_ARMED_SERVICES], orphan_membership)
        assert rows == []
        # sector_map_rows are derived from committees dict only, so HSAS still maps
        assert ("HSAS", "Industrials") in sector_map_rows

    def test_empty_inputs(self) -> None:
        rows, sector_map_rows = parse_committees([], {})
        assert rows == []
        assert sector_map_rows == []

    def test_full_fixture_row_count(self) -> None:
        rows, sector_map_rows = parse_committees(_COMMITTEES, _MEMBERSHIP)
        # HSAS=2 members, SSBK=1, SSJU=1 → 4 total rows
        assert len(rows) == 4
        # HSAS → 1 sector, SSBK → 2 sectors, SSJU → 0 → total 3 sector pairs
        assert len(sector_map_rows) == 3

    def test_source_default(self) -> None:
        rows, _ = parse_committees([_ARMED_SERVICES], {"HSAS": [{"bioguide": "A000001"}]})
        assert rows[0].source == "congress-legislators"


class TestCommitteeSectorPatterns:
    def test_all_patterns_have_non_empty_sectors(self) -> None:
        for pattern, sectors in COMMITTEE_SECTOR_PATTERNS:
            assert sectors, f"Pattern '{pattern}' maps to empty sector list"

    def test_twelve_patterns(self) -> None:
        assert len(COMMITTEE_SECTOR_PATTERNS) == 12
