"""Pure transforms for SEC EDGAR 13F data.

Purpose: parse SEC submissions JSON and 13F info-table XML into typed rows.
No network I/O, no DB access — stdlib only (xml.etree.ElementTree, datetime).

Invariants:
  * parse_submissions: only 13F-HR and 13F-HR/A rows are returned.
  * parse_infotable: NAMESPACE-AGNOSTIC — matches on local tag name only,
    never on hardcoded namespace prefix; both bare and ns1:/n1: tags parse
    identically.
  * normalize_value: period >= 2022-12-31 -> value is already USD;
    earlier periods were reported in thousands (SEC changed the scale).
  * aggregate_holdings: aggregation key is (cusip, put_call, prn_type);
    shares and value_usd are summed within each group. Deterministic output
    order: sorted by (cusip, put_call, prn_type).
  * all_13f: returns ALL 13F-HR / 13F-HR/A refs sorted ascending by
    (period_of_report, filing_date, accession); optionally filtered by since.
  * group_by_period: groups FilingRef list by period_of_report. Pure.
  * merge_submission_pages: concatenates column arrays from the recent dict
    and zero or more older page dicts into one merged recent dict, preserving
    the column-dict shape expected by parse_submissions. Keys absent from one
    source are padded with '' to maintain parallel-array invariant.

Side effects: none.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date
from typing import Any, Optional

from collector.schema.rows import HoldingRow

# --- 13F form types accepted --------------------------------------------------

_VALID_FORM_TYPES: frozenset[str] = frozenset({"13F-HR", "13F-HR/A"})


# --- Local dataclasses --------------------------------------------------------


@dataclass(frozen=True)
class FilingRef:
    """A reference to a 13F filing from the submissions JSON.

    ``accession`` is the raw accession number string (e.g. '0001067983-23-000070').
    ``primary_document`` is the filename of the primary document in the filing.
    """

    accession: str
    form_type: str
    filing_date: date
    period_of_report: date
    primary_document: str


@dataclass(frozen=True)
class RawHolding:
    """One raw holding line from an info-table XML.

    ``value_raw`` is the integer as filed (may be in thousands for pre-2023).
    ``put_call`` is normalized: empty/missing becomes ''; uppercase enforced.
    ``prn_type`` is 'SH' or 'PRN'; ``shares`` may be None for some lines.
    """

    cusip: str
    name_of_issuer: str
    title_of_class: Optional[str]
    value_raw: int
    shares: Optional[int]
    prn_type: Optional[str]
    put_call: str


# --- Parse submissions --------------------------------------------------------


def parse_submissions(data: dict[str, Any]) -> list[FilingRef]:
    """Extract 13F-HR / 13F-HR/A FilingRef list from a submissions JSON dict.

    Reads data["filings"]["recent"] parallel arrays. Returns only rows where
    form is in (13F-HR, 13F-HR/A). Does not assume the list is sorted.
    """
    recent: dict[str, list[Any]] = data["filings"]["recent"]
    accessions: list[str] = recent["accessionNumber"]
    forms: list[str] = recent["form"]
    filing_dates: list[str] = recent["filingDate"]
    report_dates: list[str] = recent["reportDate"]
    primary_docs: list[str] = recent["primaryDocument"]

    refs: list[FilingRef] = []
    for acc, form, fd, rd, pd in zip(
        accessions, forms, filing_dates, report_dates, primary_docs
    ):
        if form not in _VALID_FORM_TYPES:
            continue
        refs.append(
            FilingRef(
                accession=acc,
                form_type=form,
                filing_date=date.fromisoformat(fd),
                period_of_report=date.fromisoformat(rd),
                primary_document=pd,
            )
        )
    return refs


def latest_13f(refs: list[FilingRef]) -> Optional[FilingRef]:
    """Pick the most recent FilingRef by filing_date, tie-break by accession.

    Returns None if refs is empty.
    """
    if not refs:
        return None
    return max(refs, key=lambda r: (r.filing_date, r.accession))


# --- Parse info table XML -----------------------------------------------------


def _local(tag: str) -> str:
    """Strip namespace prefix from an XML tag, returning only the local name."""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def parse_infotable(xml: bytes) -> list[RawHolding]:
    """Parse a 13F info-table XML document into RawHolding list.

    NAMESPACE-AGNOSTIC: matches on local tag name only (rsplit on '}').
    Handles both unprefixed (<infoTable>) and namespaced (<ns1:infoTable>)
    variants identically. Returns one RawHolding per <infoTable> element.
    """
    root = ET.fromstring(xml)

    holdings: list[RawHolding] = []

    for elem in root.iter():
        if _local(elem.tag) != "infoTable":
            continue

        # Helper: find first child matching local name
        def _find(local: str) -> Optional[ET.Element]:
            for child in elem:
                if _local(child.tag) == local:
                    return child
            return None

        def _text(local: str) -> str:
            el = _find(local)
            return (el.text or "").strip() if el is not None else ""

        name_of_issuer = _text("nameOfIssuer")
        title_of_class_raw = _text("titleOfClass")
        title_of_class = title_of_class_raw if title_of_class_raw else None
        cusip = _text("cusip")
        value_raw = int(_text("value") or "0")

        # shrsOrPrnAmt container
        shrsprn = _find("shrsOrPrnAmt")
        shares: Optional[int] = None
        prn_type: Optional[str] = None
        if shrsprn is not None:
            def _sub_text(local: str) -> str:
                for child in shrsprn:
                    if _local(child.tag) == local:
                        return (child.text or "").strip()
                return ""

            shares_raw = _sub_text("sshPrnamt")
            shares = int(shares_raw) if shares_raw else None
            prn_type_raw = _sub_text("sshPrnamtType")
            prn_type = prn_type_raw if prn_type_raw else None

        # putCall: normalize empty/missing to ''
        put_call_raw = _text("putCall").upper()
        put_call = put_call_raw if put_call_raw else ""

        holdings.append(
            RawHolding(
                cusip=cusip,
                name_of_issuer=name_of_issuer,
                title_of_class=title_of_class,
                value_raw=value_raw,
                shares=shares,
                prn_type=prn_type,
                put_call=put_call,
            )
        )

    return holdings


# --- Value normalization ------------------------------------------------------

_USD_THRESHOLD = date(2022, 12, 31)


def normalize_value(value_raw: int, period: date) -> tuple[int, str]:
    """Normalize a raw info-table value to whole USD.

    SEC changed the value column scale at the 2022-Q4 filing period:
      * period >= 2022-12-31 -> value is already in USD -> (value_raw, 'usd')
      * period <  2022-12-31 -> value was in thousands -> (value_raw * 1000, 'usd_thousands')

    The multiplier is keyed on PERIOD (reportDate), not filing_date.
    """
    if period >= _USD_THRESHOLD:
        return (value_raw, "usd")
    return (value_raw * 1000, "usd_thousands")


def units_for_period(period: date) -> str:
    """Return the value_units string for a filing period.

    Convenience helper so the entrypoint can stamp FilingRow.value_units without
    duplicating the threshold logic.
    """
    return "usd" if period >= _USD_THRESHOLD else "usd_thousands"


# --- Aggregation --------------------------------------------------------------

# Aggregation key type
_AggKey = tuple[str, str, Optional[str]]  # (cusip, put_call, prn_type)


def aggregate_holdings(
    raws: list[RawHolding],
    *,
    cik: str,
    accession: str,
    period: date,
) -> list[HoldingRow]:
    """Aggregate raw holdings into HoldingRow list keyed by (cusip, put_call, prn_type).

    Multi-manager 13F filings repeat the same security once per sub-manager
    (otherManager). This function sums shares and value_usd within each group.

    Aggregation key: (cusip, put_call, prn_type) — keeps SH vs PRN distinct
    and put/call/none distinct.

    shares: sum of non-None values; None if ALL lines for the group have None.
    value_usd: sum of normalized USD values across all lines in the group.

    Output is deterministically ordered: sorted by (cusip, put_call, prn_type).
    """
    # First pass: group raw holdings
    order: list[_AggKey] = []
    groups: dict[_AggKey, list[RawHolding]] = {}

    for raw in raws:
        key: _AggKey = (raw.cusip, raw.put_call, raw.prn_type)
        if key not in groups:
            order.append(key)
            groups[key] = []
        groups[key].append(raw)

    rows: list[HoldingRow] = []
    for key in sorted(groups.keys()):
        cusip, put_call, prn_type = key
        group = groups[key]
        first = group[0]

        # Sum value_usd (normalize each line independently)
        total_value_usd = sum(normalize_value(r.value_raw, period)[0] for r in group)

        # Sum shares: None if all None, else sum non-None treating None as 0
        all_none = all(r.shares is None for r in group)
        if all_none:
            total_shares: Optional[int] = None
        else:
            total_shares = sum(r.shares for r in group if r.shares is not None)

        rows.append(
            HoldingRow(
                cik=cik,
                accession=accession,
                period_of_report=period,
                cusip=cusip,
                name_of_issuer=first.name_of_issuer,
                value_usd=total_value_usd,
                put_call=put_call,
                prn_type=prn_type,
                title_of_class=first.title_of_class,
                shares=total_shares,
            )
        )

    return rows


# --- Historical backfill helpers (Phase L) ------------------------------------


def all_13f(
    refs: list[FilingRef],
    *,
    since: Optional[date] = None,
) -> list[FilingRef]:
    """Return ALL 13F-HR / 13F-HR/A refs sorted ascending by
    (period_of_report, filing_date, accession).

    Unlike ``latest_13f`` which picks ONE best ref, this returns every ref so
    the backfill can process each period (including amended filings). When
    ``since`` is provided, only refs with ``period_of_report >= since`` are
    kept (floor filter for the backfill window).

    Pure — no I/O.
    """
    filtered = refs if since is None else [r for r in refs if r.period_of_report >= since]
    return sorted(filtered, key=lambda r: (r.period_of_report, r.filing_date, r.accession))


def group_by_period(refs: list[FilingRef]) -> dict[date, list[FilingRef]]:
    """Group FilingRef list by period_of_report.

    Returns a dict keyed by period_of_report; each value is the list of refs
    for that period in insertion order. The caller picks the kept filing via
    ``max(group, key=lambda r: (r.filing_date, r.accession))`` to get the
    most recent amendment.

    Pure — no I/O.
    """
    groups: dict[date, list[FilingRef]] = {}
    for ref in refs:
        groups.setdefault(ref.period_of_report, []).append(ref)
    return groups


def merge_submission_pages(
    recent: dict[str, Any],
    older: list[dict[str, Any]],
) -> dict[str, Any]:
    """Merge older submission page dicts into the ``recent`` column-dict shape.

    SEC EDGAR pagination: ``submissions/CIK{cik}.json`` has a
    ``filings.recent`` column dict (parallel arrays) plus an optional
    ``filings.files`` list of overflow page names. Each overflow page has the
    same column-dict shape as ``filings.recent``.

    This function concatenates the parallel arrays from ``recent`` and each
    page in ``older`` (in order), returning ONE merged dict of the same shape
    so ``parse_submissions({"filings": {"recent": merged}})`` consumes the
    full union without modification.

    Column keys merged: accessionNumber, form, filingDate, reportDate,
    primaryDocument, plus any other keys present in recent or any page.
    Keys absent from a source are padded with '' for each row that source
    contributes, preserving the parallel-array invariant across all columns.

    Pure — no I/O.
    """
    if not older:
        return recent

    # Collect all column keys seen across recent + all pages (stable order)
    all_keys: list[str] = list(recent.keys())
    for page in older:
        for k in page:
            if k not in all_keys:
                all_keys.append(k)

    # Row counts per source: needed to pad keys absent from that source
    recent_len = len(next(iter(recent.values()), []))
    page_lens = [len(next(iter(page.values()), [])) for page in older]

    merged: dict[str, Any] = {}
    for key in all_keys:
        # Start with recent's column, padding with '' if key is absent there
        base: list[Any] = list(recent.get(key) or [""] * recent_len)
        for page, page_len in zip(older, page_lens):
            page_col = page.get(key)
            if page_col:
                base.extend(page_col)
            else:
                base.extend([""] * page_len)
        merged[key] = base

    return merged
