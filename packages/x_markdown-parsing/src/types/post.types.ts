export type TFileMeta = {
    filename: string;
    storedName: string;
    storedUri: string;
    categories: string[];
    tags: string[];
};

export type TPostFileMeta = {
    // local
    base: string;
    folderPath: string;
    slug: string;

    // meta
    buffer?: Buffer;
    filename?: string;
    storedName?: string;
    storedUri?: string;

    id?: string;
    ext?: string;
    userId?: string;
    postId?: string;
    contentType?: string;
    fileSize?: number;
    isThumbnail?: boolean;

    // post meta
    title?: string;
    desc?: string;
    date?: string;
    status?: string;
    content?: string;
    categories?: string[];
    categoryId?: string;
    tags?: string[];
};
