"""Pure transform: parse committee YAML data into typed rows for DB upsert.

Purpose: join committees-current.yaml (list) + committee-membership-current.yaml
(dict[thomas_id -> members]) into PoliticianCommitteeRow objects and
(thomas_id, sector) sector-map tuples.  Also derives sector_map_rows from the
fixed COMMITTEE_SECTOR_PATTERNS constant so the committee_sector_map table can
be seeded from the same parse pass.

Invariants:
  * Pure: no network, no DB, no side effects.
  * COMMITTEE_SECTOR_PATTERNS is the authoritative v1 name-substring → sector map
    (case-insensitive substring match on committee name).
  * Membership entries without a 'bioguide' key are silently skipped.
  * thomas_ids in membership that have no matching committee dict are silently
    skipped (defensive against YAML schema drift).
  * Committees whose names match no pattern produce no sector_map rows.
  * thomas_id is case-preserved (e.g. 'HSAS', 'SSBK').

Side effects: none.
"""

from __future__ import annotations

from collector.schema.rows import PoliticianCommitteeRow

# ---------------------------------------------------------------------------
# Fixed committee-name → sector map (v1).
# Matching: case-insensitive substring of committee_name.
# Sectors align to Yahoo GICS labels used in symbol_fundamentals / security_map.
# ---------------------------------------------------------------------------

COMMITTEE_SECTOR_PATTERNS: list[tuple[str, list[str]]] = [
    ("Armed Services",                        ["Industrials"]),
    ("Financial Services",                    ["Financial Services"]),
    ("Banking, Housing",                      ["Financial Services", "Real Estate"]),
    ("Energy and Commerce",                   ["Energy", "Healthcare", "Communication Services", "Utilities"]),
    ("Energy and Natural Resources",          ["Energy", "Utilities", "Basic Materials"]),
    ("Health, Education, Labor",              ["Healthcare"]),
    ("Agriculture",                           ["Consumer Defensive", "Basic Materials"]),
    ("Science, Space, and Technology",        ["Technology"]),
    ("Commerce, Science, and Transportation", ["Technology", "Communication Services", "Industrials"]),
    ("Homeland Security",                     ["Industrials"]),
    ("Natural Resources",                     ["Energy", "Basic Materials"]),
    ("Transportation and Infrastructure",     ["Industrials"]),
]


def _sectors_for_name(name: str) -> list[str]:
    """Return the list of sectors matched by the committee name (case-insensitive substring).

    Returns [] when no pattern matches.
    """
    name_lower = name.lower()
    for pattern, sectors in COMMITTEE_SECTOR_PATTERNS:
        if pattern.lower() in name_lower:
            return sectors
    return []


def parse_committees(
    committees: list[dict],
    membership: dict[str, list[dict]],
) -> tuple[list[PoliticianCommitteeRow], list[tuple[str, str]]]:
    """Parse raw YAML dicts into typed rows.

    Args:
        committees: raw list from committees-current.yaml — each dict has at
                    minimum keys: thomas_id, name, type.
        membership: raw dict from committee-membership-current.yaml — keyed by
                    thomas_id -> list of member dicts with 'bioguide' key.

    Returns:
        (rows, sector_map_rows) where:
            rows            — one PoliticianCommitteeRow per (bioguide, committee).
            sector_map_rows — one (thomas_id, sector) per matching committee/sector pair.
                              Covers ALL committees that match a pattern, not just those
                              with current members, so the sector map is complete even
                              for committees with no tracked filers.
    """
    # Build thomas_id -> committee metadata lookup.
    committee_lookup: dict[str, dict] = {}
    for c in committees:
        tid = c.get("thomas_id")
        if not tid:
            continue
        committee_lookup[tid] = c

    # Build sector_map_rows for all matching committees.
    sector_map_rows: list[tuple[str, str]] = []
    for tid, meta in committee_lookup.items():
        name = meta.get("name") or ""
        for sector in _sectors_for_name(name):
            sector_map_rows.append((tid, sector))

    # Build PoliticianCommitteeRow per membership entry.
    rows: list[PoliticianCommitteeRow] = []
    for tid, members in membership.items():
        meta = committee_lookup.get(tid)
        if meta is None:
            # thomas_id from membership not in committees-current — skip gracefully.
            continue
        committee_name = meta.get("name") or ""
        committee_type = meta.get("type") or ""
        for member in members:
            bioguide = member.get("bioguide")
            if not bioguide:
                continue
            rows.append(
                PoliticianCommitteeRow(
                    bioguide_id=bioguide,
                    committee_thomas_id=tid,
                    committee_name=committee_name,
                    committee_type=committee_type,
                    title=member.get("title"),
                )
            )

    return rows, sector_map_rows
