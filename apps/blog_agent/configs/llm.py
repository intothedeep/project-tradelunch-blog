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
