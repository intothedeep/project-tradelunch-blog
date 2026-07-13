# agents/03_extracting_agent.py
"""
03. ExtractingAgent - 마크다운 파싱 및 메타데이터 추출 에이전트

마크다운 파일을 파싱하고 필요한 메타데이터를 추출합니다.
schema/posts.schema.sql 스키마와 호환되는 데이터를 생성합니다.

역할:
- 마크다운 파싱 (frontmatter + content)        → extracting_parse.py
- 이미지 경로 추출 및 썸네일 감지              → extracting_parse.py
- slug 생성 (PostSchema 호환)
- 단어 수 / 읽기 시간 계산
- LLM을 통한 태그 생성 (5-7개)               → extracting_prompts.py
- LLM을 통한 3문장 요약 생성                  → extracting_prompts.py
- PostSchema 검증

This file is the orchestration entry-point only. Business logic lives in:
- agents/extracting_parse.py    (parsing, image detection, text helpers)
- agents/extracting_prompts.py  (LLM prompt building + response parsing)
"""

import re
from typing import Any

from schema import calculate_reading_time, generate_slug_from_title

from .base import BaseAgent
from .extracting_parse import (
    detect_article_assets,
    excerpt_from_content,
    extract_categories_from_path,
    extract_images,
    map_status,  # re-exported for backward compat (tests may call via agent)
    parse_markdown,
)
from .extracting_prompts import generate_metadata_with_llm, generate_og_alt

# Re-export helpers that external callers may reference through this module.
__all__ = ["ExtractingAgent"]


