# configs/env.py
"""
Environment Configuration

Load environment variables and set runtime mode.
"""

import os

# Load .env file if python-dotenv available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# ==================== Environment ====================
NODE_ENV = os.getenv("NODE_ENV", "development")
IS_DEVELOPMENT = NODE_ENV == "development"
IS_PRODUCTION = NODE_ENV == "production"
IS_LOCAL = NODE_ENV == "local"


# ==================== User Configuration ====================
DEFAULT_USER_ID = int(os.getenv("DEFAULT_USER_ID", "2"))
DEFAULT_USERNAME = os.getenv("DEFAULT_USERNAME", "taeklim")


# ==================== Domain Configuration ====================
SITE_DOMAIN = os.getenv("SITE_DOMAIN", "http://localhost:3000")
API_SITE_DOMAIN = os.getenv("API_SITE_DOMAIN", "https://my-api.prettylog.com")
BLOG_BASE_URL = os.getenv("BLOG_BASE_URL", "https://my.prettylog")


# ==================== Logging ====================
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = "[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
