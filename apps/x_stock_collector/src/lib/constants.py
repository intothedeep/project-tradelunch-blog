# Constants for the lib module
import os
import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # honor .env regardless of import order

_REPO_ROOT = Path(__file__).resolve().parents[2]  # src/lib/constants.py -> repo root

DATA_DIR = _REPO_ROOT / "data"

TICKER_DIR_PATH = str(DATA_DIR / "tickers") + "/"  # keep trailing-slash compat

PROVIDER_MASSIVE = "massive"
PROVIDER_ALPACA = "alpaca"
PROVIDER_YAHOO = "yahoo"  # reserved; not yet implemented
VALID_PROVIDERS = (PROVIDER_MASSIVE, PROVIDER_ALPACA, PROVIDER_YAHOO)

# Sentinel "ticker" for grouped-daily jobs: one job per DATE (all tickers in one
# request), not one job per ticker. from_date == to_date == the trading date.
GROUPED_TICKER = "__GROUPED__"

# Massive (formerly Polygon.io) REST host. Defaults to api.polygon.io, which
# Massive keeps serving until the 2026 deprecation; set MASSIVE_API_BASE to
# https://api.massive.com to cut over (a one-line, no-code change).
MASSIVE_API_BASE = os.getenv("MASSIVE_API_BASE", "https://api.polygon.io")


def massive_api_key() -> str | None:
    """Massive API key, read at call time from MASSIVE_API_KEY."""
    return os.getenv("MASSIVE_API_KEY")


def stock_dir(provider: str, ticker: str) -> Path:
    """Per-provider output directory for a ticker's OHLCV CSVs.

    OHLCV data is separated by provider so Massive and Alpaca files never
    collide: data/<provider>/<TICKER>/ (e.g. data/massive/AAPL/).
    """
    return DATA_DIR / provider / ticker


PROVIDER_SEC13F = "sec13f"  # SEC EDGAR 13F-HR holdings (NOT an OHLCV price provider)

# Holdings providers are deliberately separate from VALID_PROVIDERS (price/OHLCV).
HOLDINGS_PROVIDERS = (PROVIDER_SEC13F,)

SEC_EDGAR_BASE = "https://www.sec.gov"
SEC_DATA_BASE = "https://data.sec.gov"

# OpenFIGI CUSIP -> ticker mapping (Phase P). NOT an OHLCV price provider; used
# only by run_security_map to resolve 13F CUSIPs. Free /v3/mapping endpoint.
PROVIDER_OPENFIGI = "openfigi"
OPENFIGI_MAPPING_URL = "https://api.openfigi.com/v3/mapping"


def sec_user_agent() -> str:
    """SEC EDGAR User-Agent (read at call time from SEC_USER_AGENT).

    SEC mandates a descriptive UA ("Name email@example.com"). RAISES if unset
    because SEC rejects requests without it.
    """
    ua = os.getenv("SEC_USER_AGENT")
    if not ua:
        raise ValueError("SEC_USER_AGENT environment variable is not set")
    return ua


def holdings_dir(provider: str, cik: str) -> Path:
    """Per-fund output dir for 13F holdings CSVs: data/<provider>/<CIK>/."""
    return DATA_DIR / provider / cik


_UNSAFE_PATH_CHARS = re.compile(r"[^A-Za-z0-9_-]")


def safe_symbol(symbol: str) -> str:
    """Map a market symbol to a filesystem-safe segment.

    Yahoo index symbols carry path-unsafe chars (^VIX, ^GSPC) and some equities
    carry dots (BRK.B). Replace any char outside [A-Za-z0-9_-] with '_' (collision
    -safe, does not strip): '^VIX' -> '_VIX', 'BRK.B' -> 'BRK_B', 'AAPL' -> 'AAPL'.
    """
    return _UNSAFE_PATH_CHARS.sub("_", symbol)
