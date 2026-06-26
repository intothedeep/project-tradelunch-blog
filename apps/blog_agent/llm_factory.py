# llm_factory.py
"""
LLM Factory - LLM 프로바이더 관리 및 인스턴스 생성

Supports:
- Local LLM (Ollama with Qwen, Llama, etc.)
- OpenAI (GPT-4, GPT-3.5, etc.)
- Anthropic (Claude 3.5 Sonnet, Opus, Haiku)

Usage:
    from llm_factory import create_llm

    # Use environment variable LLM_PROVIDER
    llm = create_llm()

    # Or specify provider explicitly
    llm = create_llm(provider="openai")
    llm = create_llm(provider="anthropic")
"""

from typing import Optional, Any
from langchain_core.language_models import BaseChatModel
import config


class LLMProviderError(Exception):
    """LLM provider configuration or instantiation error"""
    pass


# Singleton LLM instance storage
_shared_llm_instance: Optional[BaseChatModel] = None


def get_shared_llm() -> BaseChatModel:
    """
    Get or create a shared LLM instance (singleton pattern).
    
    All agents should use this function to share the same LLM instance,
    reducing memory usage and connection overhead.
    
    Returns:
        Shared BaseChatModel instance
        
    Example:
        >>> from llm_factory import get_shared_llm
        >>> llm = get_shared_llm()  # Creates or returns existing instance
    """
    global _shared_llm_instance
    
    if _shared_llm_instance is None:
        _shared_llm_instance = create_llm()
    
    return _shared_llm_instance


def reset_shared_llm() -> None:
    """Reset the shared LLM instance (useful for testing or config changes)."""
    global _shared_llm_instance
    _shared_llm_instance = None


def create_llm(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    **kwargs: Any
) -> BaseChatModel:
    """
    Create LLM instance based on provider configuration.

    Args:
        provider: LLM provider ("local", "openai", "anthropic").
                  Defaults to config.LLM_PROVIDER
        model: Model name. Defaults to provider-specific config
        temperature: Temperature for generation. Defaults to config.LLM_TEMPERATURE
        max_tokens: Maximum tokens. Defaults to config.LLM_MAX_TOKENS
        **kwargs: Additional provider-specific arguments

    Returns:
        Configured LLM instance (BaseChatModel)

    Raises:
        LLMProviderError: If provider not supported or API key missing

    Examples:
        >>> # Use local Ollama
        >>> llm = create_llm(provider="local")

        >>> # Use OpenAI with specific model
        >>> llm = create_llm(provider="openai", model="gpt-4o")

        >>> # Use Anthropic Claude
        >>> llm = create_llm(provider="anthropic")
    """
    # Get provider (default from config)
    provider = provider or config.LLM_PROVIDER
    provider = provider.lower()

    # Get common parameters
    temperature = temperature if temperature is not None else config.LLM_TEMPERATURE
    max_tokens = max_tokens if max_tokens is not None else config.LLM_MAX_TOKENS

    # Create LLM based on provider
    if provider == "local":
        return _create_local_llm(model, temperature, max_tokens, **kwargs)
    elif provider == "openai":
        return _create_openai_llm(model, temperature, max_tokens, **kwargs)
    elif provider == "anthropic":
        return _create_anthropic_llm(model, temperature, max_tokens, **kwargs)
    else:
        raise LLMProviderError(
            f"Unsupported LLM provider: {provider}. "
            f"Supported: 'local', 'openai', 'anthropic'"
        )


