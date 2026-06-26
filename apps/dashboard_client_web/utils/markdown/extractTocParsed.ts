/**
 * Purpose: Extracts a flat TOC array from raw markdown via AST parsing.
 * Inlined from @repo/markdown-parsing when that package was retired.
 * Only tocPlugin and extractTocParsed are included — buildNestedToc and
 * the regex-based extractToc are unused by the client and intentionally omitted.
 * Invariants: uses github-slugger for IDs consistent with rehype-slug.
 * Side effects: none (unified pipeline is stateless per call).
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import GithubSlugger from 'github-slugger';

import type { Root } from 'mdast';
import type { VFile } from 'vfile';

import type { TTocItem } from '@/utils/markdown/toc.types';

/**
 * Remark plugin that extracts headings into a flat TOC array.
 * Uses github-slugger for consistent ID generation with rehype-slug.
 */
export const tocPlugin = () => {
    return (tree: Root, file: VFile) => {
        const slugger = new GithubSlugger();
        const toc: TTocItem[] = [];

        visit(tree, 'heading', (node) => {
            const text = node.children
                .map((child) => {
                    if (child.type === 'text') return child.value;
                    if (child.type === 'inlineCode') return child.value;
                    return '';
                })
                .join('');

            const slug = slugger.slug(text);

            toc.push({
                depth: node.depth,
                text,
                slug,
            });
        });

        file.data.toc = toc;
    };
};

/**
 * Extracts TOC items from raw markdown using AST parsing.
 * This method correctly ignores headings inside code blocks.
 *
 * @param markdown - Raw markdown string
 * @returns Promise resolving to flat array of TOC items
 */
export async function extractTocParsed(markdown: string): Promise<TTocItem[]> {
    const processor = unified().use(remarkParse).use(tocPlugin);
    const tree = processor.parse(markdown);
    const file: VFile = { data: {} } as VFile;
    await processor.run(tree, file);

    return (file.data?.toc as TTocItem[]) ?? [];
}
