"""Unit tests for transform/bioguide_match.py — pure, no network, no DB.

Covers:
  * exact name + state + chamber match
  * suffix stripping (Jr, Sr, III, etc.)
  * middle-name filer (filer has middle name, legislator does not)
  * wrong-state → no match
  * ambiguous same-last-name resolved by state
  * executive / no-chamber → None
  * truly ambiguous (same first + last + state + chamber) → None
  * build_legislator_index deduplication on bioguide_id
"""

from __future__ import annotations

import pytest

from collector.transform.bioguide_match import (
    LegislatorEntry,
    _normalize,
    _split_first_last,
    build_legislator_index,
    match_filer,
)

# ---------------------------------------------------------------------------
# Fixtures: minimal YAML-shaped dicts (no network needed)
# ---------------------------------------------------------------------------

_BLUMENAUER = {
    "id": {"bioguide": "B000574"},
    "name": {"first": "Earl", "last": "Blumenauer", "official_full": "Earl Blumenauer"},
    "terms": [{"type": "rep", "state": "OR", "start": "1996-05-21", "end": "2025-01-03"}],
}

_BEYER = {
    "id": {"bioguide": "B001292"},
    "name": {"first": "Donald", "last": "Beyer", "official_full": "Donald S. Beyer Jr."},
    "terms": [{"type": "rep", "state": "VA", "start": "2015-01-06", "end": "2025-01-03"}],
}

_SMITH_WA = {
    "id": {"bioguide": "S000510"},
    "name": {"first": "Adam", "last": "Smith", "official_full": "Adam Smith"},
    "terms": [{"type": "rep", "state": "WA", "start": "1997-01-07", "end": "2025-01-03"}],
}

_SMITH_NJ = {
    "id": {"bioguide": "S000522"},
    "name": {"first": "Christopher", "last": "Smith", "official_full": "Christopher H. Smith"},
    "terms": [{"type": "rep", "state": "NJ", "start": "1981-01-05", "end": "2025-01-03"}],
}

# Senator in the same state as _SMITH_WA to test chamber filter
_CANTWELL = {
    "id": {"bioguide": "C000127"},
    "name": {"first": "Maria", "last": "Cantwell", "official_full": "Maria Cantwell"},
    "terms": [{"type": "sen", "state": "WA", "start": "2001-01-03", "end": "2025-01-03"}],
}

# Legislator who served in both chambers (unusual but possible historically)
_BOTH_CHAMBERS = {
    "id": {"bioguide": "X999999"},
    "name": {"first": "Jane", "last": "Doe", "official_full": "Jane Doe"},
    "terms": [
        {"type": "rep", "state": "TX", "start": "2000-01-01", "end": "2005-01-01"},
        {"type": "sen", "state": "TX", "start": "2007-01-01", "end": "2013-01-01"},
    ],
}

ALL_RECORDS = [_BLUMENAUER, _BEYER, _SMITH_WA, _SMITH_NJ, _CANTWELL, _BOTH_CHAMBERS]


@pytest.fixture
def index():
    return build_legislator_index(ALL_RECORDS)


# ---------------------------------------------------------------------------
# _normalize helpers
# ---------------------------------------------------------------------------

class TestNormalize:
    def test_lowercase_and_strip_punct(self):
        assert _normalize("O'Brien") == "obrien"

    def test_drop_jr(self):
        assert _normalize("Donald Sternoff Beyer Jr") == "donald sternoff beyer"

    def test_drop_jr_with_period(self):
        assert _normalize("Donald S. Beyer Jr.") == "donald s beyer"

    def test_drop_iii(self):
        assert _normalize("John Smith III") == "john smith"

    def test_drop_sr(self):
        assert _normalize("Robert Brown Sr.") == "robert brown"

    def test_accent_normalization(self):
        # ü → u after NFKD + ascii ignore
        assert _normalize("Müller") == "muller"

    def test_no_suffix_unchanged(self):
        assert _normalize("Earl Blumenauer") == "earl blumenauer"

    def test_collapse_whitespace(self):
        assert _normalize("  John   Doe  ") == "john doe"


