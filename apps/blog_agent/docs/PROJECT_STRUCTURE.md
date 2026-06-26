# Project Structure

## Overview

This is a multi-agent system for automating blog post processing using LangGraph and Qwen3 8B (via Ollama). The system parses markdown files, extracts metadata, generates tags/summaries via LLM, and uploads to S3/RDS.

## Directory Structure

```
blog-agent/
├── agents/                      # Agent modules
│   ├── __init__.py              # Package exports
│   ├── base.py                  # BaseAgent abstract class
│   ├── protocol.py              # Inter-agent communication protocol
│   ├── document_scanner_agent.py # Folder structure scanner
│   ├── extracting_agent.py      # Markdown parser & metadata extractor
│   ├── uploading_agent.py       # S3/RDS uploader
│   ├── logging_agent.py         # Logging & terminal output
│   └── project_manager.py       # LangGraph orchestrator
├── configs/                     # Configuration modules
│   ├── aws.py                   # AWS S3 settings
│   ├── database.py              # Database connection settings
│   ├── llm.py                   # LLM provider settings
│   └── paths.py                 # File path configurations
├── db/                          # Database & Storage
│   ├── repositories/            # Data access layer
│   │   ├── category.py          # Category operations
│   │   ├── post.py              # Post operations
│   │   ├── file.py              # File/Image operations
│   │   └── tag.py               # Tag operations
│   ├── connection.py            # DB session management
│   ├── models.py                # SQLAlchemy models
│   └── s3.py                    # S3 utility functions
├── docs/                        # Project documentation
│   └── technology/ai/langchain-guide/
├── posts/                       # Sample blog posts
│   └── sample-post.md
├── schema/                      # Database schema
│   └── tradelunch.schema.sql    # SQL DDL
├── utils/                       # Shared utilities
│   └── snowflake.py             # ID generator
├── __tests__/                   # Test suite
│   ├── test_agents.py           # Basic agent tests
│   ├── test_improved_agents.py  # LLM feature tests
│   ├── test_llm_providers.py    # Provider connection tests
│   ├── test_snowflake.py        # ID generation tests
│   └── test_category_storage.py # Category logic tests
├── .python-version              # Python version for pyenv
├── pyproject.toml               # Project configuration (PEP 621)
├── config.py                    # Global configuration entry point
├── cli_multi_agent.py           # CLI interface
├── README.md                    # Project documentation
├── CLAUDE.md                    # Claude Code instructions
└── tradelunch-agents-venv/      # Virtual environment
```

## File Naming

All Python files use standard naming conventions (no number prefixes):

- ✅ `config.py` (not `00_config.py`)
- ✅ `schema.py` (not `01_schema.py`)
- ✅ `cli_multi_agent.py` (not `10_cli_multi_agent.py`)
- ✅ `test_agents.py` (not `90_test_agents.py`)
- ✅ `agents/base.py` (not `agents/00_base.py`)

This allows standard Python imports:
```python
from agents import BaseAgent, AgentTask, ExtractingAgent
from config import MODEL_NAME, OLLAMA_BASE_URL
from schema import ArticleSchema, calculate_reading_time
```

## Agent Architecture

```
ProjectManager (LangGraph orchestrator + Qwen3 LLM)
        │
        ├── ExtractingAgent     - Markdown parsing, frontmatter extraction, LLM-generated tags/summary
        ├── UploadingAgent      - S3 image upload, RDS database save (or simulated)
        ├── LoggingAgent        - Rich terminal UI, progress indicators
        └── DocumentScannerAgent - Folder structure scanning, category detection
```

## Key Components

### Configuration (`configs/` & `config.py`)
- `configs/` modules: `aws.py`, `database.py`, `llm.py`, `paths.py`
- `config.py`: Central entry point that aggregates all settings
- Supports environment variable overrides via `.env`

### Database Layer (`db/` & `schema/`)

**Repositories (`db/repositories/`)**
- `CategoryRepository`: Hierarchy management
- `PostRepository`: Article storage
- `FileRepository`: Image/file metadata
- `TagRepository`: Tag management

**Core Components**
- `models.py`: SQLAlchemy ORM models
- `connection.py`: Async session management
- `s3.py`: S3 upload/delete utilities

**Schema**
- `schema/tradelunch.schema.sql`: PostgreSQL DDL
- `schema/schema.py`: Pydantic models for validation

### Utils (`utils/`)
- `snowflake.py`: Twitter Snowflake ID generator (unique 64-bit IDs)

### Agents (`agents/`)

**base.py** - Abstract BaseAgent class
- Common interface for all agents
- Status management
- Logging functionality

**protocol.py** - Communication protocol
- `AgentMessage` - Inter-agent messages
- `AgentTask` - Task definitions
- `AgentResponse` - Task results

**document_scanner_agent.py** - Folder structure scanner
- Recursively scans document folders
- Identifies article folders (leaf directories)
- Distinguishes thumbnails from content images
- Extracts category from folder structure

