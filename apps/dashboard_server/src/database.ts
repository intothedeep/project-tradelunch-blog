// src/database.ts
// Purpose: Single pg Pool instance targeting Supabase transaction pooler (port 6543).
// Constraint: max:5 — on Vercel Fluid Compute one Function instance serves many
//             concurrent requests, so max:1 would serialize them on a single
//             connection. The Supabase transaction pooler (PgBouncer) tolerates a
//             small pool of short-lived connections, and 5 stays well under
//             Supabase free-tier connection limits.
// Side effects: opens TCP connections on first query.
import { Pool } from 'pg';
import { DATABASE_URL } from './config/env.schema';

export const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    ssl: { rejectUnauthorized: false },
});
