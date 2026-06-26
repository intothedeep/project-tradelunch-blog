# agents/02_document_scanner_agent.py
"""
02. DocumentScannerAgent - 폴더 구조 스캔 에이전트

문서 폴더 구조를 스캔하여 article 정보를 수집합니다.

역할:
- 폴더 구조 분석 (category/subcategory/article)
- article 폴더 감지
- 썸네일 자동 식별
- 본문 이미지 수집
- 카테고리 트리 생성
"""

from typing import Dict, Any, List
from pathlib import Path
from .base import BaseAgent


class DocumentScannerAgent(BaseAgent):
    """
    문서 폴더 구조를 스캔하여 article 정보를 수집하는 에이전트

    폴더 구조 규칙:
    - category/subcategory/article-name/ 형태
    - article-name/ 폴더 내에 article-name.md 파일 존재
    - article-name과 같은 이름의 이미지 = 썸네일
    - 나머지 이미지 = 본문 이미지

    예시:
    docs/
      technology/
        ai/
          langchain-guide/
            langchain-guide.md       ← article
            langchain-guide.png      ← thumbnail
            diagram1.jpeg            ← content image
            code-example.png         ← content image
    """

    def __init__(self):
        super().__init__(
            name="DocumentScannerAgent",
            description="Scans documentation folder structure and extracts article metadata",
        )

        # 지원하는 이미지 확장자
        self.image_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}

    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        문서 폴더 스캔 실행

        Expected task data:
            - root_path: 스캔할 루트 디렉토리
            - scan_depth: 최대 스캔 깊이 (기본값: 무제한)
        """
        root_path = task["data"].get("root_path")
        scan_depth = task["data"].get("scan_depth", None)

        if not root_path:
            return {"success": False, "error": "No root_path provided"}

        root = Path(root_path)

        if not root.exists():
            return {"success": False, "error": f"Path does not exist: {root_path}"}

        if not root.is_dir():
            return {"success": False, "error": f"Path is not a directory: {root_path}"}

        try:
            self._log(f"Scanning documentation at: {root_path}")

            # 폴더 구조 스캔
            scan_result = self._scan_documentation(root, scan_depth)

            self._log(f"Found {scan_result['total_articles']} articles")
            self._log(f"Categories: {len(scan_result['category_tree'])}")

            return {"success": True, "data": scan_result, "agent": self.name}

        except Exception as e:
            self._log(f"Scan failed: {e}", "error")
            return {"success": False, "error": str(e), "agent": self.name}

    def _scan_documentation(self, root: Path, max_depth: int = None) -> Dict[str, Any]:
        """
        재귀적으로 폴더를 스캔하여 article 정보 수집

        Args:
            root: 스캔할 루트 디렉토리
            max_depth: 최대 깊이 (None = 무제한)

        Returns:
            {
                "articles": [...],
                "category_tree": {...},
                "total_articles": int,
                "total_categories": int
            }
        """
        articles = []
        category_tree = {}

        # 모든 .md 파일 찾기
        for md_file in root.rglob("*.md"):
            article_info = self._extract_article_info(md_file, root)

            if article_info:
                articles.append(article_info)

                # category tree 구성
                self._add_to_category_tree(category_tree, article_info)

        return {
            "articles": articles,
            "category_tree": category_tree,
            "total_articles": len(articles),
            "total_categories": len(category_tree),
        }

    def _extract_article_info(self, md_file: Path, root: Path) -> Dict[str, Any]:
        """
        마크다운 파일에서 article 정보 추출

        규칙:
        - article 폴더명과 .md 파일명이 동일해야 함
        - 예: langchain-guide/langchain-guide.md

        Returns:
            article 정보 딕셔너리 또는 None (규칙에 맞지 않으면)
        """
        article_folder = md_file.parent
        article_name = md_file.stem

        # 규칙 검증: 폴더명 == 파일명
        if article_folder.name != article_name:
            # 이 파일은 article이 아님 (예: README.md)
            return None

        # 상대 경로 계산
        try:
            relative_path = article_folder.relative_to(root)
        except ValueError:
            # root 밖의 파일
            return None

        path_parts = list(relative_path.parts)

        # 카테고리 추출
        category = path_parts[0] if len(path_parts) > 0 else "uncategorized"
        subcategory = path_parts[1] if len(path_parts) > 1 else None

        # 썸네일 찾기 (article_name과 같은 이름의 이미지)
        thumbnail = self._find_thumbnail(article_folder, article_name)

        # 본문 이미지 찾기 (썸네일 제외)
        images = self._find_content_images(article_folder, article_name)

        self._log(f"  Found: {article_name} ({category}/{subcategory or 'root'})")
        if thumbnail:
            self._log(f"    ✓ Thumbnail: {Path(thumbnail).name}")
        if images:
            self._log(f"    ✓ Images: {len(images)}")

        return {
            "article_name": article_name,
            "article_path": str(relative_path),
            "md_file": str(md_file),
            "thumbnail": thumbnail,
            "images": images,
            "category": category,
            "subcategory": subcategory,
            "folder": str(article_folder),
        }

    def _find_thumbnail(self, article_folder: Path, article_name: str) -> str:
        """
        썸네일 이미지 찾기

        Args:
            article_folder: article 폴더
            article_name: article 이름

        Returns:
            썸네일 경로 또는 None
        """
        for ext in self.image_extensions:
            thumb_path = article_folder / f"{article_name}{ext}"
            if thumb_path.exists():
                return str(thumb_path)

        return None

    def _find_content_images(
        self, article_folder: Path, article_name: str
    ) -> List[str]:
        """
        본문 이미지 찾기 (썸네일 제외)

        Args:
            article_folder: article 폴더
            article_name: article 이름 (썸네일 제외용)

        Returns:
            이미지 경로 리스트
        """
        images = []

        for file in article_folder.iterdir():
            # 이미지 파일인지 확인
            if file.suffix.lower() not in self.image_extensions:
                continue

            # 썸네일은 제외
            if file.stem == article_name:
                continue

            images.append(str(file))

        return sorted(images)  # 알파벳 순 정렬

    def _add_to_category_tree(self, tree: Dict, article_info: Dict):
        """
        category tree에 article 추가

        Args:
            tree: category tree 딕셔너리
            article_info: article 정보

        Tree 구조:
        {
            "technology": {
                "ai": ["langchain-guide", "transformer-basics"],
                "web": ["react-hooks"],
                "_root": ["general-tech-article"]
            }
        }
        """
        category = article_info["category"]
        subcategory = article_info["subcategory"]
        article_name = article_info["article_name"]

        # category 초기화
        if category not in tree:
            tree[category] = {}

        # subcategory별 분류
        if subcategory:
            if subcategory not in tree[category]:
                tree[category][subcategory] = []
            tree[category][subcategory].append(article_name)
        else:
            # category 직속 article (subcategory 없음)
            if "_root" not in tree[category]:
                tree[category]["_root"] = []
            tree[category]["_root"].append(article_name)

    def get_category_summary(self, category_tree: Dict) -> str:
        """
        카테고리 트리를 보기 좋은 문자열로 변환

        Returns:
            포맷된 카테고리 요약
        """
        lines = []

        for category, subcats in sorted(category_tree.items()):
            lines.append(f"📁 {category}")

            for subcat, articles in sorted(subcats.items()):
                if subcat == "_root":
                    for article in articles:
                        lines.append(f"  └─ 📄 {article}")
                else:
                    lines.append(f"  ├─ 📂 {subcat}")
                    for article in articles:
                        lines.append(f"  │  └─ 📄 {article}")

        return "\n".join(lines)
