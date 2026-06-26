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

        # Supported image extensions
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

            # Scan folder structure
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

        # Find all .md files
        for md_file in root.rglob("*.md"):
            article_info = self._extract_article_info(md_file, root)

            if article_info:
                articles.append(article_info)

                # Build category tree
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

        # Rule validation: folder name == file name
        if article_folder.name != article_name:
            # This file is not an article (e.g., README.md)
            return None

        # Calculate relative path
        try:
            relative_path = article_folder.relative_to(root)
        except ValueError:
            # File outside root
            return None

        path_parts = list(relative_path.parts)

        # Extract categories - Full hierarchy from folder path
        # Example: docs/technology/ai/langchain-guide/ -> ['technology', 'ai']
        # (excludes article folder name itself which is path_parts[-1])
        if len(path_parts) > 1:
            # Multiple levels: extract all except the article folder
            categories = path_parts[:-1]  # Remove article folder name
        elif len(path_parts) == 1:
            # Single level: article at root, no category
            categories = []
        else:
            categories = []

        # Backward compatibility: maintain category and subcategory
        category = categories[0] if len(categories) > 0 else None
        subcategory = categories[1] if len(categories) > 1 else None

        # Find thumbnail (image with same name as article_name)
        thumbnail = self._find_thumbnail(article_folder, article_name)

        # Find body images (excluding thumbnail)
        images = self._find_content_images(article_folder, article_name)

        category_path = '/'.join(categories) if categories else 'root'
        self._log(f"  Found: {article_name} (categories: {category_path})")
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
            "categories": categories,  # Full category hierarchy as list
            "category": category,      # First level (backward compat)
            "subcategory": subcategory,  # Second level (backward compat)
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
            # Check if image file
            if file.suffix.lower() not in self.image_extensions:
                continue

            # Exclude thumbnail
            if file.stem == article_name:
                continue

            images.append(str(file))

        return sorted(images)  # 알파벳 순 정렬

    def find_file_by_name(
        self, filename: str, search_dirs: List[Path] = None
    ) -> List[Dict[str, Any]]:
        """
        Find files matching the given filename across directories.

        Args:
            filename: Filename or partial path to search for (e.g., "sample-post.md", "sample-post")
            search_dirs: List of directories to search (defaults to common locations)

        Returns:
            List of matching files with metadata:
            [{"path": "/full/path/to/file.md", "name": "file.md", "match_type": "exact|partial"}]
        """
        from config import POSTS_DIR, PROJECT_ROOT

        # Default search directories
        if search_dirs is None:
            search_dirs = [
                POSTS_DIR,
                PROJECT_ROOT / "docs",
            ]

        # Normalize the search filename
        search_name = Path(filename).name  # Get just the filename part
        search_stem = Path(filename).stem  # Filename without extension

        matches = []
        seen_paths = set()

        for search_dir in search_dirs:
            if not search_dir.exists():
                continue

            # Search for .md files recursively
            for md_file in search_dir.rglob("*.md"):
                file_path_str = str(md_file)

                # Skip duplicates
                if file_path_str in seen_paths:
                    continue

                # Exact match (filename with extension)
                if md_file.name == search_name:
                    matches.append({
                        "path": file_path_str,
                        "name": md_file.name,
                        "match_type": "exact",
                    })
                    seen_paths.add(file_path_str)
                # Partial match (stem matches - without extension)
                elif md_file.stem == search_stem:
                    matches.append({
                        "path": file_path_str,
                        "name": md_file.name,
                        "match_type": "exact_stem",
                    })
                    seen_paths.add(file_path_str)
                # Fuzzy match (contains the search term)
                elif search_stem.lower() in md_file.stem.lower():
                    matches.append({
                        "path": file_path_str,
                        "name": md_file.name,
                        "match_type": "partial",
                    })
                    seen_paths.add(file_path_str)

        # Sort: exact matches first, then exact_stem, then partial
        priority = {"exact": 0, "exact_stem": 1, "partial": 2}
        matches.sort(key=lambda x: priority.get(x["match_type"], 99))

        self._log(f"Found {len(matches)} matches for '{filename}'")
        return matches

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
