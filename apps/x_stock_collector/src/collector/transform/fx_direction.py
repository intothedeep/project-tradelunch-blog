"""Pure: derive the source-native FX display label from a Yahoo FX symbol.

Yahoo quotes FX as ``AAABBB=X`` (AAA per 1 BBB... actually price = BBB per AAA)
or the short ``BBB=X`` form which means USD/BBB. We keep the SOURCE-NATIVE
direction (do not invert), per Decision #31:
  EURUSD=X -> "EUR/USD" ; KRW=X -> "USD/KRW" ; JPY=X -> "USD/JPY" ; THB=X -> "USD/THB"

Invariants: deterministic; no side effects. Raises ``ValueError`` on a non-FX
or unparseable symbol.
"""

from __future__ import annotations

_FX_SUFFIX = "=X"


def fx_label(symbol: str) -> str:
    """Return the source-native "BASE/QUOTE" label for a Yahoo FX symbol.

    A 6-letter body ``AAABBB=X`` -> "AAA/BBB"; a 3-letter body ``BBB=X`` ->
    "USD/BBB" (Yahoo's implicit USD base for the short form).
    """
    normalized = symbol.upper()
    if not normalized.endswith(_FX_SUFFIX):
        raise ValueError(f"not a Yahoo FX symbol (missing '=X'): {symbol!r}")
    body = normalized[: -len(_FX_SUFFIX)]
    if not body.isalpha():
        raise ValueError(f"unparseable FX symbol body: {symbol!r}")
    if len(body) == 6:
        return f"{body[:3]}/{body[3:]}"
    if len(body) == 3:
        return f"USD/{body}"
    raise ValueError(f"unexpected FX body length {len(body)}: {symbol!r}")
