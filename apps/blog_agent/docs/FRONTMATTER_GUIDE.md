# Frontmatter Guide

This document explains the YAML frontmatter format used in blog posts and how it maps to the database schema (`schema/posts.schema.sql`).

## Table of Contents
- [Overview](#overview)
- [Required Fields](#required-fields)
- [Optional Fields](#optional-fields)
- [Status Field (IMPORTANT)](#status-field-important)
- [Complete Examples](#complete-examples)
- [Field Mapping](#field-mapping)
- [Notes](#notes)

---

## Overview

Blog posts use YAML frontmatter at the top of markdown files to define metadata. The ExtractingAgent reads this frontmatter and maps it to the database schema.

**Format:**
```markdown
---
title: "Your Post Title"
userId: 1
status: 'public'
---

# Your Content Here
```

---

## Required Fields

### `title` (string, required)
Post title displayed in cards and page headers.

```yaml
title: "Complete Guide to LangChain"
# or
title: 'when to mark visited'
```

- **Maps to:** `posts.title` (VARCHAR 255)
- **If missing:** Extracted from first `# Heading` in content

---

## Optional Fields

### `userId` (integer, optional)
ID of the user who created the post.

```yaml
userId: 2
```

- **Maps to:** `posts.user_id` (BIGINT)
- **Default:** `1` (test user)
- **Note:** Must match existing user ID in `users` table

### `author` or `username` (string, optional)
Author name (display only, not stored in posts table).

```yaml
author: "Alex Kim"
# or
username: "taeklim"
```

- **Maps to:** Metadata only (not in posts table)
- **Default:** `"Unknown"`

### `date` (string/datetime, optional)
Publication or creation date.

```yaml
date: "2026-01-03"
# or
date: 2025-12-31 18:31:03
```

- **Maps to:** Metadata only (posts table uses auto `created_at`)
- **Format:** ISO 8601 or any valid date string

### `desc` (string, optional)
Post description or summary.

```yaml
desc: "A comprehensive guide to understanding graph algorithms."
```

- **Maps to:** `posts.description` (TEXT)
- **Default:** Empty string
- **Note:** Will be **overridden by LLM-generated description** if LLM is enabled

### `tags` (array, optional)
List of tags.

```yaml
tags: [algorithms, graph, bfs, dfs]
# or
tags:
  - algorithms
  - graph
  - bfs
```

- **Maps to:** `tags` table + `post_tags` junction table
- **Default:** Empty array `[]`
- **Note:** Will be **overridden by LLM-generated tags** if LLM is enabled

### `category` (string, optional)
Category name (if not using folder-based categories).

```yaml
category: "Technology"
```

- **Maps to:** `categories` table (by name lookup)
- **Note:** Folder structure can also provide category

---

## Status Field (IMPORTANT)

### SQL Schema
```sql
CREATE TYPE post_status_enum AS ENUM ('public', 'private', 'follower');
```

### Valid Values
1. **`'public'`** (recommended) - Visible to everyone
2. **`'private'`** - Only visible to author
3. **`'follower'`** - Visible to author and followers

### Frontmatter Formats

#### ✅ Recommended: String Format
```yaml
status: 'public'   # Everyone can see
status: 'private'  # Only author can see
status: 'follower' # Followers can see
```

#### ⚠️ Backward Compatible: Boolean Format
```yaml
status: true   # Maps to 'public'
status: false  # Maps to 'private'
```

**Note:** Boolean format is supported for backward compatibility but **string format is recommended**.

#### Default Behavior
```yaml
# No status field
---
title: "My Post"
---
# Defaults to 'public'
```

### Status Mapping Logic

| Frontmatter Value | Database Value | Description |
|-------------------|----------------|-------------|
| `'public'` | `'public'` | Everyone can see |
| `'private'` | `'private'` | Only author can see |
| `'follower'` | `'follower'` | Followers can see |
| `true` | `'public'` | Backward compat |
| `false` | `'private'` | Backward compat |
| (missing) | `'public'` | Default |
| (invalid) | `'public'` | Fallback with warning |

---

## Complete Examples

### Example 1: Public Tech Article (Full Metadata)
```yaml
---
title: "Complete Guide to LangChain for Beginners"
author: "Alex Kim"
date: "2026-01-03"
userId: 1
status: 'public'  # Everyone can see
desc: "Learn LangChain from scratch with practical examples."
tags: [langchain, llm, ai, tutorial, python]
category: "Technology"
---

# Complete Guide to LangChain for Beginners

Your content here...
```

### Example 2: Private Draft (Minimal Metadata)
```yaml
---
title: "Draft: New Algorithm Ideas"
userId: 2
username: "taeklim"
status: 'private'  # Only I can see this
---

# Draft Content

Work in progress...
```

### Example 3: Follower-Only Post
```yaml
---
title: "Behind the Scenes: Our Development Process"
userId: 1
status: 'follower'  # Only followers can see
date: 2026-01-10
---

# Behind the Scenes

Exclusive content for followers...
```

### Example 4: Backward Compatible (Boolean Status)
```yaml
---
title: 'when to mark visited'
tags: [algorithms, graph, bfs, dfs, dijkstra, visited]
desc: "Understanding when to mark nodes as visited in graph algorithms."
date: 2025-12-31 18:31:03
userId: 2
username: taeklim
status: false  # Maps to 'private'
---

# Content here
```

**Recommendation:** Update to `status: 'private'` for clarity.

---

## Field Mapping

### Frontmatter → Database Schema

| Frontmatter Field | Database Table.Column | Type | Required | Default |
|-------------------|----------------------|------|----------|---------|
| `title` | `posts.title` | VARCHAR(255) | ✅ | From content |
| `userId` | `posts.user_id` | BIGINT | ❌ | `1` |
| `status` | `posts.status` | post_status_enum | ❌ | `'public'` |
| `desc` | `posts.description` | TEXT | ❌ | `""` |
| `category` | `posts.category_id` | BIGINT | ❌ | `NULL` |
| `tags` | `post_tags.tag_name` | VARCHAR(50)[] | ❌ | `[]` |
| `author` | *(metadata only)* | - | ❌ | `"Unknown"` |
| `username` | *(metadata only)* | - | ❌ | `"Unknown"` |
| `date` | *(metadata only)* | - | ❌ | `""` |

**Auto-generated fields** (not from frontmatter):
- `posts.id` - Auto-increment
- `posts.slug` - Generated from title
- `posts.content` - Markdown body
- `posts.created_at` - Auto timestamp
- `posts.updated_at` - Auto timestamp
- `posts.deleted_at` - Soft delete (NULL by default)

---

## Notes

### LLM Override Behavior

⚠️ **IMPORTANT:** If LLM is enabled (default), the following fields are **IGNORED** from frontmatter:

1. **`tags`** - LLM generates 5-7 relevant tags based on content analysis
2. **`desc`** - LLM generates 3-sentence summary

**Why?** LLM-generated metadata is more accurate and consistent than manual frontmatter.

**To use frontmatter tags/desc:**
```python
# Disable LLM when creating ExtractingAgent
agent = ExtractingAgent(enable_llm=False)
```

### Status Best Practices

1. **Use string format** for clarity:
   ```yaml
   status: 'public'  # ✅ Clear and explicit
   status: true      # ⚠️ Works but ambiguous
   ```

2. **Document your choice:**
   ```yaml
   status: 'private'  # Draft, not ready for publication
   ```

3. **Default is public:**
   - If omitted, post is `'public'` by default
   - Be explicit for non-public posts

### Validation

The ExtractingAgent validates status values:
- ✅ `'public'`, `'private'`, `'follower'` → Accepted
- ✅ `true`, `false` → Converted to `'public'`/`'private'`
- ❌ Invalid values → Warning logged, defaults to `'public'`

Example log:
```
⚠️  Invalid status value 'draft', defaulting to 'public'
```

### Migration Guide

If you have old posts with boolean status:

**Before:**
```yaml
status: false  # private
```

**After:**
```yaml
status: 'private'  # Much clearer!
```

**Migration script:** (Optional)
```bash
# Replace boolean status with string
sed -i "s/status: true/status: 'public'/g" posts/*.md
sed -i "s/status: false/status: 'private'/g" posts/*.md
```

---

## Testing Your Frontmatter

```bash
# Test a single file
python -c "
from agents import ExtractingAgent, AgentTask
import asyncio

async def test():
    agent = ExtractingAgent(enable_llm=False)
    task = AgentTask.create(
        action='extract',
        data={'file_path': './posts/your-post.md'}
    )
    result = await agent.run(task.to_dict())
    print(result)

asyncio.run(test())
"
```

Check the output:
```python
{
    'success': True,
    'data': {
        'title': '...',
        'user_id': 1,
        'status': 'public',  # Should match your frontmatter
        'description': '...',
        'tags': [...],
        ...
    }
}
```

---

## See Also

- [schema/posts.schema.sql](schema/posts.schema.sql) - Database schema (source of truth)
- [schema.py](schema.py) - Pydantic models
- [agents/extracting_agent.py](agents/extracting_agent.py) - Frontmatter parsing logic
- [LLM_SETUP.md](LLM_SETUP.md) - LLM configuration for tag/description generation

---

## Quick Reference

### Minimal Frontmatter
```yaml
---
title: "My Post"
---
```
Defaults: userId=1, status='public', no tags/desc

### Recommended Frontmatter
```yaml
---
title: "My Post"
userId: 1
status: 'public'
---
```
Clear and explicit

### Full Frontmatter
```yaml
---
title: "My Post"
userId: 1
author: "Your Name"
date: "2026-01-10"
status: 'public'
desc: "Optional description (will be overridden by LLM)"
tags: [tag1, tag2]  # Optional (will be overridden by LLM)
category: "Technology"
---
```
All available fields (tags/desc overridden if LLM enabled)
