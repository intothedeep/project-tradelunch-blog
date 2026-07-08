"""Pure transform: match kadoa congressional filers to congress-legislators bioguide IDs.

Purpose: given raw YAML records from unitedstates/congress-legislators, build a
normalized lookup index and match each kadoa filer (from politician_registry) to
its stable bioguide_id. Executive-branch (OGE) filers are NOT in congress and
are expected to produce None matches — that is correct behavior, not an error.

Invariants:
  * No I/O, no network, no DB — pure functions, stdlib + dataclasses only.
  * Matching is fully deterministic: same (filer_name, state, chamber, index)
    always returns the same result.
  * Unmatched filers always return None (never raise).
  * Suffix stripping is applied symmetrically to both sides before comparison.
  * A None chamber or None state always returns None (executive / OGE path).

Side effects: none.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Optional


# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class LegislatorEntry:
    """Normalized index entry derived from one raw YAML legislator record.

    ``states``   — upper-case 2-letter codes from ALL terms (a legislator may
                   have served in multiple states across their career, though
                   this is rare and mostly affects historical records).
    ``chambers`` — 'house' | 'senate' from ALL terms (a legislator may have
                   served in both chambers at different points in their career).
    """

    bioguide_id: str
    first: str           # normalized first name
    last: str            # normalized last name
    official_full: str   # normalized official_full (informational, not used in match)
    states: frozenset[str]
    chambers: frozenset[str]


# ---------------------------------------------------------------------------
# Name normalization
# ---------------------------------------------------------------------------

# Trailing name suffixes to strip before comparison.
_SUFFIX_RE = re.compile(
    r"\b(jr|sr|ii|iii|iv|esq|phd|md|dds|dvm|ret)\b\.?$",
    re.IGNORECASE,
)
# Keep only word characters and whitespace (strips apostrophes, hyphens, etc.).
_PUNCT_RE = re.compile(r"[^\w\s]")


def _normalize(name: str) -> str:
    """NFKD-normalize, lowercase, strip punctuation, drop name suffixes, collapse spaces.

    Applied to BOTH the filer_name and the legislator's name before any comparison
    so the transformation is symmetric and deterministic.
    """
    # Decompose accented characters (ü → u + combining mark) then discard marks.
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_str = nfkd.encode("ascii", "ignore").decode("ascii")
    lower = ascii_str.lower()
    no_punct = _PUNCT_RE.sub("", lower)
    # Iteratively strip trailing suffixes (handles "Jr. III").
    prev: str | None = None
    while prev != no_punct:
        prev = no_punct
        no_punct = _SUFFIX_RE.sub("", no_punct).strip()
    return " ".join(no_punct.split())


def _split_first_last(normalized_name: str) -> tuple[str, str]:
    """Split 'first [middle…] last' → (first_token, last_token).

    Middle names are ignored — the caller uses only first and last for matching.
    For a single-token name (edge case), returns (token, token).
    """
    parts = normalized_name.split()
    if not parts:
        return "", ""
    return parts[0], parts[-1]


# ---------------------------------------------------------------------------
# Term helpers
# ---------------------------------------------------------------------------

_TERM_TYPE_TO_CHAMBER: dict[str, str] = {"rep": "house", "sen": "senate"}


def _chambers_from_terms(terms: list[dict]) -> frozenset[str]:
    result: set[str] = set()
    for term in terms:
        ch = _TERM_TYPE_TO_CHAMBER.get(str(term.get("type", "")).lower())
        if ch:
            result.add(ch)
    return frozenset(result)


def _states_from_terms(terms: list[dict]) -> frozenset[str]:
    result: set[str] = set()
    for term in terms:
        st = term.get("state")
        if st:
            result.add(str(st).upper())
    return frozenset(result)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def build_legislator_index(records: list[dict]) -> list[LegislatorEntry]:
    """Build a normalized index from raw congress-legislators YAML records.

    Deduplicates on bioguide_id: if the same legislator appears in both the
    current and historical files, the later entry overwrites the earlier one
    (their data is identical so order does not matter).

    Args:
        records: raw list[dict] from fetch_legislators() (current + historical).

    Returns:
        list[LegislatorEntry] — one entry per unique bioguide_id.
    """
    seen: dict[str, LegislatorEntry] = {}
    for rec in records:
        bid = (rec.get("id") or {}).get("bioguide")
        if not bid:
            continue
        name_block = rec.get("name") or {}
        raw_first = str(name_block.get("first") or "")
        raw_last = str(name_block.get("last") or "")
        raw_official = str(name_block.get("official_full") or "").strip()
        if not raw_official:
            raw_official = f"{raw_first} {raw_last}".strip()

        terms: list[dict] = rec.get("terms") or []
        seen[bid] = LegislatorEntry(
            bioguide_id=bid,
            first=_normalize(raw_first),
            last=_normalize(raw_last),
            official_full=_normalize(raw_official),
            states=_states_from_terms(terms),
            chambers=_chambers_from_terms(terms),
        )

    return list(seen.values())


def match_filer(
    filer_name: str,
    state: Optional[str],
    chamber: Optional[str],
    index: list[LegislatorEntry],
) -> Optional[str]:
    """Match one kadoa filer to a bioguide_id, or return None.

    Matching rules (applied in order):
    1. No chamber or no state → None (executive / OGE filers are not in congress).
    2. Normalize filer_name → extract (filer_first, filer_last).
       E.g. "Donald Sternoff Beyer Jr" → first="donald", last="beyer".
    3. Coarse filter: last == filer_last AND state in entry.states AND
       chamber in entry.chambers.
    4. Single candidate → return bioguide_id.
    5. Multiple candidates → exact first-name match (if unique → return).
    6. Prefix / initial match (entry.first starts with filer_first[0]) →
       return if unique.
    7. Still ambiguous or zero → None.

    Args:
        filer_name: raw kadoa filer_name string.
        state:      2-letter state code (e.g. "VA") or None for exec filers.
        chamber:    'house' | 'senate' or None for exec filers.
        index:      pre-built legislator index from build_legislator_index().

    Returns:
        bioguide_id str, or None when unmatched / ambiguous.
    """
    if not chamber or not state:
        return None

    norm_chamber = chamber.lower().strip()
    norm_state = state.upper().strip()

    norm_full = _normalize(filer_name)
    if not norm_full:
        return None

    filer_first, filer_last = _split_first_last(norm_full)
    if not filer_last:
        return None

    # Step 3: coarse filter on last + state + chamber.
    candidates = [
        e
        for e in index
        if e.last == filer_last
        and norm_state in e.states
        and norm_chamber in e.chambers
    ]

    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0].bioguide_id

    # Step 5: exact first-name disambiguation.
    if filer_first:
        exact = [e for e in candidates if e.first == filer_first]
        if len(exact) == 1:
            return exact[0].bioguide_id
        if len(exact) > 1:
            # True ambiguity — cannot resolve.
            return None

        # Step 6: prefix / initial match (e.g. "J. Smith" matches "James Smith").
        prefix = [e for e in candidates if e.first.startswith(filer_first[0])]
        if len(prefix) == 1:
            return prefix[0].bioguide_id

    return None
