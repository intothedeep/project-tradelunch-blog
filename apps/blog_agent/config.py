# config.py
"""
Configuration - Backward Compatibility

This file re-exports all configuration from the configs/ module.
New code should import from configs directly:
    from configs import SUPABASE_URL, SUPABASE_STORAGE_BUCKET
    from configs.database import get_database_url
"""

# Re-export everything from configs module
from configs.env import *
from configs.database import *
from configs.storage import *
from configs.paths import *
from configs.llm import *
from configs.agent import *
