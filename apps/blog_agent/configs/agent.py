# configs/agent.py
"""
Agent Configuration

Settings for agents, CLI, and MCP.
"""

import os
from configs.paths import PROJECT_ROOT


# ==================== Agent Settings ====================
AGENT_TIMEOUT = 300  # seconds
MAX_RETRIES = 3


# ==================== CLI Settings ====================
CLI_HISTORY_FILE = PROJECT_ROOT / ".agent_history.json"
CLI_MAX_HISTORY = 100


# ==================== MCP Settings ====================
MCP_SERVER_PATH = os.getenv("MCP_SERVER_PATH", "./mcp-server/build/index.js")
MCP_ENABLED = os.getenv("MCP_ENABLED", "false").lower() == "true"
