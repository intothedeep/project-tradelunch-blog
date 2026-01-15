
import { sequalizeP, initializeDatabase } from '../src/database';

const run = async () => {
    const db = await initializeDatabase(sequalizeP);

    try {
        console.log('Starting migration to fix posts and files unique constraints...');

        // 1. Posts: Add unique constraint on (user_id, slug)
        // Cleanup duplicates first
        await db.query(`DELETE FROM posts a USING posts b WHERE a.id < b.id AND a.user_id = b.user_id AND a.slug = b.slug;`);
        console.log('Cleaned up duplicate posts');
        
        // Drop potential existing constraints to be safe
        await db.query(`ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_slug_key;`);
        await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS posts_user_id_slug_unique ON posts (user_id, slug);`);
        console.log('Added unique index on posts(user_id, slug)');

        // 2. Files: Add unique constraint on (user_id, stored_name)
        // Cleanup duplicates first
        await db.query(`DELETE FROM files a USING files b WHERE a.id < b.id AND a.user_id = b.user_id AND a.stored_name = b.stored_name;`);
        console.log('Cleaned up duplicate files');

        // stored_name is typically "slug.ext" or similar, unique per user's upload context usually.
        await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS files_user_id_stored_name_unique ON files (user_id, stored_name);`);
        console.log('Added unique index on files(user_id, stored_name)');

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await db.close();
    }
};

run();
