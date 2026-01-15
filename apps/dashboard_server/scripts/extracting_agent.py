# agents/03_extracting_agent.py
"""
03. ExtractingAgent - 마크다운 파싱 및 메타데이터 추출 에이전트

마크다운 파일을 파싱하고 필요한 메타데이터를 추출합니다.

역할:
- 마크다운 파싱 (frontmatter + content)
- 이미지 경로 추출
- slug 생성
- 단어 수 계산
- 읽기 시간 계산
- LLM을 통한 태그 생성 (5-7개)
- LLM을 통한 3문장 요약 생성
"""

import re
import os
from typing import Dict, Any, List
from pathlib import Path
import frontmatter
from .base import BaseAgent
from schema import calculate_reading_time


class ExtractingAgent(BaseAgent):
    """
    마크다운 파일 파싱 및 메타데이터 추출 에이전트

    작업:
    1. 마크다운 파일 읽기 및 frontmatter 파싱
    2. 본문에서 이미지 경로 추출
    3. 기본 메타데이터 생성 (slug, word count 등)
    """

    def __init__(self, llm=None):
        super().__init__(
            name="ExtractingAgent",
            description="Markdown parsing and metadata extraction",
        )
        self.llm = llm  # Qwen3 for category/tag generation

    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        작업 실행

        Expected task data:
            - file_path: 마크다운 파일 경로 (또는)
            - article_info: DocumentScanner의 결과
            - extract_metadata: bool (LLM으로 태그/요약 생성 여부)
            - db_schema: PostSchema (필드 검증용)
        """
        action = task.get("action")

        # DocumentScanner 결과 사용 또는 직접 파일 경로
        article_info = task["data"].get("article_info")
        if article_info:
            file_path = article_info.get("md_file")
            category = article_info.get("category")
            subcategory = article_info.get("subcategory")
            thumbnail = article_info.get("thumbnail")
            predefined_images = article_info.get("images", [])
        else:
            file_path = task["data"].get("file_path")
            category = None
            subcategory = None
            thumbnail = None
            predefined_images = []

        if not file_path:
            return {"success": False, "error": "No file_path or article_info provided"}

        if not os.path.exists(file_path):
            return {"success": False, "error": f"File not found: {file_path}"}

        try:
            # 1. 파일 읽기 및 파싱
            self._log(f"Parsing file: {file_path}")
            parsed_data = self._parse_markdown(file_path)

            # 2. 카테고리 정보 추가 (DocumentScanner에서 온 경우)
            if category:
                parsed_data["category"] = category
                parsed_data["subcategory"] = subcategory
                self._log(f"Category: {category}/{subcategory or 'root'}")

            # 3. 이미지 처리
            if predefined_images:
                # DocumentScanner에서 발견한 이미지 사용
                parsed_data["images"] = [
                    {"alt": "", "local_path": img, "s3_url": None}
                    for img in predefined_images
                ]
                if thumbnail:
                    parsed_data["thumbnail"] = {
                        "alt": f"{parsed_data['title']} thumbnail",
                        "local_path": thumbnail,
                        "s3_url": None,
                    }
            else:
                # 마크다운 본문에서 이미지 추출
                self._log(f"Extracting images from content...")
                images = self._extract_images(parsed_data["content"])
                parsed_data["images"] = images

            self._log(f"Found {len(parsed_data.get('images', []))} image(s)")

            # 4. 기본 메타데이터 생성
            # Prefer article_name (filename-based) for slug, fall back to title
            article_name = article_info.get("article_name") if article_info else None
            parsed_data["slug"] = self._generate_slug(article_name or parsed_data["title"])
            parsed_data["word_count"] = len(parsed_data["content"].split())

            # 읽기 시간 계산 (250 wpm 기준)
            parsed_data["reading_time"] = calculate_reading_time(
                parsed_data["word_count"]
            )

            self._log(
                f"Word count: {parsed_data['word_count']}, Reading time: {parsed_data['reading_time']} min"
            )

            # 5. LLM으로 태그/요약 생성 (옵션)
            if task["data"].get("extract_metadata", False) and self.llm:
                self._log("Generating tags and summary with LLM...")
                metadata = await self._generate_metadata_with_llm(
                    parsed_data["title"], parsed_data["content"], category, subcategory
                )
                parsed_data.update(metadata)

            return {"success": True, "data": parsed_data, "agent": self.name}

        except Exception as e:
            return {"success": False, "error": str(e), "agent": self.name}

    def _parse_markdown(self, file_path: str) -> Dict[str, Any]:
        """마크다운 파일 파싱 (룰 기반)"""
        with open(file_path, "r", encoding="utf-8") as f:
            post = frontmatter.load(f)

        # frontmatter에서 메타데이터 추출
        metadata = post.metadata

        return {
            "file_path": file_path,
            "title": metadata.get(
                "title", self._extract_title_from_content(post.content)
            ),
            "desc": metadata.get("desc", ""),
            "status": metadata.get("status", "draft"),
            "author": metadata.get("author", "Unknown"),
            "date": metadata.get("date", ""),
            "tags": metadata.get("tags", []),
            "category": metadata.get("category", ""),
            "content": post.content,
            "raw_frontmatter": metadata,
        }

    def _extract_title_from_content(self, content: str) -> str:
        """본문에서 제목 추출 (frontmatter에 없을 경우)"""
        # 첫 번째 # 헤더 찾기
        match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        if match:
            return match.group(1).strip()
        return "Untitled"

    def _extract_images(self, content: str) -> List[Dict[str, str]]:
        """본문에서 이미지 경로 추출"""
        # ![alt](path) 형식의 이미지 찾기
        pattern = r"!\[([^\]]*)\]\(([^\)]+)\)"
        matches = re.findall(pattern, content)

        images = []
        for alt, path in matches:
            images.append(
                {
                    "alt": alt,
                    "local_path": path,
                    "s3_url": None,  # 나중에 UploadingAgent가 채움
                }
            )

        return images

    def _generate_slug(self, title: str) -> str:
        """제목에서 URL-friendly slug 생성"""
        # 소문자 변환
        slug = title.lower()

        # 특수문자 제거 및 공백을 하이픈으로
        slug = re.sub(r"[^\w\s-]", "", slug)
        slug = re.sub(r"[-\s]+", "-", slug)

        # 앞뒤 하이픈 제거
        slug = slug.strip("-")

        return slug

    async def _generate_metadata_with_llm(
        self, title: str, content: str, category: str = None, subcategory: str = None
    ) -> Dict[str, Any]:
        """
        LLM(Qwen3)을 사용하여 메타데이터 생성

        생성하는 필드:
        - tags: 5-7개의 관련 키워드
        - summary: 정확히 3문장으로 된 요약 (카드 표시용)
        """
        if not self.llm:
            return {"tags": [], "summary": "No summary available."}

        # 본문 일부만 사용 (토큰 절약)
        content_preview = content[:1500]

        # 카테고리 정보 추가
        category_info = ""
        if category:
            category_info = f"\nCategory: {category}"
            if subcategory:
                category_info += f" > {subcategory}"

        prompt = f"""You are analyzing a blog article to extract metadata for a card display and search indexing.

