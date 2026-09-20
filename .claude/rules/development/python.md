---
paths:
  - "**/*.py"
  - "pyproject.toml"
---

# Python

## 1. Environment & Package Management

- **Virtual Environment Tool**: Use `uv` with `.venv` (local to the project).
- **Package Manager**: Use `uv add` / `uv run` — never `pip install` globally or `conda`.
- **Configuration**: Use `pyproject.toml` as the single source of truth for all project configurations (dependencies, tool configs, etc.). Avoid `setup.py`, `requirements.txt`, or scattered config files.

## 2. Verification (no test runner)

Tests are SUSPENDED repo-wide — `rules/core.md` owns that rule and its rationale;
do not restate it. Verify Python behavior by DELIBERATE BREAKAGE against the real
system instead: trigger the failure, observe it, clean up.

## 3. Core Directives

- Code lightweight.
- LLM generates boilerplate; Developer designs architecture.
- Follow the Single Responsibility Principle: One module = one responsibility.
- Define explicit and minimal public interfaces (e.g., using `__all__`).
- Include type hints on every function.
- Be concise.

## 4. File Structure

```text
project/
├── pyproject.toml      # Config & Dependencies
└── src/                # (or equivalent core directory)
    └── module/
        └── *.py        # Implementation files
```

No `tests/` directory: see §2.

## 5. Typical Workflow Commands

```bash
# 1. Create the virtual environment
uv venv --python 3.13

# 2. Install dependencies
uv pip install -e .

# 3. Add a dependency
uv add <package>
```

## 6. Config Examples (`pyproject.toml`)

```toml
[project]
name = "project-name"
version = "0.1.0"
dependencies = []

[tool.ruff]
line-length = 100
```

## 7. Project Conventions (non-duplicative extras)

- pyenv sets the Python version; `uv` does everything else (§1).
- DB: raw SQL queries; SQLAlchemy only as the execution layer, not as an ORM.
- Config: `.env` + `configs/` folder; load env vars as constants once and import them.
- Structure: `schema/` folder for row/DTO shapes; servers use controllers → services → repositories; global exception-handling pattern.
- Agents: use LangGraph.
