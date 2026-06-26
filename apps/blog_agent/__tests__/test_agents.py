#!/usr/bin/env python
# 90_test_agents.py
"""
90. Basic Agent Tests - 기본 에이전트 테스트

각 에이전트의 기본 기능을 테스트합니다.
Ollama/LLM 없이도 대부분의 테스트가 가능합니다.

테스트 순서:
1. ExtractingAgent - 마크다운 파싱
2. UploadingAgent - 시뮬레이션 업로드
3. LoggingAgent - 로그 포맷팅
4. ProjectManager - 전체 통합 (Ollama 필요)
"""

import asyncio
from agents import ExtractingAgent, UploadingAgent, LoggingAgent, ProjectManagerAgent, AgentTask


async def test_extracting_agent():
    """ExtractingAgent 테스트"""
    print("\n" + "=" * 60)
    print("Testing ExtractingAgent")
    print("=" * 60)

    agent = ExtractingAgent()

    task = AgentTask.create(
        action="extract",
        data={
            "file_path": "./posts/sample-post.md",
            "extract_metadata": False,  # LLM 없이 테스트
        },
    )

    result = await agent.run(task.to_dict())

    if result["success"]:
        data = result["data"]
        print(f"✅ Title: {data['title']}")
        print(f"✅ Slug: {data['slug']}")
        print(f"✅ Images found: {len(data['images'])}")
        print(f"✅ Word count: {data['word_count']}")
    else:
        print(f"❌ Failed: {result.get('error')}")

    return result["success"]


async def test_uploading_agent():
    """UploadingAgent 테스트"""
    print("\n" + "=" * 60)
    print("Testing UploadingAgent")
    print("=" * 60)

    agent = UploadingAgent()

    # 가짜 데이터로 테스트
    task = AgentTask.create(
        action="full_upload",
        data={
            "title": "Test Article",
            "content": "This is test content.",
            "slug": "test-article",
            "category": "Technology",
            "tags": ["test", "demo"],
            "images": [
                {"local_path": "./images/test.png", "alt": "Test", "s3_url": None}
            ],
        },
    )

    result = await agent.run(task.to_dict())

    if result["success"]:
        data = result["data"]
        print(f"✅ Article ID: {data['article_id']}")
        print(f"✅ Published URL: {data['published_url']}")
        print(f"✅ Images uploaded: {data['image_count']}")
    else:
        print(f"❌ Failed: {result.get('error')}")

    return result["success"]


async def test_logging_agent():
    """LoggingAgent 테스트"""
    print("\n" + "=" * 60)
    print("Testing LoggingAgent")
    print("=" * 60)

    agent = LoggingAgent()

    # 테스트 로그들
    await agent.run(
        AgentTask.create(
            action="log", data={"message": "This is an info message", "level": "info"}
        ).to_dict()
    )

    await agent.run(
        AgentTask.create(
            action="log",
            data={"message": "This is a success message", "level": "success"},
        ).to_dict()
    )

    await agent.run(
        AgentTask.create(
            action="log", data={"message": "This is a warning", "level": "warning"}
        ).to_dict()
    )

    # 최종 결과 표시
    await agent.run(
        AgentTask.create(
            action="log_result",
            data={
                "result": {
                    "success": True,
                    "data": {
                        "title": "Test Article",
                        "category": "Technology",
                        "article_id": 123,
                        "slug": "test-article",
                        "image_count": 2,
                        "published_url": "https://myblog.com/posts/test-article",
                    },
                }
            },
        ).to_dict()
    )

    print("✅ LoggingAgent test completed")
    return True


async def test_project_manager():
    """ProjectManager 통합 테스트 (Ollama 필요)"""
    print("\n" + "=" * 60)
    print("Testing ProjectManager (requires Ollama)")
    print("=" * 60)

    try:
        from config import MODEL_NAME, OLLAMA_BASE_URL

        pm = ProjectManagerAgent(llm_model=MODEL_NAME, base_url=OLLAMA_BASE_URL)

        # 간단한 명령 테스트
        task = AgentTask.create(
            action="process",
            data={
                "user_command": "upload ./posts/sample-post.md",
                "file_path": "./posts/sample-post.md",
            },
        )

        print("⚠️  This will call Ollama - make sure it's running!")
        print("    Run: ollama serve")
        print()

        result = await pm.run(task.to_dict())

        if result["success"]:
            print("✅ ProjectManager test completed successfully")
        else:
            print(f"❌ ProjectManager test failed: {result.get('error')}")

        return result["success"]

    except Exception as e:
        print(f"⚠️  ProjectManager test skipped: {e}")
        print("    Make sure Ollama is installed and running:")
        print("    ollama serve")
        return False


async def main():
    """모든 테스트 실행"""
    print("\n" + "=" * 60)
    print("🧪 Blog Multi-Agent System - Test Suite")
    print("=" * 60)

    results = {}

    # Phase 1: 개별 에이전트 테스트 (Ollama 불필요)
    print("\n📋 Phase 1: Individual Agent Tests (No LLM required)")
    results["extracting"] = await test_extracting_agent()
    results["uploading"] = await test_uploading_agent()
    results["logging"] = await test_logging_agent()

    # Phase 2: 통합 테스트 (Ollama 필요)
    print("\n📋 Phase 2: Integration Test (Requires Ollama)")
    user_input = input("\nTest ProjectManager with Ollama? (y/n): ").lower()
    if user_input == "y":
        results["project_manager"] = await test_project_manager()
    else:
        print("⏭️  Skipping ProjectManager test")
        results["project_manager"] = None

    # 결과 요약
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

    if passed_count == total_count and total_count > 0:
        print("\n🎉 All tests passed! System is ready.")
        print("\nNext steps:")
        print("  1. Make sure Ollama is running: ollama serve")
        print("  2. Start the CLI: python cli_multi_agent.py")
    else:
        print("\n⚠️  Some tests failed. Please check the errors above.")


if __name__ == "__main__":
    asyncio.run(main())
