# Module: markdown.toc

**Purpose**: Extract Table of Contents (TOC) from markdown content with proper handling of code blocks.

**Location**: `/packages/markdown-parsing/src/markdown/markdown.toc.ts`

---

## Public Interface

| Export | Type | Description |
|--------|------|-------------|
| `tocPlugin` | Remark Plugin | AST-based plugin for unified pipeline |
| `extractToc` | `(markdown: string) => TTocItem[]` | Sync regex-based extraction |
| `extractTocParsed` | `(markdown: string) => Promise<TTocItem[]>` | Async AST-based extraction |
| `buildNestedToc` | `(items: TTocItem[]) => TNestedTocItem[]` | Convert flat TOC to nested tree |

---

## Usage

### 1. `extractToc` (Synchronous, Regex-based)

Fast extraction with code block filtering:

```typescript
import { extractToc } from '@tradelunch/markdown-parsing';

const toc = extractToc(markdownContent);
// Returns: TTocItem[] (depth 1-3 only)
```

### 2. `extractTocParsed` (Async, AST-based)

Most accurate, uses full markdown parsing:

```typescript
import { extractTocParsed } from '@tradelunch/markdown-parsing';

const toc = await extractTocParsed(markdownContent);
// Returns: Promise<TTocItem[]>
```

### 3. `tocPlugin` (Remark Pipeline)

For use within an existing unified pipeline:

```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { tocPlugin } from '@tradelunch/markdown-parsing';

const file = await unified()
    .use(remarkParse)
    .use(tocPlugin)
    .process(markdown);

const toc = file.data.toc; // TTocItem[]
```

### 4. `buildNestedToc` (Nesting)

Convert flat TOC array to nested structure:

```typescript
import { extractToc, buildNestedToc } from '@tradelunch/markdown-parsing';

const flat = extractToc(markdown);
const nested = buildNestedToc(flat);
// Returns: TNestedTocItem[] with children
```

---

## Types

```typescript
type TTocItem = {
    depth: 1 | 2 | 3 | 4 | 5 | 6;
    text: string;
    slug: string;
};

type TNestedTocItem = TTocItem & {
    children: TNestedTocItem[];
};
```

---

## Dependencies

- **Internal**: `@/src/types` (TTocItem, TNestedTocItem)
- **External**: `unified`, `remark-parse`, `unist-util-visit`, `github-slugger`

---

## Implementation Notes

### Code Block Handling

Both `extractToc` and `extractTocParsed` correctly ignore headings inside fenced code blocks:

- **`extractToc`**: Strips code blocks via regex before matching headings
- **`extractTocParsed`**: Uses AST parsing where code blocks are separate nodes

### Slug Generation

Uses `github-slugger` for consistent ID generation, matching `rehype-slug` behavior.

### Depth Filtering

`extractToc` only returns headings with depth ≤ 3 (h1, h2, h3). `extractTocParsed` returns all depths.

---

## Change Log

| Date | Changes |
|------|---------|
| 2026-01-19 | Added `extractTocParsed` helper, fixed code block handling in `extractToc` |
