import ReactMarkdown, {
    type Components,
    type ExtraProps,
} from 'react-markdown';
import type { PluggableList } from 'unified';

// remark plugins (operate on Markdown syntax)
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';

// rehype
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';

const remarkPlugins = [
    remarkGfm, // tables, strikethrough, autolinks
    remarkBreaks, // treat line breaks as <br>
    remarkMath, // support $...$ and $$...$$ math
];

const rehypePlugins: PluggableList = [
    rehypeRaw,
    rehypeSlug,
    [rehypeAutolinkHeadings, { behavior: 'wrap' }],
    rehypeKatex,
    // [rehypePrismPlus, { showLineNumbers: true }], // syntax highlighting
];

// react-markdown passes an internal `node` (hast element) prop to every
// renderer. It must be stripped before spreading onto an intrinsic element,
// otherwise it would leak onto the DOM. This helper removes it in one place.
const stripNode = <T extends ExtraProps>(props: T): Omit<T, 'node'> => {
    const { node: _node, ...rest } = props;
    void _node;
    return rest;
};

type CodeProps = React.ComponentPropsWithoutRef<'code'> &
    ExtraProps & { inline?: boolean };

const prismTheme = oneDark as { [key: string]: React.CSSProperties };

const remarkComponents: Components = {
    h1: (props) => (
        <h1
            className="text-3xl font-semibold my-4 pb-2 text-primary"
            {...stripNode(props)}
        />
    ),
    h2: (props) => (
        <h2
            className="text-2xl font-semibold my-3"
            {...stripNode(props)}
        />
    ),
    h3: (props) => (
        <h3
            className="text-xl font-semibold my-2"
            {...stripNode(props)}
        />
    ),
    p: (props) => (
        <p
            className="my-2 leading-relaxed text-gray-800 dark:text-gray-200"
            {...stripNode(props)}
        />
    ),
    pre: ({ node: _node, ...props }) => {
        void _node;
        // The original `pre` content is rendered inside a styled <div>; the
        // incoming props are typed for <pre>, so coerce to <div> attributes.
        const divProps = props as React.ComponentPropsWithoutRef<'div'>;
        return (
            <div
                className="rounded-lg my-3 overflow-x-auto bg-[#282c34] text-gray-100 p-4"
                {...divProps}
            />
        );
    },
    code({
        inline,
        className,
        children,
        node: _node,
        // `style` is intentionally dropped: the highlighter owns its theme.
        style: _style,
        ...props
    }: CodeProps) {
        void _node;
        void _style;
        const match = /language-(\w+)/.exec(className || '');

        return !inline && match ? (
            <SyntaxHighlighter
                style={prismTheme}
                language={match[1]}
                PreTag="div"
                {...props}
            >
                {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
        ) : (
            <code
                className="bg-gray-800 text-gray-100 px-1 py-0.5 rounded"
                {...props}
            >
                {children}
            </code>
        );
    },
    a: (props) => (
        <a
            className="text-primary hover:underline hover:text-foreground/90"
            // target="_blank"
            rel="noopener noreferrer"
            {...stripNode(props)}
        />
    ),
    ul: (props) => (
        <ul
            className="list-disc ml-6 mb-3"
            {...stripNode(props)}
        />
    ),
    ol: (props) => (
        <ol
            className="list-decimal ml-6 mb-3"
            {...stripNode(props)}
        />
    ),
    blockquote: (props) => (
        <blockquote
            className="border-l-4 border-gray-400 pl-4 italic text-gray-600"
            {...stripNode(props)}
        />
    ),
};

export const MarkdownRenderer = ({ content }: { content: string }) => {
    return (
        <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={remarkComponents}
        >
            {content}
        </ReactMarkdown>
    );
};
