#!/usr/bin/env python
"""
Test LLM Providers - Test local and cloud LLM configurations

Tests:
1. Local LLM (Ollama)
2. OpenAI
3. Anthropic Claude
4. ExtractingAgent with different providers
"""

import asyncio
import os
from llm_factory import create_llm, get_provider_info, LLMProviderError
from agents import ExtractingAgent, AgentTask


async def test_provider(provider_name: str, api_key_env: str = None):
    """Test a specific LLM provider"""
    print(f"\n{'=' * 60}")
    print(f"Testing {provider_name.upper()} Provider")
    print("=" * 60)

    # Check API key if needed
    if api_key_env:
        api_key = os.getenv(api_key_env, "")
        if not api_key:
            print(f"⚠️  {api_key_env} not set. Skipping {provider_name}.")
            print(f"   Set: export {api_key_env}='your-key-here'")
            return False

    try:
        # Create LLM
        print(f"Creating {provider_name} LLM...")
        llm = create_llm(provider=provider_name)
        print(f"✅ LLM created: {llm.__class__.__name__}")

        # Test with simple prompt
        print("\nTesting with simple prompt...")
        response = llm.invoke("Say 'Hello from LLM!' if you can read this.")
        print(f"✅ Response: {response.content[:100]}...")

        return True

    except LLMProviderError as e:
        print(f"❌ Provider error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False


async def test_extracting_agent_with_llm(provider_name: str = None):
    """Test ExtractingAgent with specific LLM provider"""
    print(f"\n{'=' * 60}")
    print(f"Testing ExtractingAgent with {provider_name or 'default'} LLM")
    print("=" * 60)

    # Create agent (will auto-create LLM from config or specified provider)
    if provider_name:
        llm = create_llm(provider=provider_name)
        agent = ExtractingAgent(llm=llm)
    else:
        agent = ExtractingAgent()  # Uses config.LLM_PROVIDER

    # Test with sample file
    sample_file = "./posts/sample-post.md"
    if not os.path.exists(sample_file):
        print(f"⚠️  Sample file not found: {sample_file}")
        return False

    task = AgentTask.create(
        action="extract",
        data={
            "file_path": sample_file,
            "extract_metadata": True
        }
    )

    result = await agent.run(task.to_dict())

    if result["success"]:
        data = result["data"]
        print(f"\n✅ Extraction successful!")
        print(f"   Title: {data.get('title')}")
        print(f"   Tags: {', '.join(data.get('tags', []))}")
        print(f"   Description: {data.get('description', '')[:100]}...")
        return True
    else:
        print(f"❌ Extraction failed: {result.get('error')}")
        return False


async def main():
    """Run all LLM provider tests"""
    print("\n" + "=" * 60)
    print("🧪 LLM Provider Test Suite")
    print("=" * 60)

    # Show current configuration
    info = get_provider_info()
    print(f"\nCurrent Configuration:")
    print(f"  Provider: {info['provider']}")
    print(f"  Model: {info.get('model', 'N/A')}")
    print(f"  Temperature: {info['temperature']}")
    print(f"  Max Tokens: {info['max_tokens']}")
    if 'api_key_set' in info:
        print(f"  API Key Set: {info['api_key_set']}")

    results = {}

    # Test 1: Local LLM (Ollama)
    print("\n" + "=" * 60)
    print("Test 1: Local LLM (Ollama)")
    print("=" * 60)
    user_input = input("Test local Ollama? (y/n): ").lower()
    if user_input == "y":
        results["local"] = await test_provider("local")
    else:
        print("⏭️  Skipped")
        results["local"] = None

    # Test 2: OpenAI
    print("\n" + "=" * 60)
    print("Test 2: OpenAI")
    print("=" * 60)
    user_input = input("Test OpenAI? (y/n): ").lower()
    if user_input == "y":
        results["openai"] = await test_provider("openai", "OPENAI_API_KEY")
    else:
        print("⏭️  Skipped")
        results["openai"] = None

    # Test 3: Anthropic Claude
    print("\n" + "=" * 60)
    print("Test 3: Anthropic Claude")
    print("=" * 60)
    user_input = input("Test Anthropic Claude? (y/n): ").lower()
    if user_input == "y":
        results["anthropic"] = await test_provider("anthropic", "ANTHROPIC_API_KEY")
    else:
        print("⏭️  Skipped")
        results["anthropic"] = None

    # Test 4: ExtractingAgent with LLM
    print("\n" + "=" * 60)
    print("Test 4: ExtractingAgent with LLM")
    print("=" * 60)
    user_input = input("Test ExtractingAgent with current LLM provider? (y/n): ").lower()
    if user_input == "y":
        results["extracting_agent"] = await test_extracting_agent_with_llm()
    else:
        print("⏭️  Skipped")
        results["extracting_agent"] = None

    # Results summary
    print("\n" + "=" * 60)
    print("📊 Test Results Summary")
    print("=" * 60)

    for name, passed in results.items():
        if passed is None:
            status = "⏭️  SKIPPED"
        elif passed:
            status = "✅ PASSED"
        else:
            status = "❌ FAILED"

        print(f"{status} - {name.replace('_', ' ').title()}")

    passed_count = sum(1 for p in results.values() if p is True)
    total_count = sum(1 for p in results.values() if p is not None)

    print()
    print(f"Total: {passed_count}/{total_count} tests passed")
    print("=" * 60)

    # Configuration guide
    print("\n" + "=" * 60)
    print("📝 Configuration Guide")
    print("=" * 60)
    print("""
To use different LLM providers, set environment variables:

1. Local LLM (Ollama):
   export LLM_PROVIDER="local"
   export OLLAMA_MODEL="qwen3:8b"
   # Start Ollama: ollama serve

2. OpenAI:
   export LLM_PROVIDER="openai"
   export OPENAI_API_KEY="sk-..."
   export OPENAI_MODEL="gpt-4o-mini"  # or gpt-4o, gpt-3.5-turbo

3. Anthropic Claude:
   export LLM_PROVIDER="anthropic"
   export ANTHROPIC_API_KEY="sk-ant-..."
   export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"  # or claude-3-opus

4. Common settings:
   export LLM_TEMPERATURE="0.3"
   export LLM_MAX_TOKENS="2048"
""")


if __name__ == "__main__":
    asyncio.run(main())
