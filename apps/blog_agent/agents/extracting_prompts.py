"""
LLM prompt construction and response parsing for ExtractingAgent.

Responsibilities:
- Build prompts for metadata generation (tags + summary)
- Build prompts for OG alt-text generation
- Parse LLM text responses into structured dicts

All functions are pure or near-pure (the LLM call is the only side effect,
and it is isolated inside generate_metadata_with_llm / generate_og_alt).
"""

import re
from typing import Any


def build_metadata_prompt(
    title: str,
    content: str,
    categories: list[str] | None = None,
    existing_tags: list[str] | None = None,
    existing_desc: str | None = None,
) -> str:
    """
    Build the LLM prompt for tag + summary extraction.

    Args:
        title: Article title.
        content: Article content (full markdown). Only the first 1500 chars
                 are included in the prompt to save tokens.
        categories: Full category hierarchy, e.g. ['technology', 'ai'].
        existing_tags: Frontmatter tags to use as hints.
        existing_desc: Frontmatter description to use as a hint.

    Returns:
        Fully-formatted prompt string ready to pass to llm.invoke().
    """
    content_preview = content[:1500]

    category_info = ""
    if categories:
        category_path = " > ".join(categories)
        category_info = f"\nCategory Path: {category_path}"

    hints_section = ""
    if existing_tags or existing_desc:
        hints_section = "\n\nEXISTING HINTS (use as reference, refine if needed):"
        if existing_tags:
            hints_section += f"\nExisting tags: {', '.join(existing_tags)}"
        if existing_desc:
            hints_section += f"\nExisting description: {existing_desc}"

    return f"""You are analyzing a blog article to extract metadata for a card display and search indexing.

ARTICLE INFO:
Title: {title}{category_info}

Content preview:
{content_preview}{hints_section}

EXTRACT THE FOLLOWING:

1. **Tags** (5-7 keywords):
   - Choose relevant keywords for search and categorization
   - Include technical terms, topics, and concepts
   - If existing tags are provided, use them as reference and refine/expand
   - Comma-separated list

2. **Summary** (EXACTLY 3 sentences):
   - First sentence: What is this article about?
   - Second sentence: What will readers learn?
   - Third sentence: Key takeaway or benefit
   - Keep each sentence concise (max 100 characters)
   - If existing description is provided, use it as a base and refine
   - This will be displayed on article cards

Respond in this EXACT format:
TAGS: tag1, tag2, tag3, tag4, tag5
SUMMARY: First sentence here. Second sentence here. Third sentence here.
"""


def parse_metadata_response(result_text: str) -> dict[str, Any]:
    """
    Parse the LLM response for metadata into a structured dict.

    Args:
        result_text: Raw LLM output string.

    Returns:
        Dict with keys 'tags' (list[str], up to 7) and 'summary' (str).
        Returns empty/fallback values on parse failure.
    """
    tags_match = re.search(r"TAGS:\s*(.+)", result_text, re.IGNORECASE)
    summary_match = re.search(
        r"SUMMARY:\s*(.+)", result_text, re.IGNORECASE | re.DOTALL
    )

    tags: list[str] = []
    if tags_match:
        tags_str = tags_match.group(1).strip()
        tags = [tag.strip() for tag in tags_str.split(",") if tag.strip()]
        tags = tags[:7]

    summary = "No summary available."
    if summary_match:
        summary_text = summary_match.group(1).strip()
        summary = " ".join(summary_text.split())
        sentences = [s.strip() for s in summary.split(".") if s.strip()]
        if len(sentences) >= 3:
            summary = ". ".join(sentences[:3]) + "."

    return {"tags": tags, "summary": summary}


def build_og_alt_prompt(title: str) -> str:
    """
    Build the LLM prompt for OG image alt-text generation.

    Args:
        title: Article title.

    Returns:
        Prompt string.
    """
    return f"""Generate a brief, descriptive alt text for a blog post thumbnail image.
The alt text should be accessible and SEO-friendly.

Article Title: {title}

Requirements:
- Maximum 100 characters
- Describe what a reader would expect to see
- Include relevant keywords naturally
- Do not start with "Image of" or "Picture of"

Alt text:"""


def parse_og_alt_response(response_text: str, title: str, max_len: int = 125) -> str:
    """
    Parse and clean the OG alt-text LLM response.

    Args:
        response_text: Raw LLM output string.
        title: Article title (used as fallback).
        max_len: Maximum allowed length before truncation with '...'.

    Returns:
        Clean alt-text string.
    """
    alt_text = response_text.strip().strip("'\"")
    if len(alt_text) > max_len:
        alt_text = alt_text[:max_len - 3] + "..."
    return alt_text or f"{title} thumbnail"


async def generate_metadata_with_llm(
    llm: Any,
    title: str,
    content: str,
    categories: list[str] | None = None,
    existing_tags: list[str] | None = None,
    existing_desc: str | None = None,
) -> dict[str, Any]:
    """
    Call the LLM to generate tags and a 3-sentence summary.

    Args:
        llm: Pre-configured LLM instance with .invoke(prompt) -> response.
        title: Article title.
        content: Full markdown content.
        categories: Category hierarchy.
        existing_tags: Frontmatter tags as hints.
        existing_desc: Frontmatter description as a hint.

    Returns:
        Dict with 'tags' (list[str]) and 'summary' (str).
        Returns empty/fallback on any LLM error.
    """
    if not llm:
        return {"tags": [], "summary": "No summary available."}

    prompt = build_metadata_prompt(title, content, categories, existing_tags, existing_desc)
    try:
        response = llm.invoke(prompt)
        return parse_metadata_response(response.content)
    except Exception:
        return {"tags": [], "summary": "No summary available."}


async def generate_og_alt(llm: Any, title: str, content: str = "") -> str:
    """
    Generate SEO-friendly alt text for OG image using the LLM.

    Args:
        llm: Pre-configured LLM instance.
        title: Article title.
        content: Article content (unused in current prompt, reserved).

    Returns:
        Alt text string (max 125 chars). Falls back to '{title} thumbnail'.
    """
    if not llm:
        return f"{title} thumbnail"

    prompt = build_og_alt_prompt(title)
    try:
        response = llm.invoke(prompt)
        return parse_og_alt_response(response.content, title)
    except Exception:
        return f"{title} thumbnail"
