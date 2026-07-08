// src/database.ts
// Single pg Pool targeting the finance Oracle VM PG17 instance.
// SSL: Oracle VM presents a self-signed cert — rejectUnauthorized:false accepts it.
// Side effects: opens TCP connections on first query.
import { Pool } from 'pg';
import { DATABASE_URL } from './config/env.schema';

function stripSslmode(url?: string): string | undefined {
    if (!url) return url;
    try {
        const u = new URL(url);
        u.searchParams.delete('sslmode');
        u.searchParams.delete('pgbouncer');
        return u.toString();
    } catch {
        return url;
    }
}

export const pool = new Pool({
    connectionString: stripSslmode(DATABASE_URL),
    max: 10,
    ssl: { rejectUnauthorized: false },
});
