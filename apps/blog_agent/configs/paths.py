# configs/paths.py
"""
Path Configuration

Project directory structure and file paths.
"""

from pathlib import Path


# ==================== Project Paths ====================
PROJECT_ROOT = Path(__file__).parent.parent
POSTS_DIR = PROJECT_ROOT / "posts"
TEMP_DIR = PROJECT_ROOT / "temp"
LOGS_DIR = PROJECT_ROOT / "logs"

# Create directories if they don't exist
POSTS_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)
