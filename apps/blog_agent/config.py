# config.py
"""
Configuration - Backward Compatibility

This file re-exports all configuration from the configs/ module.
New code should import from configs directly:
    from configs import SUPABASE_URL, SUPABASE_STORAGE_BUCKET
    from configs.database import get_database_url
"""

# Re-export configuration explicitly (no star imports) so consumers using
# `import config; config.NAME` and `from config import NAME` keep working.
from configs.agent import (
    AGENT_TIMEOUT,
    CLI_HISTORY_FILE,
    CLI_MAX_HISTORY,
    MAX_RETRIES,
    MCP_ENABLED,
    MCP_SERVER_PATH,
)
from configs.database import DATABASE_URL, get_database_url
from configs.env import (
    API_SITE_DOMAIN,
    BLOG_BASE_URL,
    DEFAULT_USER_ID,
    DEFAULT_BLOG_AUTHOR,
    IS_DEVELOPMENT,
    IS_LOCAL,
    IS_PRODUCTION,
    LOG_DATE_FORMAT,
    LOG_FORMAT,
    LOG_LEVEL,
    NODE_ENV,
    SITE_DOMAIN,
)
from configs.llm import (
    ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL,
    LLM_MAX_TOKENS,
    LLM_PROVIDER,
    LLM_TEMPERATURE,
    MODEL_NAME,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    is_llm_enabled,
)
from configs.paths import LOGS_DIR, POSTS_DIR, PROJECT_ROOT, TEMP_DIR
from configs.storage import (
    CDN_ASSETS,
    STORAGE_ACCESS_KEY,
    STORAGE_BUCKET,
    STORAGE_ENDPOINT,
    STORAGE_PROVIDER,
    STORAGE_REGION,
    STORAGE_SECRET_KEY,
    SUPABASE_PROJECT_ID,
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY,
    SUPABASE_STORAGE_BUCKET,
    SUPABASE_URL,
)

__all__ = [
    # Agent
    "AGENT_TIMEOUT",
    "CLI_HISTORY_FILE",
    "CLI_MAX_HISTORY",
    "MAX_RETRIES",
    "MCP_ENABLED",
    "MCP_SERVER_PATH",
    # Database
    "DATABASE_URL",
    "get_database_url",
    # Environment
    "API_SITE_DOMAIN",
    "BLOG_BASE_URL",
    "DEFAULT_USER_ID",
    "DEFAULT_BLOG_AUTHOR",
    "IS_DEVELOPMENT",
    "IS_LOCAL",
    "IS_PRODUCTION",
    "LOG_DATE_FORMAT",
    "LOG_FORMAT",
    "LOG_LEVEL",
    "NODE_ENV",
    "SITE_DOMAIN",
    # LLM
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MODEL",
    "LLM_MAX_TOKENS",
    "LLM_PROVIDER",
    "LLM_TEMPERATURE",
    "MODEL_NAME",
    "OLLAMA_BASE_URL",
    "OLLAMA_MODEL",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "is_llm_enabled",
    # Paths
    "LOGS_DIR",
    "POSTS_DIR",
    "PROJECT_ROOT",
    "TEMP_DIR",
    # Storage (provider-agnostic)
    "STORAGE_PROVIDER",
    "STORAGE_ENDPOINT",
    "STORAGE_ACCESS_KEY",
    "STORAGE_SECRET_KEY",
    "STORAGE_REGION",
    "STORAGE_BUCKET",
    # Storage (Supabase legacy, kept for compat)
    "CDN_ASSETS",
    "SUPABASE_PROJECT_ID",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_STORAGE_BUCKET",
    "SUPABASE_URL",
]
