import { MOCK_DASHBOARD_SNAPSHOT } from '@/apis/getDashboardSnapshot.mock.api';
import ChartVariantLayout from '@/components/dashboard/ChartVariantLayout.client';

interface DashboardPageProps {
    params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: DashboardPageProps) {
    const { username } = await params;
    const displayName = username.replace(/^@/, '');
    return {
        title: `${displayName}'s Dashboard | Taek Lim`,
        description: `Financial markets dashboard for ${displayName} — candlestick charts across FX, crypto, indices, rates and stocks.`,
    };
}

// Cycle 3 (page conversion): per-username route renders the same adopted
// Variant C dashboard. Mock data for now — swap for backend-backed server
// actions in Group B.
export default function DashboardPage() {
    return <ChartVariantLayout snapshot={MOCK_DASHBOARD_SNAPSHOT} />;
}
