"""Pure transforms for SEC EDGAR 13F data.

Purpose: parse SEC submissions JSON and 13F info-table XML into typed rows.
No network I/O, no DB access — stdlib only (xml.etree.ElementTree, datetime).

Invariants:
  * parse_submissions: only 13F-HR and 13F-HR/A rows are returned; reads
    primaryDocument array into FilingRef.primary_document.
  * parse_infotable: NAMESPACE-AGNOSTIC (local tag name only).
  * normalize_value: period >= 2022-12-31 -> USD; earlier -> thousands.
  * aggregate_holdings: key=(cusip, put_call, prn_type); deterministic order.
  * all_13f / group_by_period / merge_submission_pages: pagination helpers.
  * parse_amendment_type / reconcile_period_filings: in sec_reconcile,
    re-exported here for a single import path.

Side effects: none.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Optional

from collector.schema.rows import HoldingRow

_VALID_FORM_TYPES: frozenset[str] = frozenset({"13F-HR", "13F-HR/A"})


@dataclass(frozen=True)
class FilingRef:
    """Reference to a 13F filing from the submissions JSON.

    amendment_type is populated after fetching the cover-page XML (None =
    not fetched yet or original). Values: 'RESTATEMENT', 'NEW HOLDINGS', None.
    """

    accession: str
    form_type: str
    filing_date: date
    period_of_report: date
    primary_document: str
    amendment_type: Optional[str] = field(default=None)


@dataclass(frozen=True)
class RawHolding:
    """One raw holding line from an info-table XML."""

    cusip: str
    name_of_issuer: str
    title_of_class: Optional[str]
    value_raw: int
    shares: Optional[int]
    prn_type: Optional[str]
    put_call: str


def parse_submissions(data: dict[str, Any]) -> list[FilingRef]:
    """Extract 13F-HR / 13F-HR/A FilingRef list from a submissions JSON dict."""
    recent = data["filings"]["recent"]
    refs: list[FilingRef] = []
    for acc, form, fd, rd, pd in zip(
        recent["accessionNumber"], recent["form"],
        recent["filingDate"], recent["reportDate"], recent["primaryDocument"],
    ):
        if form not in _VALID_FORM_TYPES:
            continue
        refs.append(FilingRef(
            accession=acc, form_type=form,
            filing_date=date.fromisoformat(fd),
            period_of_report=date.fromisoformat(rd),
            primary_document=pd,
        ))
    return refs


def latest_13f(refs: list[FilingRef]) -> Optional[FilingRef]:
    """Pick the most recent FilingRef by filing_date, tie-break by accession."""
    return max(refs, key=lambda r: (r.filing_date, r.accession)) if refs else None


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def parse_infotable(xml: bytes) -> list[RawHolding]:
    """Parse a 13F info-table XML document. NAMESPACE-AGNOSTIC."""
    root = ET.fromstring(xml)
    holdings: list[RawHolding] = []

    for elem in root.iter():
        if _local(elem.tag) != "infoTable":
            continue

        def _find(local: str) -> Optional[ET.Element]:
            for child in elem:
                if _local(child.tag) == local:
                    return child
            return None

        def _text(local: str) -> str:
            el = _find(local)
            return (el.text or "").strip() if el is not None else ""

        shrsprn = _find("shrsOrPrnAmt")
        shares: Optional[int] = None
        prn_type: Optional[str] = None
        if shrsprn is not None:
            def _sub(local: str) -> str:
                for child in shrsprn:
                    if _local(child.tag) == local:
                        return (child.text or "").strip()
                return ""
            s = _sub("sshPrnamt")
            shares = int(s) if s else None
            pt = _sub("sshPrnamtType")
            prn_type = pt if pt else None

        pc = _text("putCall").upper()
        tc = _text("titleOfClass")
        holdings.append(RawHolding(
            cusip=_text("cusip"),
            name_of_issuer=_text("nameOfIssuer"),
            title_of_class=tc if tc else None,
            value_raw=int(_text("value") or "0"),
            shares=shares, prn_type=prn_type,
            put_call=pc if pc else "",
        ))
    return holdings


# Re-exports from sec_reconcile (single import path for callers)
from collector.transform.sec_reconcile import (  # noqa: E402
    parse_amendment_type,
    reconcile_period_filings,
)

_USD_THRESHOLD = date(2022, 12, 31)


def normalize_value(value_raw: int, period: date) -> tuple[int, str]:
    """Normalize raw info-table value to USD. Returns (value, units_string)."""
    if period >= _USD_THRESHOLD:
        return (value_raw, "usd")
    return (value_raw * 1000, "usd_thousands")


def units_for_period(period: date) -> str:
    return "usd" if period >= _USD_THRESHOLD else "usd_thousands"


_AggKey = tuple[str, str, Optional[str]]


def aggregate_holdings(
    raws: list[RawHolding], *, cik: str, accession: str, period: date,
) -> list[HoldingRow]:
    """Aggregate raw holdings into HoldingRow list keyed by (cusip, put_call, prn_type).

    Sums shares and value_usd within each group. Deterministic output order.
    """
    groups: dict[_AggKey, list[RawHolding]] = {}
    for raw in raws:
        key: _AggKey = (raw.cusip, raw.put_call, raw.prn_type)
        groups.setdefault(key, []).append(raw)

    rows: list[HoldingRow] = []
    for key in sorted(groups.keys()):
        cusip, put_call, prn_type = key
        group = groups[key]
        total_value_usd = sum(normalize_value(r.value_raw, period)[0] for r in group)
        all_none = all(r.shares is None for r in group)
        total_shares: Optional[int] = (
            None if all_none else sum(r.shares for r in group if r.shares is not None)
        )
        rows.append(HoldingRow(
            cik=cik, accession=accession, period_of_report=period,
            cusip=cusip, name_of_issuer=group[0].name_of_issuer,
            value_usd=total_value_usd, put_call=put_call, prn_type=prn_type,
            title_of_class=group[0].title_of_class, shares=total_shares,
        ))
    return rows


def all_13f(refs: list[FilingRef], *, since: Optional[date] = None) -> list[FilingRef]:
    """Return ALL 13F refs sorted ascending by (period_of_report, filing_date, accession)."""
    filtered = refs if since is None else [r for r in refs if r.period_of_report >= since]
    return sorted(filtered, key=lambda r: (r.period_of_report, r.filing_date, r.accession))


def group_by_period(refs: list[FilingRef]) -> dict[date, list[FilingRef]]:
    """Group FilingRef list by period_of_report."""
    groups: dict[date, list[FilingRef]] = {}
    for ref in refs:
        groups.setdefault(ref.period_of_report, []).append(ref)
    return groups


def merge_submission_pages(
    recent: dict[str, Any],
    older: list[dict[str, Any]],
) -> dict[str, Any]:
    """Merge older submission page dicts into the recent column-dict shape.

    Concatenates parallel arrays from recent + each older page. Keys absent
    from a source are padded with '' to preserve the parallel-array invariant.
    Pure — no I/O.
    """
    if not older:
        return recent

    all_keys: list[str] = list(recent.keys())
    for page in older:
        for k in page:
            if k not in all_keys:
                all_keys.append(k)

    recent_len = len(next(iter(recent.values()), []))
    page_lens = [len(next(iter(page.values()), [])) for page in older]

    merged: dict[str, Any] = {}
    for key in all_keys:
        base: list[Any] = list(recent.get(key) or [""] * recent_len)
        for page, page_len in zip(older, page_lens):
            page_col = page.get(key)
            if page_col:
                base.extend(page_col)
            else:
                base.extend([""] * page_len)
        merged[key] = base
    return merged
