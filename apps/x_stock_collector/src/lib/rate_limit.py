"""Token-bucket rate limiter + HTTP 429 backoff (stdlib only).

Free-tier APIs cap request rate; without throttling the workers hammer the
endpoint and get 429-ed. Per-provider request-per-minute caps:
Massive Basic = 5 rpm, Alpaca Basic = 200 rpm.
"""

import threading
import time
from typing import Callable, Dict

import requests

from lib.constants import (
    PROVIDER_ALPACA,
    PROVIDER_MASSIVE,
    PROVIDER_OPENFIGI,
    PROVIDER_SEC13F,
    PROVIDER_YAHOO,
)

__all__ = ["RateLimiter", "for_provider", "request_with_backoff", "PROVIDER_RPM"]

# Free-tier requests-per-minute by provider.
PROVIDER_RPM: Dict[str, int] = {
    PROVIDER_MASSIVE: 5,
    PROVIDER_ALPACA: 200,
    PROVIDER_YAHOO: 30,  # conservative; yfinance is unofficial and rate-blocks
    PROVIDER_SEC13F: 300,  # SEC cap ~10 req/s (600 rpm); 300 = 5 req/s, conservative
    # OpenFIGI /v3/mapping: keyless ~25 req/min, keyed ~250 req/min (batched, up
    # to 100 jobs/req keyed). 20 = conservative keyless floor; RE-VERIFY current
    # limits against OpenFIGI docs before raising for a keyed deploy.
    PROVIDER_OPENFIGI: 20,
}


class RateLimiter:
    """Thread-safe token bucket: `rpm` tokens, refilled continuously over 60s.

    SCOPE: in-memory and per-process. It coordinates threads within ONE Python
    process only. Running N separate worker processes gives N independent
    buckets, i.e. an effective N x rpm against the API. To cap rate across
    processes you need a shared store (Redis/SQLite) — out of scope here.
    """

    def __init__(self, rpm: int) -> None:
        if rpm <= 0:
            raise ValueError("rpm must be positive")
        self.rpm = rpm
        self._capacity = float(rpm)
        self._tokens = float(rpm)
        self._refill_per_sec = rpm / 60.0
        self._lock = threading.Lock()
        self._last = time.monotonic()

    def acquire(self) -> None:
        """Block until a token is available, then consume one."""
        while True:
            with self._lock:
                now = time.monotonic()
                self._tokens = min(
                    self._capacity,
                    self._tokens + (now - self._last) * self._refill_per_sec,
                )
                self._last = now
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return
                wait = (1.0 - self._tokens) / self._refill_per_sec
            time.sleep(wait)


_limiters: Dict[str, RateLimiter] = {}
_limiters_lock = threading.Lock()


def for_provider(provider: str) -> RateLimiter:
    """Return the shared limiter for `provider`, creating it on first use."""
    with _limiters_lock:
        limiter = _limiters.get(provider)
        if limiter is None:
            rpm = PROVIDER_RPM.get(provider)
            if rpm is None:
                raise KeyError(f"no rpm configured for provider {provider!r}")
            limiter = RateLimiter(rpm)
            _limiters[provider] = limiter
        return limiter


def request_with_backoff(
    do_request: Callable[[], requests.Response],
    *,
    limiter: RateLimiter | None = None,
    max_retries: int = 5,
    base_delay: float = 1.0,
) -> requests.Response:
    """Call `do_request`; on HTTP 429 retry with exponential backoff.

    If `limiter` is given, `limiter.acquire()` is called before EVERY attempt
    (the initial request and each retry) so retries never bypass the rate cap.
    The caller must NOT pre-acquire; this function owns the throttling.

    Honors an integer `Retry-After` header when present (HTTP-date form is not
    supported — Massive and Alpaca send integer seconds). Returns the last
    response (even if still 429 after `max_retries`) for the caller to handle.
    """

    def _attempt() -> requests.Response:
        if limiter is not None:
            limiter.acquire()
        return do_request()

    response = _attempt()
    for attempt in range(max_retries):
        if response.status_code != 429:
            return response
        retry_after = response.headers.get("Retry-After")
        if retry_after and retry_after.isdigit():
            delay = float(retry_after)
        else:
            delay = base_delay * (2**attempt)
        time.sleep(delay)
        response = _attempt()
    return response
