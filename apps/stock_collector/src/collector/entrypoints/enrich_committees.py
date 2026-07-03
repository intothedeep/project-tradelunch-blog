"""Entrypoint: seed politician_committees + committee_sector_map tables (Phase Q).

Flow:
  1. fetch_committees()           — download committees-current.yaml.
  2. fetch_committee_membership() — download committee-membership-current.yaml.
  3. parse_committees()           — pure: join dicts → (rows, sector_map_rows).
  4. upsert_committee_sector_map  — seed sector map first (no FK dependency).
  5. upsert_committees            — upsert membership rows.
  6. conn.commit().
  7. insert_batch_log()           — always in finally.

Guardrail log (always printed):
  committees_fetched     — committees in committees-current.yaml
  membership_thomas_ids  — distinct thomas_ids in membership YAML
  membership_rows        — PoliticianCommitteeRow objects produced (after parse)
  sector_map_rows        — (thomas_id, sector) pairs produced (after parse)
  distinct_bioguide_ids  — distinct bioguide_ids across membership rows

--dry-run: fetch + parse + print guardrails; NO DB writes.
  Bioguide_ids in membership that have no politician_registry row are written
  anyway — there is no FK constraint on politician_committees.bioguide_id so the
  sink never errors out; callers can join on politician_registry at query time.

Limitation: CURRENT committee membership only (historical not available from the
  congress-legislators dataset). Accepted v1 limitation; noted in UI.

Side effects: network (GitHub raw YAML) + DB writes in non-dry mode.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

from collector.config.settings import database_url
from collector.sink import db_sink
from collector.sink.congress_fetch import fetch_committee_membership, fetch_committees
from collector.sink.politician_db_sink import upsert_committee_sector_map, upsert_committees
from collector.transform.committee_parse import parse_committees


def _print_guardrails(
    committees_fetched: int,
    membership_thomas_ids: int,
    membership_rows: int,
    sector_map_rows: int,
    distinct_bioguide_ids: int,
) -> None:
    print(
        f"[enrich_committees]"
        f" committees_fetched={committees_fetched}"
        f" membership_thomas_ids={membership_thomas_ids}"
        f" membership_rows={membership_rows}"
        f" sector_map_rows={sector_map_rows}"
        f" distinct_bioguide_ids={distinct_bioguide_ids}"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Seed politician_committees + committee_sector_map (Phase Q)."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="fetch + parse + print guardrails only; no DB writes",
    )
    args = parser.parse_args(argv)

    # --- fetch + parse (shared by both paths) ---------------------------------
    print("[enrich_committees] fetching committees-current.yaml …")
    committees_raw = fetch_committees()
    print(f"[enrich_committees] fetched {len(committees_raw)} committee entries")

    print("[enrich_committees] fetching committee-membership-current.yaml …")
    membership_raw = fetch_committee_membership()
    print(f"[enrich_committees] fetched membership for {len(membership_raw)} thomas_ids")

    rows, sector_map_rows = parse_committees(committees_raw, membership_raw)
    distinct_bioguide_ids = len({r.bioguide_id for r in rows})

    _print_guardrails(
        committees_fetched=len(committees_raw),
        membership_thomas_ids=len(membership_raw),
        membership_rows=len(rows),
        sector_map_rows=len(sector_map_rows),
        distinct_bioguide_ids=distinct_bioguide_ids,
    )

    if not rows and not sector_map_rows:
        print("[enrich_committees] WARNING: parse produced zero rows — check YAML structure")

    # --- dry-run exit ---------------------------------------------------------
    if args.dry_run or not database_url():
        print("[enrich_committees] dry-run: skipping DB writes")
        return 0

    # --- live path ------------------------------------------------------------
    started_at = datetime.now(timezone.utc)
    conn = db_sink.connect()
    status, descr = "success", ""

    try:
        n_sectors = upsert_committee_sector_map(conn, sector_map_rows)
        print(f"[enrich_committees] upserted {n_sectors} sector_map rows")

        n_committees = upsert_committees(conn, rows)
        print(f"[enrich_committees] upserted {n_committees} committee membership rows")

        conn.commit()
        print("[enrich_committees] committed")

        descr = (
            f"committees_fetched={len(committees_raw)}"
            f" membership_rows={n_committees}"
            f" sector_map_rows={n_sectors}"
            f" distinct_bioguide_ids={distinct_bioguide_ids}"
        )

    except Exception as exc:  # noqa: BLE001
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[enrich_committees] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn,
            job="enrich-committees",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
