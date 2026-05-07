---
trigger: always_on
---

# Python

## 1. Environment & Package Management

- **Virtual Environment Tool**: Use `uv` with `.venv` (local to the project).
- **Package Manager**: Use `uv add` / `uv run` — never `pip install` globally or `conda`.
- **Configuration**: Use `pyproject.toml` as the single source of truth for all project configurations (dependencies, tool configs, etc.). Avoid `setup.py`, `requirements.txt`, or scattered config files.

## 2. Testing

- **Testing Framework**: Use `pytest`.
- **Scope**: Write tests for **simple core logic only**. Do not over-test boilerplate, simple getters/setters, or complex integrations unless specified. Keep tests lightweight and fast.
- **Structure**: Tests should mirror the `src/` or core code directory structure.

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
├── src/                # (or equivalent core directory)
│   └── module/
│       └── *.py        # Implementation files
└── tests/
    └── test_*.py       # Pytest files
```

## 5. Typical Workflow Commands

```bash
# 1. Create the virtual environment
uv venv --python 3.13

# 2. Install dependencies
uv pip install -e .

# 3. Run tests
uv run pytest

# 4. Add a dependency
uv add <package>
```

## 6. Config Examples (`pyproject.toml`)

```toml
[project]
name = "project-name"
version = "0.1.0"
dependencies = []

[tool.pytest.ini_options]
addopts = "-v"

[tool.ruff]
line-length = 100
```

## ETC

For Python:

- use pyenv to setup python version
- uv to create virtual env
- uv to manage package
- use pyproject.toml for config
- use uv.toml
- use module.
- use pytest
- use raw sql for db query
- use sqlalchemy for orm but not using orm
- use .env
- use configs folder for config
- load env variables as constant and import them to use
- **tests** folder for test
- use global exception handling pattern
- for server, use controllers, services, repositories
- use langgraph to develop an agent
- use schema folder
- use .venv
- use uv to mange packages
- use uv run to run python script
- use uv add to add packages