**extracting_agent.py** - Markdown parser
- Parses frontmatter and content
- Extracts images
- Generates slugs
- LLM-powered tag generation (5-7 tags)
- LLM-powered summary generation (3 sentences)
- Calculates reading time

**uploading_agent.py** - S3/RDS uploader
- Uses `FileRepository` and `s3.py` for uploads
- Uses `PostRepository` and `CategoryRepository` for data persistence
- Handles category hierarchy creation
- Transaction management

**logging_agent.py** - Logging & output
- Rich terminal formatting
- Progress indicators
- Result summaries
- Error highlighting

**project_manager.py** - LangGraph orchestrator
- Analyzes user commands with LLM
- Plans agent execution sequence
- Manages workflow state
- Coordinates data flow between agents

### CLI (`cli_multi_agent.py`)
- Interactive command-line interface
- Natural language command support
- Command history
- Rich UI with colors and panels

### Tests (`__tests__/`)
- `test_agents.py`: Basic functionality
- `test_improved_agents.py`: LLM features
- `test_llm_providers.py`: Provider connectivity
- `test_snowflake.py`: ID generation
- `test_category_storage.py`: Category hierarchy logic

## Data Flow

1. **User Input** → CLI captures command
2. **Analysis** → ProjectManager analyzes with LLM
3. **Extraction** → ExtractingAgent parses markdown, generates metadata
4. **Upload** → UploadingAgent uploads images, saves to database
5. **Output** → LoggingAgent displays results

## Usage

### Setup
```bash
# Create virtual environment (pyenv recommended)
python -m venv tradelunch-agents-venv
source tradelunch-agents-venv/bin/activate  # On Windows: tradelunch-agents-venv\Scripts\activate

# Install project and dependencies (using pyproject.toml)
pip install -e .

# Install dev dependencies (for testing and linting)
pip install -e ".[dev]"

# Pull Qwen model
ollama pull qwen3:8b
```

**Note:** This project uses `pyproject.toml` (PEP 621 standard) for dependency management and configuration.

### Run Tests
```bash
# Basic tests (no Ollama required)
python __tests__/test_agents.py

# Advanced tests (requires Ollama)
python __tests__/test_improved_agents.py
```

### Run CLI
```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Run CLI
source tradelunch-agents-venv/bin/activate
python cli_multi_agent.py
```

### Commands
```bash
# Upload a blog post
blog-agent> upload ./posts/my-article.md

# Process with metadata extraction
blog-agent> process ./posts/article.md

# Scan document folder
blog-agent> scan ./docs

# Show status
blog-agent> status

# Show history
blog-agent> history

# Exit
blog-agent> exit
```

## Code Standards

- Type annotations required on all functions
- Complete docstrings with Args, Returns, Raises, Examples
- TDD workflow: write test → implement → refactor
- Test files mirror source structure
- 80% minimum code coverage
- Files should not exceed 300 lines (excluding comments/docstrings)

## Configuration Options

Edit `config.py` to customize:

```python
# LLM Settings
MODEL_NAME = "qwen3:8b"
OLLAMA_BASE_URL = "http://localhost:11434"

# AWS Settings (for production)
S3_BUCKET = "my-blog-bucket"
S3_REGION = "us-east-1"

# Database Settings
DB_CONFIG = {
    "host": "localhost",
    "database": "blog_db",
    # ... more config
}

# MCP Settings
MCP_ENABLED = "false"  # Set to "true" to enable MCP
```

## Markdown Format

Blog posts use YAML frontmatter:

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

## Dependencies

- **LangChain** - LLM orchestration
- **LangGraph** - Agent workflow
- **Ollama** - Local LLM runtime
- **Rich** - Terminal UI
- **Pydantic** - Data validation
- **python-frontmatter** - Markdown parsing
- **boto3** - AWS S3 (optional)
- **psycopg2** - PostgreSQL (optional)

## Development

### Adding New Agents

1. Create new file in `agents/` (e.g., `validation_agent.py`)
2. Inherit from `BaseAgent`
3. Implement `execute(task: AgentTask) -> AgentResponse`
4. Export in `agents/__init__.py`
5. Register in `project_manager.py` workflow

### Running Quality Checks

```bash
# Type checking
mypy --strict agents/

# Linting
ruff check agents/

# Tests with coverage
pytest --cov=agents --cov-fail-under=80
```

## Troubleshooting

### "Connection refused" error
- Ensure Ollama is running: `ollama serve`

### "Model not found" error
- Pull the model: `ollama pull qwen3:8b`

### Import errors
- Reinstall dependencies: `pip install -e . --force-reinstall`

### File not found
- Use absolute paths or check current directory: `pwd`
- Verify file exists: `ls -la ./posts/`

## License

MIT

## Contributing

Contributions welcome! Please follow:
1. TDD workflow
2. Complete type annotations
3. Docstrings for all public functions
4. 80% minimum test coverage
5. Files under 300 lines
