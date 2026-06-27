import { MOCK_DASHBOARD_SNAPSHOT } from '@/apis/getDashboardSnapshot.mock.api';
import { MOCK_DASHBOARD_HISTORY } from '@/apis/getDashboardHistory.mock.api';
import ChartVariantLayout from '@/components/dashboard/ChartVariantLayout.client';

export default function ChartVariantPage() {
    return (
        <ChartVariantLayout
            snapshot={MOCK_DASHBOARD_SNAPSHOT}
            history={MOCK_DASHBOARD_HISTORY}
        />
    );
}
