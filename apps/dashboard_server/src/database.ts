// src/database.ts
// Purpose: Single pg Pool instance targeting Supabase transaction pooler (port 6543).
// Constraint: max:1 is intentional for Supabase transaction-mode pooler (PgBouncer).
// Side effects: opens TCP connections on first query.
import { Pool } from 'pg';
import { DATABASE_URL } from '@/src/config/env.schema';

export const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1,
    ssl: { rejectUnauthorized: false },
});
