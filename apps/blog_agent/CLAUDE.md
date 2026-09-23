# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-agent system for automating blog post processing using LangGraph and Qwen3 8B (via Ollama).
The system parses markdown files, extracts metadata, generates tags/summaries via LLM, and writes
posts to Supabase Postgres with images on OCI Object Storage (S3-compatible).

## Commands

### Running the System

```bash
# Terminal 1: Start Ollama server (required for LLM-backed paths)
ollama serve

# Terminal 2: Run CLI
uv run python cli_multi_agent.py

# In practice, publishing goes through the one-shot script instead:
uv run python scripts/publish_oneshot.py [--no-llm] ./posts/<cat>/<slug>/<slug>.md
```

### Verification

Tests are SUSPENDED repo-wide (`.claude/rules/core.md`) — `__tests__/` and the
`[tool.pytest.ini_options]` block in `pyproject.toml` are deliberately unused,
not dead code. Verify changes by DELIBERATE BREAKAGE against the real system
(trigger the failure, observe it, clean up), not by writing or running tests.

### Quality Gates

```bash
pnpm --filter blog_agent lint          # uv run ruff check .
pnpm --filter blog_agent check-types   # uv run mypy agents configs db utils
```

Both are currently green. mypy is pinned to Python 3.12 to match the `.venv`
interpreter (older targets choke on 3.12 syntax in installed stub packages);
ruff stays pinned to py310 to match `requires-python = ">=3.10"` (a newer
target would demand py312-only idioms that break that declared floor). See
`pyproject.toml` for the exact settings — mypy runs with individual strict
flags, not `--strict`.

### Setup

```bash
uv sync
ollama pull qwen3:8b
```

Environment is `uv` + `.venv`, per `.claude/rules/development/python.md` §1 —
`pyproject.toml` is the single source of truth. `uv sync` installs the `dev`
dependency group (ruff, mypy, black, isort, pytest) by default; no extra flag
needed. The old `tradelunch-agents-venv` virtualenv no longer exists.

## Architecture

```
ProjectManager (LangGraph orchestrator + Qwen3 LLM)
        │
        ├── ExtractingAgent     - Markdown parsing, frontmatter extraction, LLM-generated tags/summary
        ├── UploadingAgent      - Object-storage image upload, Postgres save (or simulated)
        ├── LoggingAgent        - Rich terminal UI, progress indicators
        └── DocumentScannerAgent - Folder structure scanning, category detection
```

### Key Files

- `config.py` - All configuration (LLM, AWS, database, paths). Supports env var overrides.
- `schema.py` - Pydantic ArticleSchema for blog posts
- `agents/base.py` - Abstract BaseAgent class that all agents inherit from
- `agents/protocol.py` - Inter-agent communication (AgentMessage, AgentTask, AgentResponse)
- `agents/project_manager.py` - LangGraph workflow: `analyze_command → extract → upload → finalize`

### Data Flow

1. CLI captures command → ProjectManager analyzes with LLM
2. ExtractingAgent parses markdown, extracts frontmatter, generates slug/tags/summary via LLM
3. UploadingAgent uploads images to object storage, validates schema, saves to Postgres
4. LoggingAgent formats Rich output panels

## Code Standards

### File Limits

See `.claude/rules/development/code.md` (300 lines soft / 400 hard).

### Type Annotations

Complete types required on every function (`.claude/rules/development/python.md` §3):

```python
def fn(x: list[dict[str, Any]], y: float | None = None) -> dict[str, int]:
    """Docstring with Args, Returns, Raises, Examples."""
```

### Docstring Format

```python
def fn(arg: Type) -> Return:
    """One-line summary.

    Args:
        arg: Description

    Returns:
        Description

    Raises:
        ErrorType: When

    Examples:
        >>> fn(x)
        result
    """
```

## Configuration

Constants live in `configs/` and are re-exported by the top-level `config.py`
barrel (there is no `src/` directory). All support env var overrides:

- `OLLAMA_MODEL` - Default: `qwen3:8b` (`MODEL_NAME` is an alias for it)
- `OLLAMA_BASE_URL` - Default: `http://localhost:11434`
- `STORAGE_PROVIDER`, `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_REGION`,
  `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` - provider-swappable object storage
  (`oci` in production; mirrors `apps/dashboard_server/src/lib/storage`)
- `DATABASE_URL` - resolved in `configs/database.py` from the Supabase
  `POSTGRES_URL*` vars; see the root `CLAUDE.md` for which is pooled vs direct
- `MCP_ENABLED` - Set to "true" to enable MCP integration

## Markdown Format

Posts use YAML frontmatter:

```markdown
---
title: 'Post Title'
author: 'Author Name'
date: '2026-01-03'
tags: ['tag1', 'tag2']
---

# Content here

![Image](./images/diagram.png)
```

## Adding New Agents

1. Create file in `agents/` (e.g., `agents/validation_agent.py`)
2. Inherit from `BaseAgent` in `agents/base.py`
3. Implement `execute(task: AgentTask) -> AgentResponse`
4. Register in `agents/project_manager.py` workflow
5. Export in `agents/__init__.py`
