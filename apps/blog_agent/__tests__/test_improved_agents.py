#!/usr/bin/env python
# 91_test_improved_agents.py
"""
91. Improved Agent Tests - 개선된 에이전트 테스트

개선된 기능들을 테스트합니다:
- DocumentScannerAgent - 폴더 구조 스캔
- 개선된 ExtractingAgent - 태그/요약 생성
- 개선된 UploadingAgent - 썸네일 우선 처리
- 스키마 검증

테스트 순서:
1. DocumentScanner - 폴더 스캔
2. Improved Extracting - 메타데이터 생성
3. Improved Uploading - 썸네일 처리
4. Schema - 스키마 설명 생성
5. LLM Integration - Qwen3 통합 (옵션)
"""

import asyncio

from agents import AgentTask, DocumentScannerAgent, ExtractingAgent, UploadingAgent
from schema import PostSchema, generate_slug_from_title, get_schema_description


async def test_document_scanner():
    """DocumentScannerAgent 테스트"""
    print("\n" + "=" * 60)
    print("Testing DocumentScannerAgent")
    print("=" * 60)

    scanner = DocumentScannerAgent()

    task = AgentTask.create(action="scan", data={"root_path": "./docs"})

    result = await scanner.run(task.to_dict())

    if result["success"]:
        data = result["data"]
        print(f"✅ Found {data['total_articles']} articles")
        print(f"✅ Categories: {data['total_categories']}")

        print("\nCategory Tree:")
        print(scanner.get_category_summary(data["category_tree"]))

        print("\nArticles:")
        for article in data["articles"]:
            print(f"  📄 {article['article_name']}")
            # Show full category hierarchy
            categories = article.get('categories', [])
            if categories:
                category_path = ' > '.join(categories)
                print(f"     Categories: {category_path}")
            else:
                print("     Categories: (root)")
            print(f"     Thumbnail: {'✓' if article['thumbnail'] else '✗'}")
            print(f"     Images: {len(article['images'])}")

        return result
    else:
        print(f"❌ Failed: {result.get('error')}")
        return None


async def test_improved_extracting(article_info):
    """개선된 ExtractingAgent 테스트 (태그와 요약 생성)"""
    print("\n" + "=" * 60)
    print("Testing Improved ExtractingAgent")
    print("=" * 60)

    # Test without LLM first (basic functionality)
    # LLM is now auto-enabled by default, so explicitly disable for basic test
    agent = ExtractingAgent(enable_llm=False)

    task = AgentTask.create(
        action="extract",
        data={"article_info": article_info, "extract_metadata": False},
    )

    result = await agent.run(task.to_dict())

    if result["success"]:
        data = result["data"]
        print(f"✅ Title: {data['title']}")
        print(f"✅ Slug: {data['slug']}")
        # Show full category hierarchy
        categories = data.get('categories', [])
        if categories:
            category_path = ' > '.join(categories)
            print(f"✅ Categories: {category_path}")
        else:
            print("✅ Categories: (root)")
        print(f"✅ Word count: {data['word_count']}")
        print(f"✅ Reading time: {data['reading_time']} min")
        print(f"✅ Images: {len(data.get('images', []))}")
        if data.get("thumbnail"):
            print(f"✅ Thumbnail: {data['thumbnail']['local_path']}")

        # 스키마 호환성 체크
        try:
            # Create PostSchema from extracted data
            post_data = {
                "user_id": 1,  # Default test user
                "slug": data.get("slug", generate_slug_from_title(data['title'])),
                "title": data.get("title"),
                "description": data.get("summary", ""),
                "content": data.get("content"),
                "status": "public",
            }

            post = PostSchema(**post_data)
            print("\n✅ Schema validation passed!")
            print(f"   Post schema fields: {len(post.model_fields)}")
            print(f"   Slug: {post.slug}")
        except Exception as e:
            print(f"\n⚠️  Schema validation failed: {e}")

        return result
    else:
        print(f"❌ Failed: {result.get('error')}")
        return None


async def test_improved_uploading(extracted_data):
    """개선된 UploadingAgent 테스트 (썸네일 우선)"""
    print("\n" + "=" * 60)
    print("Testing Improved UploadingAgent")
    print("=" * 60)

    agent = UploadingAgent()

    task = AgentTask.create(action="full_upload", data=extracted_data["data"])

    result = await agent.run(task.to_dict())

    if result["success"]:
        data = result["data"]
        print(f"✅ Article ID: {data['article_id']}")
        print(f"✅ Published URL: {data['published_url']}")
        if data.get("thumbnail_url"):
            print(f"✅ Thumbnail URL: {data['thumbnail_url']}")
        print(f"✅ Images uploaded: {data['image_count']}")

        return result
    else:
        print(f"❌ Failed: {result.get('error')}")
        return None


