import { readFileSync } from 'node:fs';

/**
 * @description Loads the content of a markdown file.
 * @param filePath The path to the Markdown file.
 * @returns A Promise that resolves to the file content as a string.
 */
export const loadMarkdownFile = (filePath: string) => {
    const content = readFileSync(filePath, 'utf8');
    return content;
};
