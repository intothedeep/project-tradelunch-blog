"""Tests for Phase L backfill pure functions (no network, no DB).

Covers:
  * all_13f — ascending sort, since-floor filter, multi-amendment-per-period
  * group_by_period — grouping and within-group ordering
  * merge_submission_pages — 1-page (no-op), 2-page union, key union
"""

from datetime import date

import pytest

from collector.transform.sec_parse import (
    FilingRef,
    all_13f,
    group_by_period,
    merge_submission_pages,
)


# --- helpers ------------------------------------------------------------------

def _ref(
    accession: str,
    filing_date: str,
    period: str,
    form: str = "13F-HR",
) -> FilingRef:
    return FilingRef(
        accession=accession,
        form_type=form,
        filing_date=date.fromisoformat(filing_date),
        period_of_report=date.fromisoformat(period),
        primary_document="form13f.xml",
    )


# --- all_13f ------------------------------------------------------------------


class TestAll13f:
    def test_returns_empty_for_empty_input(self):
        assert all_13f([]) == []

    def test_ascending_by_period_then_filing_date_then_accession(self):
        refs = [
            _ref("acc-003", "2024-08-15", "2024-06-30"),
            _ref("acc-001", "2024-02-14", "2023-12-31"),
            _ref("acc-002", "2024-05-15", "2024-03-31"),
        ]
        result = all_13f(refs)
        periods = [r.period_of_report for r in result]
        assert periods == sorted(periods), "must be ascending by period_of_report"
        assert result[0].accession == "acc-001"
        assert result[1].accession == "acc-002"
        assert result[2].accession == "acc-003"

    def test_since_floor_excludes_older_periods(self):
        refs = [
            _ref("acc-001", "2022-05-15", "2022-03-31"),
            _ref("acc-002", "2023-02-14", "2022-12-31"),
            _ref("acc-003", "2023-05-15", "2023-03-31"),
        ]
        result = all_13f(refs, since=date(2023, 1, 1))
        assert len(result) == 1
        assert result[0].accession == "acc-003"

    def test_since_boundary_is_inclusive(self):
        """period_of_report == since is kept."""
        refs = [
            _ref("acc-001", "2023-02-14", "2022-12-31"),
            _ref("acc-002", "2023-05-15", "2023-03-31"),
        ]
        result = all_13f(refs, since=date(2022, 12, 31))
        assert len(result) == 2

    def test_since_none_returns_all(self):
        refs = [
            _ref("acc-001", "2022-05-15", "2022-03-31"),
            _ref("acc-002", "2023-02-14", "2022-12-31"),
        ]
        result = all_13f(refs, since=None)
        assert len(result) == 2

    def test_multi_amendment_same_period_all_returned(self):
        """Both 13F-HR and 13F-HR/A for the same period appear in output."""
        refs = [
            _ref("acc-001", "2023-05-15", "2023-03-31", form="13F-HR"),
            _ref("acc-002", "2023-06-01", "2023-03-31", form="13F-HR/A"),
        ]
        result = all_13f(refs)
        assert len(result) == 2
        # Both for the same period; sorted by (period, filing_date, accession)
        assert result[0].accession == "acc-001"
        assert result[1].accession == "acc-002"

    def test_tiebreak_within_period_by_accession(self):
        """Same (period, filing_date) -> tiebreak ascending by accession."""
        refs = [
            _ref("acc-002", "2023-05-15", "2023-03-31"),
            _ref("acc-001", "2023-05-15", "2023-03-31"),
        ]
        result = all_13f(refs)
        assert result[0].accession == "acc-001"
        assert result[1].accession == "acc-002"

    def test_does_not_mutate_input(self):
        refs = [
            _ref("acc-002", "2023-08-14", "2023-06-30"),
            _ref("acc-001", "2023-05-15", "2023-03-31"),
        ]
        original_order = [r.accession for r in refs]
        all_13f(refs)
        assert [r.accession for r in refs] == original_order


# --- group_by_period ----------------------------------------------------------


class TestGroupByPeriod:
    def test_empty_input_returns_empty_dict(self):
        assert group_by_period([]) == {}

    def test_single_ref_one_period(self):
        ref = _ref("acc-001", "2023-05-15", "2023-03-31")
        result = group_by_period([ref])
        assert list(result.keys()) == [date(2023, 3, 31)]
        assert result[date(2023, 3, 31)] == [ref]

    def test_two_refs_two_periods(self):
        r1 = _ref("acc-001", "2023-05-15", "2023-03-31")
        r2 = _ref("acc-002", "2023-08-14", "2023-06-30")
        result = group_by_period([r1, r2])
        assert len(result) == 2
        assert result[date(2023, 3, 31)] == [r1]
        assert result[date(2023, 6, 30)] == [r2]

    def test_amendment_groups_with_original(self):
        """13F-HR and its 13F-HR/A share the same period -> one group."""
        r1 = _ref("acc-001", "2023-05-15", "2023-03-31", form="13F-HR")
        r2 = _ref("acc-002", "2023-06-01", "2023-03-31", form="13F-HR/A")
        result = group_by_period([r1, r2])
        assert len(result) == 1
        group = result[date(2023, 3, 31)]
        assert len(group) == 2

    def test_max_pick_selects_latest_amendment(self):
        """Caller convention: max(group, key=lambda r: (r.filing_date, r.accession))."""
        r1 = _ref("acc-001", "2023-05-15", "2023-03-31", form="13F-HR")
        r2 = _ref("acc-002", "2023-06-01", "2023-03-31", form="13F-HR/A")
        result = group_by_period([r1, r2])
        group = result[date(2023, 3, 31)]
        keep = max(group, key=lambda r: (r.filing_date, r.accession))
        assert keep.accession == "acc-002"
        assert keep.form_type == "13F-HR/A"

    def test_preserves_insertion_order_within_group(self):
        r1 = _ref("acc-001", "2023-05-15", "2023-03-31")
        r2 = _ref("acc-002", "2023-06-01", "2023-03-31")
        result = group_by_period([r1, r2])
        assert result[date(2023, 3, 31)][0].accession == "acc-001"
        assert result[date(2023, 3, 31)][1].accession == "acc-002"

    def test_three_periods_distinct_keys(self):
        refs = [
            _ref("acc-001", "2023-02-14", "2022-12-31"),
            _ref("acc-002", "2023-05-15", "2023-03-31"),
            _ref("acc-003", "2023-08-14", "2023-06-30"),
        ]
        result = group_by_period(refs)
        assert set(result.keys()) == {
            date(2022, 12, 31),
            date(2023, 3, 31),
            date(2023, 6, 30),
        }


