# Category Extraction from Folder Path

## Overview

Categories are automatically extracted from the folder structure where blog posts are stored. The full folder path becomes a category hierarchy.

## How It Works

### Folder Structure → Categories

The DocumentScannerAgent analyzes the folder path and extracts the category hierarchy:

```
docs/
  ├── technology/
  │   ├── ai/
  │   │   └── langchain-guide/
  │   │       ├── langchain-guide.md
  │   │       └── diagram1.jpeg
  │   └── web/
  │       └── react-hooks/
  │           └── react-hooks.md
  └── business/
      └── marketing/
          └── seo-basics/
              └── seo-basics.md
```

**Extraction Logic:**
- **Path:** `docs/technology/ai/langchain-guide/`
- **Categories:** `['technology', 'ai']` (excludes 'docs' root and article folder name)

## Examples

### Example 1: Multi-level Hierarchy

**Folder Path:**
```
docs/technology/ai/langchain-guide/langchain-guide.md
```

**Extracted:**
```python
categories: ['technology', 'ai']
# Category hierarchy: technology > ai
```

**LLM Prompt:**
```
Category Path: technology > ai
```

### Example 2: Deep Hierarchy

**Folder Path:**
```
docs/programming/java/spring/jdbc/connection-pooling/connection-pooling.md
```

**Extracted:**
```python
categories: ['programming', 'java', 'spring', 'jdbc', 'connection-pooling']
# Category hierarchy: programming > java > spring > jdbc > connection-pooling
```

**LLM Prompt:**
```
Category Path: programming > java > spring > jdbc > connection-pooling
```

### Example 3: Single Level

**Folder Path:**
```
docs/tutorials/getting-started/getting-started.md
```

**Extracted:**
```python
categories: ['tutorials']
# Category hierarchy: tutorials
```

**LLM Prompt:**
```
Category Path: tutorials
```

### Example 4: Root Level (No Categories)

**Folder Path:**
```
docs/introduction/introduction.md
```

**Extracted:**
```python
categories: []
# Category hierarchy: (root)
```

**LLM Prompt:**
```
(No category path)
```

## Code Implementation

### DocumentScannerAgent

```python
# In agents/document_scanner_agent.py

path_parts = list(relative_path.parts)
# Example: ['technology', 'ai', 'langchain-guide']

if len(path_parts) > 1:
    # Multiple levels: extract all except the article folder
    categories = path_parts[:-1]  # ['technology', 'ai']
elif len(path_parts) == 1:
    # Single level: article at root, no category
    categories = []
else:
    categories = []

return {
    "categories": categories,  # Full hierarchy
    "category": categories[0] if len(categories) > 0 else None,  # Backward compat
    "subcategory": categories[1] if len(categories) > 1 else None,  # Backward compat
}
```

### ExtractingAgent

```python
# In agents/extracting_agent.py

# Extract from DocumentScanner result
categories = article_info.get("categories", [])  # ['technology', 'ai']

# Pass to LLM
metadata = await self._generate_metadata_with_llm(
    title=parsed_data["title"],
    content=parsed_data["content"],
    categories=categories  # Full hierarchy
)

# LLM prompt includes:
# Category Path: technology > ai
```

## Database Schema Mapping

### PostSchema Fields

```python
# schema.py - PostSchema
category_id: Optional[int]  # Primary category ID (from categories table)
```

### Categories Table

```sql
-- schema/posts.schema.sql
CREATE TABLE categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id BIGINT NOT NULL,     -- Parent category ID (0 for root)
    root_id BIGINT NOT NULL,       -- Root category ID
    level INT NOT NULL DEFAULT 0,  -- Hierarchy level (0 = root)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### Post Categories Junction Table

```sql
-- For multiple categories per post
CREATE TABLE post_categories (
    post_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    PRIMARY KEY (post_id, category_id)
);
```

## Category Hierarchy Example

### Folder Structure
```
docs/
  └── technology/
      └── ai/
          └── machine-learning/
              └── neural-networks/
                  └── cnn-basics/
                      └── cnn-basics.md
