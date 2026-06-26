import { EFileExt, PostFileNode } from '@/src/markdown/FileSystem.model';
import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';

export const getPostSlug = (fileName: string) => {
    return fileName.toLocaleLowerCase().replace('.md', '').replace(/\./gi, '-');
};

export const parseMarkdownPath = (folderpath: string, slug: string) => {
    const filename = `${slug}.md`;
    const categories = folderpath.split('/');

    return { filename, categories };
};

export function extractMarkdownFile(
    base: string,
    folderpath: string,
    slug: string
): PostFileNode {
    const { filename, categories } = parseMarkdownPath(folderpath, slug);

    const filepath = path.join(process.cwd(), base, folderpath, slug, filename);

    const raw = fs.readFileSync(filepath, 'utf-8');

    const { data: metadata, content } = matter(raw);

    console.log(filepath);

    const file = new PostFileNode(filename, categories.length);
    file.setMetadata(metadata);
    file.setSlug(slug);
    file.setContent(content);
    file.setCategories(categories);
    file.setFileExt(EFileExt.MD);

    file.print();

    return file;
}

// var file: PostFileNode = extractMarkdownFile(
// 	"data",
// 	"java/spring/jdbc",
// 	"java-spring-jdbc"
// );

// file.print();
