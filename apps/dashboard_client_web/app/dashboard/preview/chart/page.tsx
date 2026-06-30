import { MOCK_DASHBOARD_SNAPSHOT } from '@/apis/getDashboardSnapshot.mock.api';
import ChartVariantLayout from '@/components/dashboard/ChartVariantLayout.client';

export default function ChartVariantPage() {
    return <ChartVariantLayout snapshot={MOCK_DASHBOARD_SNAPSHOT} />;
}
