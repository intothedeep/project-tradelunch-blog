import { QueryTypes, Sequelize, Transaction } from 'sequelize';
import { type TPostFileMeta } from '@repo/markdown-parsing/types';
import { CustomSnowflake } from '@repo/markdown-parsing';

/**
 *
 * 1.
 * table
CREATE TABLE if not exists categories (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title        VARCHAR(100) NOT NULL UNIQUE,
    parent_id   BIGINT NOT NULL,
    root_id     BIGINT NOT NULL,
    level       INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP DEFAULT NULL
);

 */
export const insertCategories = async (
    db: Sequelize,
    meta: TPostFileMeta,
    tx: Transaction
) => {
    const [root, ...children] = meta?.categories ?? [];

    if (!root) {
        console.log('no categories found');
        return;
    }

    // 1. Handle the root category.
    // Use ON CONFLICT to update if it already exists.
    // We can't know the id for parent_id and root_id before insertion, so we insert with a placeholder (0) and then update it.
    // If a category that was a child is now a root, its level will be updated to 0.

    const generatedRootId = CustomSnowflake.generate();
    const [rootResult] = (await db.query(
        `
        INSERT INTO categories (id, group_id, title, user_id)
        VALUES (:id, :id, :title, :userId)
        ON CONFLICT (user_id, title) DO UPDATE SET
            level = EXCLUDED.level,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id`,
        {
            replacements: { id: generatedRootId, title: root, userId: meta.userId },
            transaction: tx,
            type: QueryTypes.SELECT,
        }
    )) as { id: string }[];

    const rootId = rootResult.id;


    let parentId = rootId;

    // 2. Handle children categories
    for (const [index, childName] of children.entries()) {
        const level = index + 1;
        // Insert child, or update it if it exists.
        // This handles cases where a category might be moved under a different parent.
        const generatedChildId = CustomSnowflake.generate();
        const [childResult] = (await db.query(
            `
            INSERT INTO categories (id, group_id, parent_id, level, title, user_id)
                VALUES (:id, :groupId, :parentId, :level, :title, :userId)
                ON CONFLICT (user_id, title) DO UPDATE SET
                    level = EXCLUDED.level,
                    parent_id = EXCLUDED.parent_id,
                    group_id = EXCLUDED.group_id,
                    user_id = EXCLUDED.user_id,
                    updated_at = CURRENT_TIMESTAMP
            RETURNING id`,
            {
                replacements: {
                    id: generatedChildId,
                    groupId: rootId,
                    level,
                    parentId,
                    title: childName,
                    userId: meta.userId,
                },
                transaction: tx,
                type: QueryTypes.SELECT,
            }
        )) as { id: string }[];

        parentId = childResult.id;
    }

    return parentId;
};
