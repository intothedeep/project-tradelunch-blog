export type TTocItem = {
    depth: number;
    text: string;
    slug: string;
};

export type TNestedTocItem = TTocItem & {
    children: TNestedTocItem[];
};

export type Article = {
    id: number;
    title: string;
    content: string;
    html: string;
    toc: TTocItem[];
    createdAt: Date;
};

export type TProcessedMarkdown = {
    html: string;
    toc: TTocItem[];
};
