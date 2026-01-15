
import { sequalizeP, initializeDatabase } from '../src/database';

const run = async () => {
    const db = await initializeDatabase(sequalizeP);

    try {
        console.log('Starting migration to fix categories unique constraint...');

        // 1. Drop existing unique constraint on title if it exists (it might be named categories_title_key by default in PG)
        // We use IF EXISTS to be safe.
        // Also dropping potential other constraint names if they were manually created.
        await db.query(`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_title_key;`);
        
        // 2. Create the new composite unique index/constraint
        // Using CREATE UNIQUE INDEX is functionally equivalent to adding a constraint for enforcement, 
        // and often preferred for performance/flexibility.
        // However, ON CONFLICT usually targets a constraint or unique index. 
        // Let's create a unique index which Postgres uses for ON CONFLICT (col1, col2).
        await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS categories_user_id_title_unique ON categories (user_id, title);`);

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await db.close();
    }
};

run();
