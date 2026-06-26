// src/database.ts
// Purpose: Single pg Pool instance targeting Supabase pooler.
// Constraint: max:5 — on Vercel Fluid Compute one Function instance serves many
//             concurrent requests, so max:1 would serialize them on a single
//             connection. The Supabase pooler (PgBouncer) tolerates a small pool
//             of short-lived connections, and 5 stays under free-tier limits.
// SSL: Supabase presents a self-signed cert chain. node-pg maps a connection
//      string's `sslmode=require` to rejectUnauthorized:true (full verify), which
//      then fails with "self-signed certificate in certificate chain" even though
//      we pass ssl.rejectUnauthorized:false. Strip `sslmode` so our explicit ssl
//      config is the sole governor and accepts the chain.
// Side effects: opens TCP connections on first query.
import { Pool } from 'pg';
import { DATABASE_URL } from './config/env.schema';

function stripSslmode(url?: string): string | undefined {
    if (!url) return url;
    try {
        const u = new URL(url);
        u.searchParams.delete('sslmode');
        return u.toString();
    } catch {
        return url;
    }
}

export const pool = new Pool({
    connectionString: stripSslmode(DATABASE_URL),
    max: 5,
    ssl: { rejectUnauthorized: false },
});
