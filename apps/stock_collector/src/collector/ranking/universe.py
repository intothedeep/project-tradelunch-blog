"""Large-cap candidate universe assembly (Wikipedia S&P500 + Nasdaq100 + iShares
IWB / Russell 1000). The PURE core (``normalize_symbol`` + ``assemble``) is here
and fully testable; the network fetch is injected (see ``fetch_candidates``).

Symbol normalization: Wikipedia uses ``BRK.B`` while yfinance uses ``BRK-B`` —
``assemble`` keeps BOTH forms so downstream fetches and joins never miss.

Invariants: ``assemble`` is deterministic + side-effect-free. Massive is NOT a
dependency (candidate pool is Wikipedia + IWB only).
"""

from __future__ import annotations

from collections.abc import Iterable


def normalize_symbol(symbol: str) -> str:
    """yfinance form: dots -> dashes (BRK.B -> BRK-B). Upper-cased, trimmed."""
    return symbol.strip().upper().replace(".", "-")


def assemble(*sources: Iterable[str]) -> list[str]:
    """Union candidate symbols from N sources, de-duped, both dot/dash forms kept.

    Returns a sorted, de-duplicated list. For any symbol containing a '.', both
    the original (dot) and the normalized (dash) forms are included so a join on
    either convention resolves.
    """
    out: set[str] = set()
    for src in sources:
        for raw in src:
            s = raw.strip().upper()
            if not s:
                continue
            out.add(s)
            if "." in s:
                out.add(normalize_symbol(s))
    return sorted(out)
