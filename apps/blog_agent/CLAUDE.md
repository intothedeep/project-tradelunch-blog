# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-agent system for automating blog post processing using LangGraph and Qwen 2.5 8B (via Ollama). The system parses markdown files, extracts metadata, generates tags/summaries via LLM, and uploads to S3/RDS.

## Commands

### Running the System
```bash
# Terminal 1: Start Ollama server (required)
ollama serve

# Terminal 2: Run CLI
source tradelunch-agents-venv/bin/activate
python cli_multi_agent.py
```

### Testing
```bash
# Basic agent tests (works without Ollama for most tests)
python __tests__/test_agents.py

# Tests including LLM features
python __tests__/test_improved_agents.py

# Test LLM providers
python __tests__/test_llm_providers.py

# Run all tests with pytest
pytest __tests__/
```

### Quality Gates
```bash
mypy --strict agents/
ruff check agents/
pytest --cov=agents --cov-fail-under=80 __tests__/
```

### Setup
```bash
python -m venv tradelunch-agents-venv
source tradelunch-agents-venv/bin/activate
pip install -e .
pip install -e ".[dev]"  # For development tools
ollama pull qwen3:8b
```

## Architecture

```
ProjectManager (LangGraph orchestrator + Qwen3 LLM)
        │
        ├── ExtractingAgent     - Markdown parsing, frontmatter extraction, LLM-generated tags/summary
        ├── UploadingAgent      - S3 image upload, RDS database save (or simulated)
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
3. UploadingAgent uploads images to S3, validates schema, saves to RDS
4. LoggingAgent formats Rich output panels

## Code Standards

### File Limits
- Implementation files: max 300 lines (excluding comments/docstrings)
- Test files: max 500 lines
- If exceeded: split module or justify in context.md

### Type Annotations
Complete types required on every function:
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

### TDD Workflow
1. Write failing test
2. Implement minimum to pass
3. Refactor (tests stay green)

### Test Naming
```python
# Correct
def test_login_rejects_invalid_credentials(): ...

# Wrong
def test_login(): ...
```

## Configuration

Key settings in `src/config.py` (all support env var overrides):
- `MODEL_NAME` - Default: `qwen3:8b`
- `OLLAMA_BASE_URL` - Default: `http://localhost:11434`
- `S3_BUCKET`, `S3_REGION` - AWS S3 settings
- `DB_CONFIG` - PostgreSQL/RDS connection settings
- `MCP_ENABLED` - Set to "true" to enable MCP integration

## Markdown Format

Posts use YAML frontmatter:
```markdown
---
title: "Post Title"
author: "Author Name"
date: "2026-01-03"
tags: ["tag1", "tag2"]
---

# Content here

![Image](./images/diagram.png)
```

## Adding New Agents

1. Create file in `src/` (e.g., `src/validation_agent.py`)
2. Inherit from `BaseAgent` in `src/base.py`
3. Implement `execute(task: AgentTask) -> AgentResponse`
4. Register in `src/project_manager.py` workflow
5. Export in `src/__init__.py`
