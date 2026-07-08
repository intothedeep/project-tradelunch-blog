// Server component (no "use client"). Emits schema.org JSON-LD.
// Escape `<` → < so user-authored content (post title/description) can
// never break out of the <script> tag via a literal `</script>` (XSS guard);
// JSON.stringify alone does not escape `<`.
function serialize(obj: object): string {
    return JSON.stringify(obj).replace(/</g, '\\u003c');
}

export function JsonLd({ data }: { data: object | object[] }) {
    const items = Array.isArray(data) ? data : [data];
    return (
        <>
            {items.map((obj, index) => (
                <script
                    key={index}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: serialize(obj) }}
                />
            ))}
        </>
    );
}
