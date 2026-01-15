import { type TPostFileMeta } from '@repo/markdown-parsing/src/types';
import { Sequelize, Transaction } from "sequelize";

export const insertImage = async (
	db: Sequelize,
	meta: TPostFileMeta,
	tx: Transaction
) => {
	await db.query(
		`
        INSERT INTO 
            files (id, user_id, post_id, content_type, ext, original_filename, stored_name, stored_uri, file_size, is_thumbnail, created_at, updated_at, deleted_at)
            VALUES (:id, :user_id, :post_id, :content_type, :ext, :original_filename, :stored_name, :stored_uri, :file_size, :is_thumbnail, NOW(), NOW(), NULL)
            ON CONFLICT (user_id, stored_name) DO UPDATE SET
                post_id = EXCLUDED.post_id,
                -- stored_uri might change if we re-upload? Assuming yes.
                stored_uri = EXCLUDED.stored_uri,
                file_size = EXCLUDED.file_size,
                is_thumbnail = EXCLUDED.is_thumbnail,
                updated_at = NOW()
        `,
		{
			replacements: {
				id: meta.id!,
				post_id: meta.postId!,
				user_id: meta.userId!,
				content_type: meta.contentType,
				ext: meta.ext,
				original_filename: meta.filename,
				stored_name: meta.storedName,
				stored_uri: meta.storedUri,
				file_size: meta.fileSize,
				is_thumbnail: true,
			},
			transaction: tx,
		}
	);
	console.log(`Inserted image meta for post_id=${meta.postId}`);
};
