import matter from 'gray-matter';
import path from 'path';
import fs from 'fs';
import { PostFileNode, FolderNode } from '@/src/markdown/FileSystem.model';
import { get } from 'http';
import { getPostSlug } from '@/src/markdown/extract.file.lib';

/**
 *
 * @param path
 * @returns return dirs based on path
 */
export async function takeDirectoryReturnList(
    base: string,
    filename: string,
    level = 0,
    categories: string[] = []
) {
    const folder = new FolderNode(filename, level);

    const nodes = fs.readdirSync(path.join(process.cwd(), base, filename), {
        withFileTypes: true,
    });

    for (const node of nodes) {
        // TODO: delete?
        const { name, parentPath } = node;

        let child: FolderNode | PostFileNode;

        if (node.isDirectory()) {
            child = await takeDirectoryReturnList(parentPath, name, level + 1, [
                ...categories,
                name,
            ]);
        } else {
            if (name.indexOf('.md') == -1) {
                console.error('not a md file:', name);
                continue;
            }

            const filePath = path.join(parentPath, name);
            const fileContent = fs.readFileSync(filePath, 'utf8');

            const { data: metadata, content } = matter(fileContent);
            const title = name.replace('.md', '');

            child = new PostFileNode(name, level + 1);
            child.setMetadata(metadata);
            child.setSlug(getPostSlug(name));
            child.setContent(content);

            child.print();
        }

        folder.add(child);
    }

    return folder;
}

// const root = takeDirectoryReturnList('data', '', -1);
// root.then((r) => r.print());

function flattenTree(
    node: FolderNode | PostFileNode
): (FolderNode | PostFileNode)[] {
    const result: (FolderNode | PostFileNode)[] = [];

    function traverse(n: FolderNode | PostFileNode) {
        result.push(n);

        if (n instanceof FolderNode && n.children.length > 0) {
            for (const child of n.children) {
                traverse(child);
            }
        }
    }

    traverse(node);
    return result;
}

// root
// 	.then((r) => {
// 		r.toString();
// 		return r;
// 	})
// 	.then(flattenTree)
// 	.then((flat) => {
// 		console.log("Flattened Tree:");
// 		flat.forEach((item) => {
// 			console.log(item);
// 		});
// 	});
