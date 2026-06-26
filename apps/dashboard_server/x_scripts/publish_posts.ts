// import { extractMarkdownFile } from '@/lib/extract.file.lib';
import { insertCategories } from '@/scripts/publish_post/insert_categories';
import { insertImage } from '@/scripts/publish_post/insert_image';
import { insertPost } from '@/scripts/publish_post/insert_post';
import {
    load_local_file,
    upload_file_s3,
} from '@/scripts/publish_post/upload_image';

import { initializeDatabase, sequalizeP } from '@/src/database';
import { CDN_ASSET_POSTS, DEFAULT_USER_ID } from '@/src/config/env.schema';

import { Sequelize, Transaction } from 'sequelize';

import { TPostFileMeta } from '@repo/markdown-parsing';
import { CustomSnowflake, extractMarkdownFile } from '@repo/markdown-parsing';

const default_args: any = {
    base: 'data',
    folderPath: 'DSA',
    slug: 'when-to-mark-visited',
    fileExt: 'png',
};

const run = async ({
    base = 'data',
    folderPath = 'java/spring/jdbc',
    slug = 'java-spring-jdbc',
    fileExt = 'png',
}: {
    base?: string;
    folderPath?: string;
    slug?: string;
    fileExt?: string;
} = {}) => {
    const extractedMDFile = extractMarkdownFile(base, folderPath, slug);

    let db: Sequelize | undefined = undefined;
    let tx: Transaction | null = null;

    try {
        db = await initializeDatabase(sequalizeP);
        if (!db) throw new Error('Database connection not established.');

        tx = await db.transaction(); // 트랜잭션 시작

        const metaId = CustomSnowflake.generate();

        let meta: TPostFileMeta = {
            id: metaId,
            postId: metaId,
            base,
            folderPath,
            slug,
            filename: `${slug}.${fileExt}`,

            // post meta
            title: extractedMDFile.title,
            desc: extractedMDFile.desc,
            date: extractedMDFile.date,
            status: extractedMDFile.status,
            content: extractedMDFile.content,
            categories: folderPath.split('/'),
        };
        // TODO: Hard Coding userId
        meta.userId = String(DEFAULT_USER_ID);

        // 2. load local file
        const { buffer, contentType, fullPath, fileSize } =
            await load_local_file(base, folderPath, slug, fileExt);

        // 3. upload file to S3
        meta = {
            ...meta,
            filename: `${slug}.${fileExt}`,
            buffer,
            contentType,
            ext: fileExt,
            fileSize,
            isThumbnail: true,
        };

        meta = await upload_file_s3(meta);

        const thumbnail_url = `${CDN_ASSET_POSTS}/${meta.storedUri}`;

        // Regex: matches ![Alt text](./filename.png "Title")
        const updated = meta.content?.replace(
            /!\[([^\]]*)\]\(\.\/([^)\s]+)(?:\s+"([^"]*)")?\)/g,
            (_, alt, filename, title) => {
                return title
                    ? `![${alt}](${thumbnail_url} "${title}")`
                    : `![${alt}](${thumbnail_url})`;
            }
        );

        meta.content = updated || meta.content;

        // 1. insert categories
        meta.categoryId = await insertCategories(db, meta, tx);

        // 2. insert post
        const postId = await insertPost(db, meta, tx);
        
        // Update meta with the actual persistent ID
        // meta.id = String(postId);
        meta.postId = String(postId);

        // 4. insert image meta (same transaction)
        await insertImage(db, meta, tx);

        // 트랜잭션 커밋
        await tx.commit();

        console.log('✅ Transaction committed successfully.');
    } catch (err) {
        if (tx) await tx.rollback();
        console.error('❌ Transaction rolled back due to error:', err);
    } finally {
        if (db) await db.close();
        process.exit(0);
    }
};

run(default_args);