```

### Extracted Categories
```python
categories: ['technology', 'ai', 'machine-learning', 'neural-networks', 'cnn-basics']
```

### Database Representation
```sql
-- categories table
| id | name              | parent_id | root_id | level |
|----|-------------------|-----------|---------|-------|
| 1  | technology        | 0         | 1       | 0     | -- Root
| 2  | ai                | 1         | 1       | 1     |
| 3  | machine-learning  | 2         | 1       | 2     |
| 4  | neural-networks   | 3         | 1       | 3     |
| 5  | cnn-basics        | 4         | 1       | 4     |

-- post_categories table
| post_id | category_id |
|---------|-------------|
| 123     | 1           | -- technology
| 123     | 2           | -- ai
| 123     | 3           | -- machine-learning
| 123     | 4           | -- neural-networks
| 123     | 5           | -- cnn-basics

-- posts table
| id  | title      | category_id |
|-----|------------|-------------|
| 123 | CNN Basics | 5           | -- Primary category (most specific)
```

## Usage in Agent Workflow

### 1. DocumentScannerAgent
```python
scanner = DocumentScannerAgent()
result = await scanner.run(task)

# Result includes full category hierarchy
article = result["data"]["articles"][0]
print(article["categories"])
# Output: ['technology', 'ai', 'machine-learning']
```

### 2. ExtractingAgent
```python
agent = ExtractingAgent()
task = AgentTask.create(
    action="extract",
    data={"article_info": article}
)
result = await agent.run(task.to_dict())

# Result includes categories
print(result["data"]["categories"])
# Output: ['technology', 'ai', 'machine-learning']
```

### 3. LLM Metadata Generation
The categories are passed to the LLM for context:

```
ARTICLE INFO:
Title: Understanding Convolutional Neural Networks
Category Path: technology > ai > machine-learning > neural-networks > cnn-basics

Content preview:
...
```

The LLM uses this category context to:
- Generate more relevant tags
- Create a better summary
- Understand the topic domain

## Benefits

### 1. Automatic Organization
No need to manually specify categories in frontmatter - they're derived from folder structure.

### 2. Hierarchical Structure
Full path provides context at multiple levels (technology → ai → machine-learning).

### 3. Flexible Depth
Supports any depth of category hierarchy (1 level to N levels).

### 4. Database Efficiency
Can query by any level:
- All 'technology' posts
- All 'ai' posts under 'technology'
- All 'machine-learning' posts under 'ai'

### 5. SEO Friendly
Category paths create semantic URL structures:
```
/technology/
/technology/ai/
/technology/ai/machine-learning/
/technology/ai/machine-learning/cnn-basics/
```

## Best Practices

### 1. Consistent Naming
Use lowercase, hyphen-separated folder names:
```
✅ machine-learning/
❌ Machine Learning/
❌ machine_learning/
```

### 2. Logical Hierarchy
Organize from general to specific:
```
technology/
  └── ai/
      └── machine-learning/  (specific)
```

Not:
```
machine-learning/
  └── ai/
      └── technology/  (backwards!)
```

### 3. Reasonable Depth
Aim for 2-4 levels for usability:
```
✅ technology/ai/machine-learning/  (3 levels)
⚠️ technology/ai/ml/deep-learning/cnn/computer-vision/image-classification/  (7 levels - too deep!)
```

### 4. Meaningful Names
Use descriptive, searchable category names:
```
✅ web-development/
❌ misc/
❌ stuff/
```

## Testing

```bash
# Test category extraction
python __tests__/test_improved_agents.py

# Expected output:
# 📄 langchain-guide
#    Categories: technology > ai
#    ✓ Thumbnail
#    ✓ Images: 3
```

## See Also

- [schema/tradelunch.schema.sql](schema/tradelunch.schema.sql) - Database schema for categories table
- [db/repositories/category.py](db/repositories/category.py) - Category database operations
- [agents/document_scanner_agent.py](agents/document_scanner_agent.py) - Category extraction logic
- [agents/extracting_agent.py](agents/extracting_agent.py) - Category usage in metadata generation
