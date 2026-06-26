// lib/markdownToReact.tsx
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkToc from 'remark-toc';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype'; // ★ 추가

import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';

// import rehypeReact from 'rehype-react';

import { tocPlugin } from '@/src/markdown/markdown.toc';

export async function markdownToStr(markdown: string) {
    const file = await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(tocPlugin)
        .use(remarkToc, { heading: 'Table of Contents' })
        .use(remarkMath)
        .use(remarkRehype) // ★ Markdown(AST) → HTML(AST)

        .use(rehypeSlug)
        .use(rehypeAutolinkHeadings, {
            behavior: 'wrap',
            properties: { className: ['anchor-link'] },
        })
        .use(rehypeKatex)
        .use(rehypeHighlight)
        .use(rehypeStringify)
        // .use(rehypeReact, {
        //     createElement: React.createElement,
        //     Fragment: React.Fragment,
        //     components: {
        //         h1: (props: any) => (
        //             <h1
        //                 className="text-3xl font-bold my-4"
        //                 {...props}
        //             />
        //         ),
        //         h2: (props: any) => (
        //             <h2
        //                 className="text-2xl font-semibold my-3"
        //                 {...props}
        //             />
        //         ),
        //         code: (props: any) => (
        //             <code
        //                 className="bg-gray-100 rounded px-1 py-0.5"
        //                 {...props}
        //             />
        //         ),
        //     },
        // })
        .process(markdown);
    console.log(file);
    return file.value;
}
