"""SIP free-data delay clamp (pure, injectable time for testing)."""

from __future__ import annotations

from datetime import datetime, timedelta

__all__ = ["SIP_DELAY_MINUTES", "clamp_end_to_sip_delay"]

SIP_DELAY_MINUTES = 16  # 15-min SIP delay + 1-min safety buffer


def clamp_end_to_sip_delay(
    end: datetime,
    now: datetime,
    delay_minutes: int = SIP_DELAY_MINUTES,
) -> datetime:
    """Clamp `end` so it never falls inside the SIP free-data delay window.

    If `end` is later than (now - delay_minutes), return (now - delay_minutes);
    otherwise return `end` unchanged. `now` is injected for deterministic tests.

    `end` and `now` must share tz-awareness (both naive or both aware); the
    caller is responsible for passing consistent datetimes.
    """
    cutoff = now - timedelta(minutes=delay_minutes)
    return cutoff if end > cutoff else end
