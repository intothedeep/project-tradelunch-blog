"""Shared IO orchestration: per-period reconcile + ingest for SEC 13F filings.

Purpose: factor the NEW HOLDINGS reconciliation + multi-accession ingest path
shared by run_backfill and run_monthly. Prevents divergence between the two
entrypoints and keeps each entrypoint ≤300 LOC.

Flow per period:
  1. For each 13F-HR/A in the group, fetch its primary_doc and parse
     amendment_type (originals skip the fetch).
  2. reconcile_period_filings(group) -> (live, superseded_accessions).
  3. For EACH ref in live: fetch infotable -> parse -> aggregate -> upsert.
  4. supersede_period_others(keep_accessions=live accessions).

Invariants:
  * Partial-failure tolerant at the ref level: a failed ref is logged and
    counted but does not abort the period.
  * NEW HOLDINGS accessions are disjoint from the base by construction — no
    double-count risk when the read side sums live holdings per period.
  * Idempotent: upsert revives deleted_at=NULL; supersede is guarded by IS NULL.

Side effects: network (SEC EDGAR) + DB writes. Never raises — returns counts.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import date

import psycopg

from collector.schema.rows import FilingRow, HoldingRow
from collector.sink import sec_db_sink, sec_fetch
from collector.transform.sec_parse import (
    FilingRef,
    aggregate_holdings,
    parse_amendment_type,
    parse_infotable,
    reconcile_period_filings,
    units_for_period,
)


def _annotate_amendment_type(ref: FilingRef, cik: str) -> FilingRef:
    """Fetch cover-page XML for a 13F-HR/A and annotate amendment_type.

    Only called for 13F-HR/A filings; originals return as-is (amendment_type
    stays None). Network call — may raise on HTTP error.
    """
    if ref.form_type != "13F-HR/A":
        return ref
    xml = sec_fetch.fetch_primary_doc(cik, ref.accession, ref.primary_document)
    atype = parse_amendment_type(xml)
    return replace(ref, amendment_type=atype)


def _fetch_and_aggregate(
    ref: FilingRef,
    cik: str,
    label: str,
) -> list[HoldingRow] | None:
    """Fetch infotable + parse + aggregate for one FilingRef.

    Returns None if no info-table XML is found (filing skipped). May raise on
    HTTP error (caller handles per-ref exception).
    """
    idx = sec_fetch.fetch_accession_index(cik, ref.accession)
    xml_name = sec_fetch.find_infotable_name(idx)
    if xml_name is None:
        print(
            f"[sec_period_ingest] {label} ({cik}) period={ref.period_of_report}"
            f" accession={ref.accession}: no info-table XML — skip"
        )
        return None
    xml = sec_fetch.fetch_infotable(cik, ref.accession, xml_name)
    raws = parse_infotable(xml)
    return aggregate_holdings(raws, cik=cik, accession=ref.accession, period=ref.period_of_report)


def ingest_period(
    conn: psycopg.Connection,
    *,
    cik: str,
    label: str,
    period: date,
    group: list[FilingRef],
) -> tuple[int, int, int]:
    """Reconcile and ingest all live filings for one (cik, period).

    Annotates amendment_type for 13F-HR/A filings (network), reconciles live vs
    superseded, upserts each live filing's holdings, then soft-deletes superseded.

    Returns:
        (n_holdings_upserted, n_refs_live, n_refs_failed)
    """
    # Step 1: annotate amendment_type for amendments (skip for originals)
    annotated: list[FilingRef] = []
    for ref in group:
        try:
            annotated.append(_annotate_amendment_type(ref, cik))
        except Exception as exc:  # noqa: BLE001
            # If we can't fetch the cover page, treat as unknown (None) —
            # reconcile_period_filings will treat it as a non-NEW-HOLDINGS filing.
            print(
                f"[sec_period_ingest] {label} ({cik}) period={period}"
                f" accession={ref.accession}: cover-page fetch failed ({exc}), treating as base"
            )
            annotated.append(ref)

    # Step 2: reconcile
    live_refs, superseded_accessions = reconcile_period_filings(annotated)

    # Step 3: ingest each live ref
    total_holdings = 0
    n_failed = 0
    ingested_accessions: list[str] = []

    for ref in live_refs:
        try:
            holdings = _fetch_and_aggregate(ref, cik, label)
            if holdings is None:
                continue

            filing = FilingRow(
                cik=cik,
                accession=ref.accession,
                period_of_report=period,
                form_type=ref.form_type,
                filer=label,
                filing_date=ref.filing_date,
                value_units=units_for_period(period),
            )
            sec_db_sink.upsert_filings(conn, [filing])
            sec_db_sink.upsert_holdings(conn, holdings)
            total_holdings += len(holdings)
            ingested_accessions.append(ref.accession)
        except Exception as exc:  # noqa: BLE001
            n_failed += 1
            print(
                f"[sec_period_ingest] {label} ({cik}) period={period}"
                f" accession={ref.accession}: FAILED {exc}"
            )

    # Step 4: soft-delete superseded accessions (explicit list from reconcile)
    # Also supersede any DB rows not in ingested_accessions (covers prior runs).
    all_keep = list(set(ingested_accessions))
    if all_keep:
        sec_db_sink.supersede_period_others(
            conn, cik=cik, period=period, keep_accessions=all_keep
        )

    n_live = len(live_refs)
    if superseded_accessions:
        print(
            f"[sec_period_ingest] {label} ({cik}) period={period}"
            f" live={n_live} superseded={superseded_accessions}"
        )

    return total_holdings, n_live, n_failed
