import { it } from 'node:test';
import { extractMarkdownFile } from './extract.file.lib';
import { PostFileNode } from '.';

it('should extract metadata from markdown files', () => {
    var file: PostFileNode = extractMarkdownFile(
        'data',
        'java/spring/jdbc',
        'java-spring-jdbc'
    );

    file.print();
});