class ExtractingAgent(BaseAgent):
    """
    마크다운 파일 파싱 및 메타데이터 추출 에이전트

    작업:
    1. 마크다운 파일 읽기 및 frontmatter 파싱
    2. 본문에서 이미지 경로 추출
    3. 기본 메타데이터 생성 (slug, word count 등)
    4. LLM으로 tags와 description 생성 (항상 사용)
    """

    def __init__(self, llm=None, enable_llm: bool = True):
        """
        Initialize ExtractingAgent.

        Args:
            llm: Pre-configured LLM instance (optional). If None and
                 enable_llm=True, will auto-create from llm_factory based
                 on config.LLM_PROVIDER.
            enable_llm: Enable LLM for tags/description generation. Default: True
        """
        super().__init__(
            name="ExtractingAgent",
            description="Markdown parsing and metadata extraction",
        )
        self.enable_llm = enable_llm
        self.llm = llm  # Will be set in execute() if None and enable_llm=True

    async def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        """
        작업 실행

        Expected task data:
            - file_path: 마크다운 파일 경로 (또는)
            - article_info: DocumentScanner의 결과
            - extract_metadata: bool (deprecated - now always True if enable_llm)
            - db_schema: PostSchema (필드 검증용)

        Note:
            When enable_llm=True, tags/description are LLM-generated (frontmatter
            as hints). When enable_llm=False, they come straight from frontmatter
            with a deterministic content-excerpt fallback for an empty description.
        """
        # Lazy-initialize LLM on first execute call.
        if self.enable_llm and self.llm is None:
            try:
                from llm_factory import create_llm
                self.llm = create_llm()
                self._log(f"LLM initialized: {self.llm.__class__.__name__}")
            except Exception as e:
                self._log(
                    f"Failed to initialize LLM: {e}. Continuing without LLM.",
                    "warning",
                )
                self.enable_llm = False

        # Resolve source: DocumentScanner result or direct file path.
        article_info = task["data"].get("article_info")
        if article_info:
            file_path = article_info.get("md_file")
            categories = article_info.get("categories", [])
            category = article_info.get("category")
            subcategory = article_info.get("subcategory")
            thumbnail = article_info.get("thumbnail")
            predefined_images = article_info.get("images", [])
        else:
            file_path = task["data"].get("file_path")
            categories = extract_categories_from_path(file_path)
            category = categories[0] if len(categories) > 0 else None
            subcategory = categories[1] if len(categories) > 1 else None
            thumbnail, predefined_images = detect_article_assets(file_path)

        if not file_path:
            return {"success": False, "error": "No file_path or article_info provided"}

        import os
        if not os.path.exists(file_path):
            return {"success": False, "error": f"File not found: {file_path}"}

        try:
            # 1. Parse file.
            self._log(f"Parsing file: {file_path}")
            parsed_data = parse_markdown(file_path)

            # 2. Attach category info.
            if categories:
                parsed_data["categories"] = categories
                self._log(f"Categories: {'/'.join(categories)}")
            if category:
                parsed_data["category"] = category
                parsed_data["subcategory"] = subcategory

            # 3. Process images.
            if predefined_images:
                parsed_data["images"] = [
                    {"alt": "", "local_path": img, "s3_url": None}
                    for img in predefined_images
                ]
            else:
                self._log("Extracting images from content...")
                base_dir = os.path.dirname(file_path)
                images, detected_thumbnail = extract_images(
                    parsed_data["content"], base_dir
                )
                parsed_data["images"] = images
                if not thumbnail and detected_thumbnail:
                    thumbnail = detected_thumbnail

            # Apply resolved thumbnail (wins over content-detected fallback).
            if thumbnail:
                if isinstance(thumbnail, dict):
                    parsed_data["thumbnail"] = thumbnail
                else:
                    parsed_data["thumbnail"] = {
                        "alt": f"{parsed_data['title']} thumbnail",
                        "local_path": thumbnail,
                        "s3_url": None,
                    }

            self._log(f"Found {len(parsed_data.get('images', []))} image(s)")
            if parsed_data.get("thumbnail"):
                self._log(
                    f"Detected thumbnail: {parsed_data['thumbnail']['local_path']}"
                )

            # 4. Basic metadata.
            article_name = article_info.get("article_name") if article_info else None
            parsed_data["slug"] = generate_slug_from_title(
                article_name or parsed_data["title"]
            )
            parsed_data["word_count"] = len(parsed_data["content"].split())
            parsed_data["reading_time"] = calculate_reading_time(
                parsed_data["word_count"]
            )
            self._log(
                f"Word count: {parsed_data['word_count']}, "
                f"Reading time: {parsed_data['reading_time']} min"
            )

            # 5. Tags + description (LLM optional).
            raw_fm_tags = parsed_data.get("tags", [])
            if isinstance(raw_fm_tags, str):
                fm_tags = [t.strip() for t in raw_fm_tags.split(",") if t.strip()]
            else:
                fm_tags = list(raw_fm_tags) if raw_fm_tags else []

            fm_desc = (parsed_data.get("description") or "").strip()
            has_fm_desc = bool(fm_desc)
            if not fm_desc:
                fm_desc = excerpt_from_content(parsed_data["content"])

            if self.enable_llm and self.llm:
                self._log("Generating tags with LLM...")
                metadata = await generate_metadata_with_llm(
                    self.llm,
                    parsed_data["title"],
                    parsed_data["content"],
                    categories,
                    existing_tags=fm_tags,
                    existing_desc=fm_desc,
                )
                llm_tags = metadata.get("tags", [])
                llm_summary = (metadata.get("summary") or "").strip()
                tags = llm_tags or fm_tags
                if has_fm_desc:
                    summary = fm_desc
                elif not llm_summary or llm_summary == "No summary available.":
                    summary = fm_desc
                else:
                    summary = llm_summary
                self._log(f"✓ Generated {len(tags)} tags (desc from frontmatter)")
            else:
                self._log("LLM disabled: using frontmatter tags/description", "warning")
                tags = fm_tags
                summary = fm_desc

            # Normalize tags to lowercase kebab-case, dedupe preserving order.
            norm_tags: list[str] = []
            for tag in tags:
                slug_tag = re.sub(r"[\s_]+", "-", str(tag).strip().lower())
                slug_tag = re.sub(r"[^a-z0-9-]", "", slug_tag)
                slug_tag = re.sub(r"-+", "-", slug_tag).strip("-")
                if slug_tag and slug_tag not in norm_tags:
                    norm_tags.append(slug_tag)

            parsed_data["tags"] = norm_tags
            parsed_data["description"] = summary
            parsed_data["summary"] = summary

            return {"success": True, "data": parsed_data, "agent": self.name}

        except Exception as e:
            return {"success": False, "error": str(e), "agent": self.name}

    # ------------------------------------------------------------------
    # Thin delegation wrappers kept for backward compatibility with tests
    # that call these methods directly on the agent instance.
    # ------------------------------------------------------------------

    def _parse_markdown(self, file_path: str) -> dict[str, Any]:
        return parse_markdown(file_path)

    def _map_status(self, status_value: Any) -> str:
        return map_status(status_value)

    def _excerpt_from_content(self, content: str, max_len: int = 160) -> str:
        return excerpt_from_content(content, max_len)

    def _extract_categories_from_path(self, file_path: str) -> list[str]:
        return extract_categories_from_path(file_path)

    def _detect_article_assets(self, file_path: str) -> tuple:
        return detect_article_assets(file_path)

    def _extract_images(
        self, content: str, base_dir: str | None = None
    ) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
        return extract_images(content, base_dir)

    async def _generate_metadata_with_llm(
        self,
        title: str,
        content: str,
        categories: list[str] | None = None,
        existing_tags: list[str] | None = None,
        existing_desc: str | None = None,
    ) -> dict[str, Any]:
        return await generate_metadata_with_llm(
            self.llm, title, content, categories, existing_tags, existing_desc
        )

    async def _generate_og_alt(self, title: str, content: str = "") -> str:
        return await generate_og_alt(self.llm, title, content)