def _create_local_llm(
    model: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 2048,
    **kwargs: Any
) -> BaseChatModel:
    """
    Create local LLM instance (Ollama).

    Requires:
        - Ollama server running (ollama serve)
        - Model pulled (ollama pull qwen3:8b)
    """
    try:
        from langchain_ollama import ChatOllama
    except ImportError:
        raise LLMProviderError(
            "langchain-ollama not installed. "
            "Install: pip install langchain-ollama"
        )

    model = model or config.OLLAMA_MODEL
    base_url = config.OLLAMA_BASE_URL

    try:
        llm = ChatOllama(
            model=model,
            base_url=base_url,
            temperature=temperature,
            num_predict=max_tokens,
            **kwargs
        )
        return llm
    except Exception as e:
        raise LLMProviderError(
            f"Failed to create local LLM (Ollama): {e}. "
            f"Make sure Ollama is running: ollama serve"
        )


def _create_openai_llm(
    model: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 2048,
    **kwargs: Any
) -> BaseChatModel:
    """
    Create OpenAI LLM instance.

    Requires:
        - OPENAI_API_KEY environment variable
    """
    try:
        from langchain_openai import ChatOpenAI
    except ImportError:
        raise LLMProviderError(
            "langchain-openai not installed. "
            "Install: pip install langchain-openai openai"
        )

    api_key = config.OPENAI_API_KEY
    if not api_key:
        raise LLMProviderError(
            "OPENAI_API_KEY not set. "
            "Set environment variable: export OPENAI_API_KEY='sk-...'"
        )

    model = model or config.OPENAI_MODEL

    try:
        llm = ChatOpenAI(
            model=model,
            api_key=api_key,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
        return llm
    except Exception as e:
        raise LLMProviderError(f"Failed to create OpenAI LLM: {e}")


def _create_anthropic_llm(
    model: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 2048,
    **kwargs: Any
) -> BaseChatModel:
    """
    Create Anthropic (Claude) LLM instance.

    Requires:
        - ANTHROPIC_API_KEY environment variable
    """
    try:
        from langchain_anthropic import ChatAnthropic
    except ImportError:
        raise LLMProviderError(
            "langchain-anthropic not installed. "
            "Install: pip install langchain-anthropic anthropic"
        )

    api_key = config.ANTHROPIC_API_KEY
    if not api_key:
        raise LLMProviderError(
            "ANTHROPIC_API_KEY not set. "
            "Set environment variable: export ANTHROPIC_API_KEY='sk-ant-...'"
        )

    model = model or config.ANTHROPIC_MODEL

    try:
        llm = ChatAnthropic(
            model=model,
            api_key=api_key,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
        return llm
    except Exception as e:
        raise LLMProviderError(f"Failed to create Anthropic LLM: {e}")


def get_provider_info() -> dict[str, Any]:
    """
    Get current LLM provider configuration info.

    Returns:
        Dictionary with provider, model, and availability info
    """
    provider = config.LLM_PROVIDER
    info = {
        "provider": provider,
        "temperature": config.LLM_TEMPERATURE,
        "max_tokens": config.LLM_MAX_TOKENS,
    }

    if provider == "local":
        info["model"] = config.OLLAMA_MODEL
        info["base_url"] = config.OLLAMA_BASE_URL
        info["available"] = True  # Assume available if configured
    elif provider == "openai":
        info["model"] = config.OPENAI_MODEL
        info["available"] = bool(config.OPENAI_API_KEY)
        info["api_key_set"] = bool(config.OPENAI_API_KEY)
    elif provider == "anthropic":
        info["model"] = config.ANTHROPIC_MODEL
        info["available"] = bool(config.ANTHROPIC_API_KEY)
        info["api_key_set"] = bool(config.ANTHROPIC_API_KEY)

    return info


# Convenience function to test LLM connection
async def test_llm(provider: Optional[str] = None) -> bool:
    """
    Test LLM connection with a simple prompt.

    Args:
        provider: LLM provider to test. Defaults to config.LLM_PROVIDER

    Returns:
        True if successful, False otherwise
    """
    try:
        llm = create_llm(provider=provider)
        response = llm.invoke("Say 'OK' if you can read this.")
        return bool(response.content)
    except Exception as e:
        print(f"❌ LLM test failed: {e}")
        return False
