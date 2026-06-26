import { CustomSnowflake } from '@/src/CustomSnowflake.module';

export enum EFileSystemNodeEnum {
    FOLDER = 'FOLDER',
    FILE = 'FILE',
}

export enum EFileExt {
    MD = 'md',
    PDF = 'pdf',
    PNG = 'png',
    JPG = 'jpg',
    JPEG = 'jpeg',
    GIF = 'gif',
    SVG = 'svg',
    TXT = 'txt',
    DOC = 'doc',
    DOCX = 'docx',
    XLS = 'xls',
    XLSX = 'xlsx',
    PPT = 'ppt',
    PPTX = 'pptx',
}

export enum EImageFileExt {
    PNG = 'png',
    JPG = 'jpg',
    JPEG = 'jpeg',
    GIF = 'gif',
    SVG = 'svg',
    WEBP = 'webp',
    BMP = 'bmp',
    TTF = 'ttf',
}

// Base class
export abstract class FileSystemNode {
    name: string;
    level: number;
    abstract type: EFileSystemNodeEnum;

    constructor(name: string, level: number = 0) {
        this.name = name;
        this.level = level;
    }

    abstract toString(): string;
    abstract print(): void;
}

const MACHINE_ID = process.env.MACHINE_ID || 1;

// File (Leaf)
export class PostFileNode extends FileSystemNode {
    type: EFileSystemNodeEnum = EFileSystemNodeEnum.FILE;
    id: string;
    userId?: string;
    username?: string;
    desc?: string;
    title?: string;
    date?: string;
    tags?: string[];
    slug?: string;
    categories?: string[];
    status?: string;
    content?: string;
    fileExt?: string;

    constructor(name: string, level: number) {
        super(name, level);
        this.id = `${CustomSnowflake.generate()}`;
    }

    setSlug(slug: string) {
        this.slug = slug;
    }

    setContent(content: string) {
        this.content = content;
    }
    setFileExt(fileExt: string) {
        this.fileExt = fileExt;
    }
    setCategories(categories: string[]) {
        this.categories = categories;
    }

    setMetadata(metadata: any) {
        this.title = metadata.title;
        this.tags = metadata.tags;
        this.desc = metadata.desc;
        this.date = metadata.date;
        this.userId = metadata.userId;
        this.username = metadata.username;
        this.content = metadata.content;
        this.slug = metadata.slug;
        this.status = metadata.status;
        this.categories = metadata.categories;
        this.tags = metadata.tags;
    }

    toString(): string {
        const prefix = '--'.repeat(this.level + 1);
        let str = `${prefix}- ${this.name} (ID: ${this.id})\n`;
        if (this.title) str += `${prefix}  Title: ${this.title}\n`;
        if (this.date) str += `${prefix}  Date: ${this.date}\n`;
        if (this.userId) str += `${prefix}  Author: ${this.userId}\n`;
        if (this.tags) str += `${prefix}  Tags: ${this.tags.join(', ')}\n`;
        if (this.categories)
            str += `${prefix}  Categories: ${this.categories.join(', ')}\n`;
        if (this.status) str += `${prefix}  Status: ${this.status}\n`;
        if (this.desc) str += `${prefix}  Description: ${this.desc}\n`;
        if (this.slug) str += `${prefix}  Slug: ${this.slug}\n`;
        if (this.content)
            str += `${prefix}  Content: ${this.content.slice(0, 30)}...\n`;

        return str;
    }

    print(): void {
        console.log(`Metadata of ${this.name}:`);
        console.log(`  ID: ${this.id}`);
        if (this.title) console.log(`  Title: ${this.title}`);
        if (this.date) console.log(`  Date: ${this.date}`);
        if (this.userId) console.log(`  Author: ${this.userId}`);
        if (this.tags) console.log(`  Tags: ${this.tags.join(', ')}`);
        if (this.categories)
            console.log(`  Categories: ${this.categories.join(', ')}`);
        if (this.status) console.log(`  Status: ${this.status}`);
        if (this.desc) console.log(`  Description: ${this.desc}`);
        if (this.slug) console.log(`  Slug: ${this.slug}`);
        if (this.content)
            console.log(`  Content: ${this.content.slice(0, 30)}...`);
    }
}

// Folder (Composite)
export class FolderNode extends FileSystemNode {
    type: EFileSystemNodeEnum = EFileSystemNodeEnum.FOLDER;

    children: (PostFileNode | FolderNode)[] = [];

    constructor(name: string, level: number) {
        super(name, level);
    }

    add(child: PostFileNode | FolderNode) {
        this.children.push(child);
    }

    toString(): string {
        const prefix = '--'.repeat(this.level + 1);
        return `Folder Meta: ${prefix} ${this.type} ${this.name}`;
    }

    print(): void {
        const prefix = '[][][]'.repeat(this.level + 1);
        let result = `${prefix}- ${this.name}/\n`;
        console.log(prefix, this.type, this.name);

        for (const child of this.children) {
            child.print();
        }
    }
}
