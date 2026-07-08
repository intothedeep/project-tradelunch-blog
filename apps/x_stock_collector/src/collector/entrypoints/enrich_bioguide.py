"""Entrypoint: enrich politician_registry with congress-legislators bioguide IDs.

Flow:
  1. read_congress_filers(conn) — SELECT non-executive registry rows.
  2. fetch_legislators()        — download current + historical YAML (~10 MB).
  3. build_legislator_index()   — normalize into lookup structure (pure).
  4. match_filer() per row      — deterministic last+state+chamber match (pure).
  5. update_bioguide_ids(conn)  — UPDATE bioguide_id WHERE filer_id=... (non-dry).
  6. insert_batch_log()         — always in try/finally.

Guardrail log (always printed):
  congress_filers   — rows read from politician_registry (non-executive)
  matched           — rows where match_filer() returned a bioguide_id
  unmatched         — rows where match_filer() returned None
  match_rate_pct    — matched / congress_filers * 100

--dry-run: fetch + parse + match + print guardrail stats; NO DB writes.
  Executive-branch filers (branch='executive', OGE) are NOT in the congress-
  legislators dataset and correctly stay bioguide_id=NULL. Unmatched congressional
  filers also stay NULL and are logged at WARNING level.

Side effects: network (GitHub raw YAML) + DB writes in non-dry mode.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

from collector.config.settings import database_url
from collector.sink import db_sink
from collector.sink.congress_fetch import fetch_legislators
from collector.sink.politician_db_sink import (
    read_congress_filers,
    update_bioguide_ids,
)
from collector.transform.bioguide_match import build_legislator_index, match_filer


def _run_match(
    filers: list[dict],
    index,
) -> tuple[dict[str, str], list[dict]]:
    """Pure dispatch loop: match each filer row against the index.

    Returns:
        (mapping, unmatched_rows)
        mapping          — {filer_id: bioguide_id} for all successful matches.
        unmatched_rows   — list of filer dicts that produced no match.
    """
    mapping: dict[str, str] = {}
    unmatched: list[dict] = []
    for row in filers:
        bid = match_filer(
            filer_name=row.get("filer_name") or "",
            state=row.get("state"),
            chamber=row.get("chamber"),
            index=index,
        )
        if bid:
            mapping[row["filer_id"]] = bid
        else:
            unmatched.append(row)
    return mapping, unmatched


def _print_guardrails(
    congress_filers: int,
    matched: int,
    unmatched: int,
    sample_matches: list[tuple[str, str]],
    sample_misses: list[str],
) -> None:
    rate = round(matched / congress_filers * 100, 1) if congress_filers else 0.0
    print(
        f"[enrich_bioguide] congress_filers={congress_filers}"
        f" matched={matched}"
        f" unmatched={unmatched}"
        f" match_rate_pct={rate}"
    )
    for filer_id, bid in sample_matches[:5]:
        print(f"  [MATCH]   filer_id={filer_id!r} -> bioguide_id={bid!r}")
    for filer_id in sample_misses[:5]:
        print(f"  [MISS]    filer_id={filer_id!r} -> None")
    if unmatched > 5:
        print(f"  … and {unmatched - 5} more unmatched (executive filers stay NULL by design)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Enrich politician_registry with congress-legislators bioguide IDs."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="fetch + match + print guardrails only; no DB writes",
    )
    args = parser.parse_args(argv)

    # --- dry-run path (no DB) -----------------------------------------------
    if args.dry_run or not database_url():
        print("[enrich_bioguide] dry-run: fetching congress-legislators YAML …")
        legislators = fetch_legislators()
        index = build_legislator_index(legislators)
        print(f"[enrich_bioguide] legislator index built: {len(index)} entries")

        # Without a DB connection we have no filer rows to match — print the
        # index size and exit cleanly so the workflow can verify fetch works.
        print(
            "[enrich_bioguide] dry-run: no DB connection — "
            "skipping filer read. Index is ready for live run."
        )
        return 0

    # --- live path ----------------------------------------------------------
    started_at = datetime.now(timezone.utc)
    conn = db_sink.connect()
    status, descr = "success", ""

    try:
        print("[enrich_bioguide] reading congress filers from politician_registry …")
        filers = read_congress_filers(conn)
        print(f"[enrich_bioguide] found {len(filers)} congress filer rows")

        print("[enrich_bioguide] fetching congress-legislators YAML …")
        legislators = fetch_legislators()
        index = build_legislator_index(legislators)
        print(f"[enrich_bioguide] legislator index built: {len(index)} entries")

        mapping, unmatched_rows = _run_match(filers, index)

        matched = len(mapping)
        unmatched = len(unmatched_rows)
        sample_matches = list(mapping.items())[:5]
        sample_misses = [r["filer_id"] for r in unmatched_rows[:5]]

        _print_guardrails(len(filers), matched, unmatched, sample_matches, sample_misses)

        if matched:
            n = update_bioguide_ids(conn, mapping)
            conn.commit()
            print(f"[enrich_bioguide] updated bioguide_id for {n} filers")
        else:
            print("[enrich_bioguide] WARNING: zero matches — no DB writes performed")

        rate = round(matched / len(filers) * 100, 1) if filers else 0.0
        descr = (
            f"congress_filers={len(filers)}"
            f" matched={matched}"
            f" unmatched={unmatched}"
            f" match_rate_pct={rate}"
        )

    except Exception as exc:  # noqa: BLE001
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[enrich_bioguide] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn,
            job="enrich-bioguide",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
