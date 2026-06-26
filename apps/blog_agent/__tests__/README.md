# Tests

This directory contains all test files for the project_tradelunch_agent_blog project.

## Test Files

### `test_agents.py`
Basic agent tests that can run without LLM services.

**Tests:**
- DocumentScannerAgent folder scanning
- ExtractingAgent markdown parsing
- UploadingAgent file handling
- Schema validation

**Usage:**
```bash
python __tests__/test_agents.py
```

### `test_improved_agents.py`
Comprehensive tests including LLM integration features.

**Tests:**
- Full agent workflow (scan → extract → upload)
- LLM-powered metadata generation
- Category hierarchy extraction
- Schema compatibility

**Usage:**
```bash
python __tests__/test_improved_agents.py
```

**Requirements:**
- Ollama running (for local LLM) OR
- OpenAI/Anthropic API keys (for cloud LLM)

### `test_llm_providers.py`
LLM provider configuration and connectivity tests.

**Tests:**
- Local LLM (Ollama) connection
- OpenAI API connection
- Anthropic API connection
- Provider auto-configuration
- ExtractingAgent LLM integration

**Usage:**
```bash
python __tests__/test_llm_providers.py
```

### `test_category_storage.py`
Category storage logic tests for `UploadingAgent`.

**Tests:**
- Hierarchy resolution (path → IDs)
- Post-Category linking
- Snowflake ID uniqueness for categories

**Usage:**
```bash
python __tests__/test_category_storage.py
```

### `test_snowflake.py`
Snowflake ID generation tests.

**Tests:**
- Unique ID generation
- Timestamp encoding
- ID format validation

**Usage:**
```bash
python __tests__/test_snowflake.py
```

### `test_db_connection.py`
Database connection and health check.

**Tests:**
- DB Connection & SSL
- Repository access
- Simple query execution
- Connection pool status

**Usage:**
```bash
python __tests__/test_db_connection.py
```

## Running Tests

### Run All Tests
```bash
# Using pytest (recommended)
pytest __tests__/

# With coverage
pytest --cov=agents --cov-fail-under=80 __tests__/

# Verbose mode
pytest -v __tests__/
```

### Run Specific Test
```bash
# Run single test file
pytest __tests__/test_agents.py

# Run specific test function
pytest __tests__/test_agents.py::test_document_scanner
```

### Run Tests by Category
```bash
# Only fast tests (no LLM)
pytest __tests__/test_agents.py __tests__/test_snowflake.py

# Only LLM tests
pytest __tests__/test_improved_agents.py __tests__/test_llm_providers.py
```

## Test Configuration

### Environment Variables
```bash
# LLM Provider Selection
export LLM_PROVIDER=local          # or "openai", "anthropic"

# For OpenAI
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o-mini

# For Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
export ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# For Local (Ollama)
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=qwen3:8b
```

### pytest.ini Configuration
See `pytest.ini` in project root for configuration options.

## Test Standards

### File Naming
- Test files: `test_*.py`
- Test functions: `test_*()` or `async def test_*():`

### Type Annotations
All test functions should have complete type annotations:
```python
async def test_example() -> None:
    """Test description."""
    result: dict[str, Any] = await some_function()
    assert result["success"] is True
```

### Docstrings
Each test should have a docstring explaining what it tests:
```python
async def test_document_scanner() -> None:
    """Test DocumentScannerAgent folder structure scanning.

    Verifies:
    - Folder hierarchy detection
    - Category extraction
    - Thumbnail identification
    - Article metadata collection
    """
```

### Assertions
Use descriptive assertion messages:
```python
assert result is not None, "Scanner should return a result"
assert result["success"], f"Scanner failed: {result.get('error')}"
```

## Writing New Tests

### 1. Create Test File
```python
# __tests__/test_new_feature.py
import asyncio
from agents import MyNewAgent

async def test_new_agent_basic():
    """Test basic functionality of MyNewAgent."""
    agent = MyNewAgent()
    result = await agent.run({"action": "test"})
    assert result["success"]

if __name__ == "__main__":
    asyncio.run(test_new_agent_basic())
```

### 2. Add to __init__.py
Update `__tests__/__init__.py` to document the new test file.

### 3. Update This README
Add section describing the new test file and its purpose.

## CI/CD Integration

Tests can be configured to run automatically on:
- Pull requests
- Main branch commits
- Manual workflow dispatch

**Note:** CI workflow is not yet configured. To add CI, create `.github/workflows/test.yml`.

## Troubleshooting

### Tests Fail with Import Errors
Make sure you've installed the package in development mode:
```bash
pip install -e .
```

### LLM Tests Fail
1. Check Ollama is running: `ollama list`
2. Verify API keys are set
3. Check `LLM_PROVIDER` environment variable

### Database Tests Fail
Ensure test database is configured in `config.py` or use mock connections.

## Coverage Reports

Generate coverage report:
```bash
# Terminal report
pytest --cov=agents --cov-report=term-missing __tests__/

# HTML report
pytest --cov=agents --cov-report=html __tests__/
open htmlcov/index.html
```

## References

- [pytest documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://github.com/pytest-dev/pytest-asyncio)
- [CLAUDE.md](../CLAUDE.md) - Project guidelines
