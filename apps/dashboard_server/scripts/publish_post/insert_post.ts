import { CustomSnowflake } from '@repo/markdown-parsing';
import { type TPostFileMeta } from '@repo/markdown-parsing';
import { QueryTypes, Sequelize, Transaction } from 'sequelize';

export const insertPost = async (
    db: Sequelize,
    meta: TPostFileMeta,
    tx: Transaction
) => {
    console.log('>> Inserting post:', meta.id);
    const generatedPostId = CustomSnowflake.generate();

    const results = (await db.query(
        `
        INSERT INTO
            posts (id, user_id, title, content, status, created_at, updated_at, slug, category_id, group_id)
        VALUES
            (:id, :userId, :title, :content, :status, NOW(), NOW(), :slug, :categoryId, :groupId)
        ON CONFLICT (user_id, slug) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            status = EXCLUDED.status,
            category_id = EXCLUDED.category_id,
            group_id = EXCLUDED.group_id,
            id = EXCLUDED.id,
            updated_at = NOW()
        RETURNING id
    `,
        {
            replacements: {
                id: generatedPostId,
                groupId: generatedPostId,
                slug: meta.slug,
                userId: meta.userId,
                title: meta.title,
                content: meta.content,
                status: meta.status || 'public',
                categoryId: meta.categoryId,
            },
            type: QueryTypes.SELECT,
            transaction: tx,
        }
    )) as Array<{ id: number }>;

    const insertedId = results[0]?.id;
    console.log('>> meta.id:', meta.id);
    console.log(`>> Inserted post: ${insertedId}`);
    return insertedId;
};
