"""One-shot non-interactive blog post publisher.

Purpose:
    Publish a single markdown post to Supabase end-to-end from the command
    line, with no interactive prompts. Reusable for ANY post path passed as a
    CLI argument. Mirrors the interactive CLI path for an already-existing file:
    `upload <path>` -> path exists -> execute_task() -> ProjectManager.run().
    Because the path exists, no confirmation prompt (and thus no TTY) is needed.

Invariants:
    - Exactly one markdown file is published per invocation.
    - The post path must exist; otherwise the script exits 2 without side effects.
    - Exit code maps to outcome: 0 = published, 1 = publish failure, 2 = bad args.

Side-effects:
    - Writes to the PRODUCTION Supabase database (post row insert).
    - Writes to Supabase Storage (image/thumbnail object upload).

Usage:
    uv run python scripts/publish_oneshot.py [--no-llm] ./posts/<cat>/<slug>/<slug>.md
"""

import argparse
import asyncio
import sys
from pathlib import Path

# add blog_agent root (parent of scripts/) to sys.path so `cli_multi_agent` imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cli_multi_agent import MultiAgentCLI


async def publish(md_path: str, enable_llm: bool) -> tuple[bool, object]:
    """Publish one markdown post non-interactively.

    Args:
        md_path: Path to the markdown file to publish.
        enable_llm: When False, take the offline frontmatter-only metadata path
            (no LLM network calls). When True, use the LLM-backed path.

    Returns:
        Tuple of (success, result) where result is the raw last-history result.
    """
    cli = MultiAgentCLI(enable_llm=enable_llm)
    await cli.initialize()
    await cli.execute_task(f"upload {md_path}", md_path)
    last = cli.history[-1] if cli.history else {}
    return bool(last.get("success")), last.get("result")


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments.

    Returns:
        Parsed namespace with the `post` positional argument and `no_llm` flag.
    """
    parser = argparse.ArgumentParser(
        description="Publish a single markdown post to Supabase (non-interactive)."
    )
    parser.add_argument("post", help="Path to the markdown (.md) post file.")
    parser.add_argument(
        "--no-llm",
        action="store_true",
        help="Disable the LLM path; derive tags/description from frontmatter only.",
    )
    return parser.parse_args()


def main() -> int:
    """Entry point: validate, publish, and map outcome to an exit code.

    Returns:
        Process exit code (0 success, 1 publish failure, 2 bad args).
    """
    args = parse_args()
    post_path = Path(args.post)
    if not post_path.is_file():
        print(f"PUBLISH FAIL: file not found: {args.post}")
        return 2

    enable_llm = not args.no_llm
    success, result = asyncio.run(publish(str(post_path), enable_llm))
    if success:
        print("PUBLISH PASS")
        return 0

    print(f"PUBLISH FAIL: {result}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
