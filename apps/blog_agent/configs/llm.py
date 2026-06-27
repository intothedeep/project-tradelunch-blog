# configs/llm.py
"""
LLM Configuration

Settings for various LLM providers (Ollama, OpenAI, Anthropic).
"""

import os

# ==================== LLM Provider ====================
# Options: "local" (Ollama), "openai", "anthropic"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "local")


# ==================== Ollama (Local LLM) ====================
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")


# ==================== OpenAI ====================
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


# ==================== Anthropic (Claude) ====================
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")


# ==================== Common LLM Settings ====================
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.3"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "2048"))


# ==================== Backward Compatibility ====================
MODEL_NAME = OLLAMA_MODEL


def is_llm_enabled() -> bool:
    """Determine whether LLM-backed metadata generation is enabled.

    Reads environment variables at call time (not import time) so runtime
    overrides and tests take effect. The LLM path is treated as DISABLED when
    either of the following holds:
      - ENABLE_LLM is one of {"false", "0", "no"} (case-insensitive), or
      - LLM_PROVIDER is one of {"none", "off", "disabled"} (case-insensitive).
    Otherwise the LLM path is ENABLED (the default when unset).

    Returns:
        True if the LLM should be used; False to take the no-LLM frontmatter
        metadata path.
    """
    enable_flag = os.getenv("ENABLE_LLM", "").strip().lower()
    if enable_flag in {"false", "0", "no"}:
        return False

    provider = os.getenv("LLM_PROVIDER", "").strip().lower()
    if provider in {"none", "off", "disabled"}:
        return False

    return True
