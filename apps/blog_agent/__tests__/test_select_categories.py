# __tests__/test_select_categories.py

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.connection import get_db_session
from db.repositories.category import CategoryRepository

async def test_select_all_categories():
    """
    Test selecting all categories from the database.
    """
    print("\n--- Testing Select All Categories ---")
    
    async with get_db_session() as session:
        repo = CategoryRepository(session)
        
        # Select all categories (default limit is 100)
        categories = await repo.get_all(limit=100)
        
        print(f"Found {len(categories)} categories:")
        for cat in categories:
            print(f"  - [{cat.id}] {cat.title} (Level: {cat.level}, Parent: {cat.parent_id})")
            
        return categories

if __name__ == "__main__":
    asyncio.run(test_select_all_categories())