class TestSplitFirstLast:
    def test_two_tokens(self):
        assert _split_first_last("donald beyer") == ("donald", "beyer")

    def test_three_tokens_middle_dropped(self):
        assert _split_first_last("donald sternoff beyer") == ("donald", "beyer")

    def test_single_token(self):
        assert _split_first_last("smith") == ("smith", "smith")

    def test_empty(self):
        assert _split_first_last("") == ("", "")


# ---------------------------------------------------------------------------
# build_legislator_index
# ---------------------------------------------------------------------------

class TestBuildLegislatorIndex:
    def test_entry_count(self, index):
        assert len(index) == len(ALL_RECORDS)

    def test_deduplication_keeps_last(self):
        dup = [
            _BLUMENAUER,
            {
                "id": {"bioguide": "B000574"},
                "name": {"first": "EARL", "last": "Blumenauer", "official_full": "Earl Blumenauer"},
                "terms": [{"type": "rep", "state": "OR"}],
            },
        ]
        idx = build_legislator_index(dup)
        assert len(idx) == 1

    def test_chambers_house(self, index):
        entry = next(e for e in index if e.bioguide_id == "B000574")
        assert "house" in entry.chambers
        assert "senate" not in entry.chambers

    def test_states(self, index):
        entry = next(e for e in index if e.bioguide_id == "B000574")
        assert "OR" in entry.states

    def test_both_chambers_entry(self, index):
        entry = next(e for e in index if e.bioguide_id == "X999999")
        assert "house" in entry.chambers
        assert "senate" in entry.chambers


# ---------------------------------------------------------------------------
# match_filer
# ---------------------------------------------------------------------------

class TestMatchFiler:
    def test_exact_match(self, index):
        bid = match_filer("Earl Blumenauer", "OR", "house", index)
        assert bid == "B000574"

    def test_suffix_stripped_match(self, index):
        # kadoa stores "Donald Sternoff Beyer Jr" — suffix must be stripped
        bid = match_filer("Donald Sternoff Beyer Jr", "VA", "house", index)
        assert bid == "B001292"

    def test_middle_name_filer(self, index):
        # filer_name has an extra middle name; last+state+chamber filter + first prefix resolve
        bid = match_filer("Christopher H Smith", "NJ", "house", index)
        assert bid == "S000522"

    def test_wrong_state_no_match(self, index):
        # Blumenauer is in OR; TX should not match
        bid = match_filer("Earl Blumenauer", "TX", "house", index)
        assert bid is None

    def test_wrong_chamber_no_match(self, index):
        # _SMITH_WA is a rep; asking for senate should fail
        bid = match_filer("Adam Smith", "WA", "senate", index)
        assert bid is None

    def test_state_resolves_ambiguity(self, index):
        # Both "Smith" reps in different states — state filter picks exactly one
        bid_wa = match_filer("Adam Smith", "WA", "house", index)
        bid_nj = match_filer("Christopher Smith", "NJ", "house", index)
        assert bid_wa == "S000510"
        assert bid_nj == "S000522"

    def test_executive_no_chamber_returns_none(self, index):
        bid = match_filer("Janet Yellen", "DC", None, index)
        assert bid is None

    def test_no_state_returns_none(self, index):
        bid = match_filer("Earl Blumenauer", None, "house", index)
        assert bid is None

    def test_empty_filer_name_returns_none(self, index):
        bid = match_filer("", "OR", "house", index)
        assert bid is None

    def test_no_match_unknown_name(self, index):
        bid = match_filer("Zzz Unknown Person", "CA", "house", index)
        assert bid is None

    def test_both_chambers_entry_matches_house(self, index):
        # _BOTH_CHAMBERS served in both — should match when asking for house
        bid = match_filer("Jane Doe", "TX", "house", index)
        assert bid == "X999999"

    def test_both_chambers_entry_matches_senate(self, index):
        bid = match_filer("Jane Doe", "TX", "senate", index)
        assert bid == "X999999"

    def test_cantwell_senate_match(self, index):
        bid = match_filer("Maria Cantwell", "WA", "senate", index)
        assert bid == "C000127"

    def test_first_initial_prefix_match(self, index):
        # "C. Smith" in NJ — prefix 'c' matches Christopher (unique in NJ/house)
        bid = match_filer("C Smith", "NJ", "house", index)
        assert bid == "S000522"
