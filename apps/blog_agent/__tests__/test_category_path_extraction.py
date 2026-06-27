"""Regression tests for category-hierarchy extraction from a post path.

Purpose:
    Guard the path-resolution bug where a RELATIVE markdown path
    (e.g. ``./posts/...``) failed ``Path.relative_to(POSTS_DIR)`` because
    ``POSTS_DIR`` is absolute, silently yielding ``[]`` categories.

Constraints:
    - No database required; ``_extract_categories_from_path`` is pure path logic.
"""

import os
import sys
import unittest
from pathlib import Path

project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

from agents.extracting_agent import ExtractingAgent  # noqa: E402

_REL_PATH = "./posts/java/spring/jdbc/java-spring-jdbc/java-spring-jdbc.md"
_EXPECTED = ["java", "spring", "jdbc"]


class TestCategoryPathExtraction(unittest.TestCase):
    """Unit tests for ExtractingAgent._extract_categories_from_path."""

    def setUp(self) -> None:
        self.agent = ExtractingAgent(enable_llm=False)

    def test_relative_path_returns_full_hierarchy(self) -> None:
        """A relative ./posts path must resolve to the deep category chain."""
        result = self.agent._extract_categories_from_path(_REL_PATH)
        self.assertEqual(result, _EXPECTED)

    def test_absolute_path_returns_full_hierarchy(self) -> None:
        """An absolute path to the same file yields the same hierarchy."""
        abs_path = os.path.abspath(_REL_PATH)
        result = self.agent._extract_categories_from_path(abs_path)
        self.assertEqual(result, _EXPECTED)

    def test_path_outside_posts_returns_empty(self) -> None:
        """A path not under POSTS_DIR (or docs/) yields no categories."""
        result = self.agent._extract_categories_from_path("/tmp/foo/bar/bar.md")
        self.assertEqual(result, [])


if __name__ == "__main__":
    unittest.main()