ARTICLE INFO:
Title: {title}{category_info}

Content preview:
{content_preview}

EXTRACT THE FOLLOWING:

1. **Tags** (5-7 keywords):
   - Choose relevant keywords for search and categorization
   - Include technical terms, topics, and concepts
   - Comma-separated list

2. **Summary** (EXACTLY 3 sentences):
   - First sentence: What is this article about?
   - Second sentence: What will readers learn?
   - Third sentence: Key takeaway or benefit
   - Keep each sentence concise (max 100 characters)
   - This will be displayed on article cards

Respond in this EXACT format:
TAGS: tag1, tag2, tag3, tag4, tag5
SUMMARY: First sentence here. Second sentence here. Third sentence here.
"""

        try:
            # LLM 호출
            response = self.llm.invoke(prompt)
            result_text = response.content

            # 파싱
            tags_match = re.search(r"TAGS:\s*(.+)", result_text, re.IGNORECASE)
            summary_match = re.search(
                r"SUMMARY:\s*(.+)", result_text, re.IGNORECASE | re.DOTALL
            )

            # Tags 추출
            tags = []
            if tags_match:
                tags_str = tags_match.group(1).strip()
                tags = [tag.strip() for tag in tags_str.split(",") if tag.strip()]
                # 5-7개로 제한
                tags = tags[:7] if len(tags) > 7 else tags

            # Summary 추출
            summary = "No summary available."
            if summary_match:
                summary_text = summary_match.group(1).strip()
                # 여러 줄일 수 있으므로 정리
                summary = " ".join(summary_text.split())

                # 정확히 3문장인지 확인 (간단한 체크)
                sentences = [s.strip() for s in summary.split(".") if s.strip()]
                if len(sentences) >= 3:
                    summary = ". ".join(sentences[:3]) + "."

            self._log(f"Generated {len(tags)} tags", "success")
            self._log(f"Generated summary: {len(summary)} chars", "success")

            return {"tags": tags, "summary": summary}

        except Exception as e:
            self._log(f"LLM metadata generation failed: {e}", "warning")
            return {"tags": [], "summary": "No summary available."}