# --- merge_submission_pages ---------------------------------------------------

# Minimal column dict matching what parse_submissions reads
def _recent(accessions: list, forms: list, filing_dates: list, report_dates: list, primary_docs: list) -> dict:
    return {
        "accessionNumber": accessions,
        "form": forms,
        "filingDate": filing_dates,
        "reportDate": report_dates,
        "primaryDocument": primary_docs,
    }


class TestMergeSubmissionPages:
    def test_no_older_pages_returns_recent_unchanged(self):
        recent = _recent(
            ["acc-001"], ["13F-HR"], ["2023-05-15"], ["2023-03-31"], ["form13f.xml"]
        )
        result = merge_submission_pages(recent, [])
        assert result == recent

    def test_one_older_page_concatenates_columns(self):
        recent = _recent(
            ["acc-002"], ["13F-HR"], ["2023-08-14"], ["2023-06-30"], ["form13f.xml"]
        )
        page = _recent(
            ["acc-001"], ["13F-HR"], ["2023-05-15"], ["2023-03-31"], ["form13f.xml"]
        )
        result = merge_submission_pages(recent, [page])
        assert result["accessionNumber"] == ["acc-002", "acc-001"]
        assert result["form"] == ["13F-HR", "13F-HR"]
        assert result["filingDate"] == ["2023-08-14", "2023-05-15"]
        assert result["reportDate"] == ["2023-06-30", "2023-03-31"]
        assert result["primaryDocument"] == ["form13f.xml", "form13f.xml"]

    def test_two_older_pages_all_concatenated(self):
        recent = _recent(["acc-003"], ["13F-HR"], ["2023-08-14"], ["2023-06-30"], ["a.xml"])
        page1 = _recent(["acc-002"], ["13F-HR"], ["2023-05-15"], ["2023-03-31"], ["b.xml"])
        page2 = _recent(["acc-001"], ["13F-HR"], ["2023-02-14"], ["2022-12-31"], ["c.xml"])
        result = merge_submission_pages(recent, [page1, page2])
        assert result["accessionNumber"] == ["acc-003", "acc-002", "acc-001"]
        assert len(result["form"]) == 3

    def test_merged_result_parseable_by_parse_submissions(self):
        """merge_submission_pages output plugs directly into parse_submissions."""
        from collector.transform.sec_parse import parse_submissions

        recent = _recent(
            ["acc-002", "acc-X"],
            ["13F-HR", "10-K"],
            ["2023-08-14", "2023-03-01"],
            ["2023-06-30", "2022-12-31"],
            ["form13f.xml", "10k.htm"],
        )
        page = _recent(
            ["acc-001"], ["13F-HR"], ["2023-05-15"], ["2023-03-31"], ["form13f.xml"]
        )
        merged = merge_submission_pages(recent, [page])
        refs = parse_submissions({"filings": {"recent": merged}})
        # Only the two 13F-HR refs (not the 10-K)
        assert len(refs) == 2
        accessions = {r.accession for r in refs}
        assert accessions == {"acc-002", "acc-001"}

    def test_extra_key_in_older_page_unioned(self):
        """A key present in older page but absent in recent is added to merged."""
        recent = _recent(["acc-002"], ["13F-HR"], ["2023-08-14"], ["2023-06-30"], ["a.xml"])
        page = {
            "accessionNumber": ["acc-001"],
            "form": ["13F-HR"],
            "filingDate": ["2023-05-15"],
            "reportDate": ["2023-03-31"],
            "primaryDocument": ["b.xml"],
            "extraKey": ["extra-value"],
        }
        result = merge_submission_pages(recent, [page])
        # The extra key must appear in merged
        assert "extraKey" in result
        # recent had no extraKey — it gets padded with empty string for its 1 row
        assert len(result["extraKey"]) == 2

    def test_does_not_mutate_recent_input(self):
        recent = _recent(["acc-001"], ["13F-HR"], ["2023-05-15"], ["2023-03-31"], ["a.xml"])
        original_len = len(recent["accessionNumber"])
        page = _recent(["acc-002"], ["13F-HR"], ["2023-08-14"], ["2023-06-30"], ["b.xml"])
        merge_submission_pages(recent, [page])
        assert len(recent["accessionNumber"]) == original_len
