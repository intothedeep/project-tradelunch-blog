import { AdminPostsTable } from '@/components/admin/AdminPostsTable.client';

// Admin moderation route. Thin Server Component shell → client table.
// Auth is gated by middleware (/admin(.*)); the server requireAdmin check is
// the real authorization gate.
export default function AdminPostsPage() {
    return <AdminPostsTable />;
}
