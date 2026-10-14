/** Strip rudimentary markdown/HTML and collapse whitespace for plain-text snippets. */
function toPlainText(raw: string): string {
    return raw
        .replace(/<[^>]+>/g, ' ')
        .replace(/[#*`_~[\]()>!|-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function buildDescription(post: {
    description?: string;
    content?: string;
}): string {
    const source =
        post.description ?? (post.content ? toPlainText(post.content) : '');
    return source.length > 160 ? source.slice(0, 157) + '...' : source;
}