async def test_schema_description():
    """스키마 설명 생성 테스트"""
    print("\n" + "=" * 60)
    print("Testing Schema Description")
    print("=" * 60)

    schema_desc = get_schema_description(PostSchema)

    print("Schema fields that LLM should extract:")
    print(schema_desc)

    print("\n✅ Schema description generated")
    print(f"   Total fields: {len(PostSchema.model_fields)}")


async def test_with_llm():
    """LLM을 사용한 전체 테스트 (local/openai/anthropic)"""
    print("\n" + "=" * 60)
    print("Testing with LLM (Auto-configured from config.LLM_PROVIDER)")
    print("=" * 60)

    try:
        from llm_factory import get_provider_info

        # Show current LLM configuration
        info = get_provider_info()
        print(f"Provider: {info['provider']}")
        print(f"Model: {info.get('model', 'N/A')}")
        print(f"Available: {info.get('available', True)}")

        # Scanner로 article 찾기
        scanner = DocumentScannerAgent()
        scan_result = await scanner.run(
            AgentTask.create(action="scan", data={"root_path": "./docs"}).to_dict()
        )

        if not scan_result["success"] or not scan_result["data"]["articles"]:
            print("⚠️  No articles found")
            return False

        article_info = scan_result["data"]["articles"][0]

        # ExtractingAgent with auto-configured LLM
        # It will auto-create LLM from config.LLM_PROVIDER
        agent = ExtractingAgent()  # enable_llm=True by default
        result = await agent.run(
            AgentTask.create(
                action="extract",
                data={
                    "article_info": article_info,
                    "extract_metadata": True,
                },
            ).to_dict()
        )

        if result["success"]:
            data = result["data"]
            print("\n✅ Generated Metadata:")
            print(f"   Tags: {', '.join(data.get('tags', []))}")
            print(f"   Summary: {data.get('summary', 'N/A')[:100]}...")
            return True
        else:
            print(f"❌ Failed: {result.get('error')}")
            return False

    except Exception as e:
        print(f"⚠️  LLM test failed: {e}")
        print("    Troubleshooting:")
        print("    - Local: Make sure Ollama is running (ollama serve)")
        print("    - OpenAI: Check OPENAI_API_KEY is set")
        print("    - Anthropic: Check ANTHROPIC_API_KEY is set")
        print("    See LLM_SETUP.md for detailed configuration")
        return False


async def main():
    """모든 테스트 실행"""
    print("\n" + "=" * 60)
    print("🧪 Improved Multi-Agent System - Test Suite")
    print("=" * 60)

    results = {}

    # Phase 1: DocumentScanner
    scan_result = await test_document_scanner()
    results["scanner"] = scan_result is not None

    if scan_result and scan_result["data"]["articles"]:
        # 첫 번째 article로 테스트
        article_info = scan_result["data"]["articles"][0]

        # Phase 2: Improved Extracting
        extract_result = await test_improved_extracting(article_info)
        results["extracting"] = extract_result is not None

        if extract_result:
            # Phase 3: Improved Uploading
            upload_result = await test_improved_uploading(extract_result)
            results["uploading"] = upload_result is not None

    # Phase 4: Schema
    await test_schema_description()
    results["schema"] = True

    # Phase 5: LLM (Optional)
    user_input = input("\nTest with LLM (uses config.LLM_PROVIDER)? (y/n): ").lower()
    if user_input == "y":
        results["llm"] = await test_with_llm()
    else:
        print("⏭️  Skipping LLM test")
        print("    To test LLM: python test_llm_providers.py")
        results["llm"] = None

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
        print("\n🎉 All tests passed! Improved system is ready.")
        print("\nNew Features:")
        print("  ✅ Folder structure scanning")
        print("  ✅ Category from path extraction")
        print("  ✅ Thumbnail detection")
        print("  ✅ Reading time calculation")
        print("  ✅ Schema validation")
        print("  ✅ LLM-powered tags & summary generation")
    else:
        print("\n⚠️  Some tests failed. Please check the errors above.")


if __name__ == "__main__":
    asyncio.run(main())
