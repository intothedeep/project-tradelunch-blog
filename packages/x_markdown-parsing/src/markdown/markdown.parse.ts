import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { tocPlugin } from '@/src/markdown/markdown.toc';

import type { TProcessedMarkdown, TTocItem } from '@/src/types';

import rehypeHighlight from 'rehype-highlight';

/**
 * @description Parses markdown content into HTML and a table of contents.
 * @param content The markdown content string.
 * @returns A Promise that resolves to an object containing the HTML and TOC.
 */
export const parseMarkdownContent = async (
    content: string
): Promise<TProcessedMarkdown> => {
    const processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(tocPlugin)
        .use(remarkRehype)
        .use(rehypeSlug)
        .use(rehypeStringify);

    const result = await processor.process(content);

    return {
        html: String(result),
        toc: result.data.toc as TTocItem[],
    };
};

// 사용
// const content = await loadMarkdownFile('article.md');
// const { html, toc } = await parseMarkdownContent(content);

export class MarkdownProcessor {
    // 1. The processor is now a private static property.
    // It's created only once and shared across all calls.
    private static processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(tocPlugin)
        .use(remarkRehype)
        .use(rehypeSlug)
        .use(rehypeHighlight)
        .use(rehypeStringify);

    // 2. The process method is now static.
    // It uses `this.processor` which refers to the static property.
    public static async process(content: string): Promise<TProcessedMarkdown> {
        const result = await this.processor.process(content);

        return {
            html: String(result),
            toc: result.data.toc as TTocItem[],
        };
    }
}
