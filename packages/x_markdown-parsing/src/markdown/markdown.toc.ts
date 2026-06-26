import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import GithubSlugger from 'github-slugger';

import type { Root } from 'mdast';
import type { VFile } from 'vfile';

import type { TTocItem, TNestedTocItem } from '@/src/types';

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

export function buildNestedToc(items: TTocItem[]): TNestedTocItem[] {
    const root: TNestedTocItem[] = [];
    const stack: TNestedTocItem[] = [];

    for (const item of items) {
        const node: TNestedTocItem = { ...item, children: [] };

        while (
            stack.length > 0 &&
            stack[stack.length - 1]!.depth >= item.depth
        ) {
            stack.pop();
        }

        if (stack.length === 0) {
            root.push(node);
        } else {
            stack[stack.length - 1]!.children.push(node);
        }

        stack.push(node);
    }

    return root;
}

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

/**
 * Extracts TOC items from raw markdown content.
 * Uses github-slugger for consistent ID generation with rehype-slug.
 *
 * @param markdown - Raw markdown string
 * @returns Flat array of TOC items
 */
export function extractToc(markdown: string): TTocItem[] {
    const slugger = new GithubSlugger();
    const toc: TTocItem[] = [];

    // Remove fenced code blocks (``` or ~~~) before extracting headings
    const withoutCodeBlocks = markdown.replace(
        /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1/gm,
        ''
    );

    // Regex to match markdown headings (# to ######)
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;

    while ((match = headingRegex.exec(withoutCodeBlocks)) !== null) {
        const depth = match[1].length as 1 | 2 | 3 | 4 | 5 | 6;
        if (depth > 3) continue;

        const text = match[2]
            .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.+?)\*/g, '$1') // Remove italic
            .replace(/`(.+?)`/g, '$1') // Remove inline code markers
            .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Extract link text
            .trim();

        const slug = slugger.slug(text);

        toc.push({ depth, text, slug });
    }

    return toc;
}
