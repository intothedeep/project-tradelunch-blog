import { Metadata } from 'next';
import { MOCK_DASHBOARD_SNAPSHOT } from '@/apis/getDashboardSnapshot.mock.api';
import { MOCK_DASHBOARD_HISTORY } from '@/apis/getDashboardHistory.mock.api';
import ChartVariantLayout from '@/components/dashboard/ChartVariantLayout.client';

export const metadata: Metadata = {
    title: 'Dashboard | Taek Lim',
    description:
        'Financial markets dashboard — interactive candlestick charts across FX, crypto, indices, rates and stocks.',
};

// Cycle 3 (page conversion): /dashboard now renders the adopted Variant C
// trading dashboard. Data is still the Cycle 2 mock — swap for the
// getDashboardSnapshot/History server actions once the backend is ready.
export default function DashboardPage() {
    return (
        <ChartVariantLayout
            snapshot={MOCK_DASHBOARD_SNAPSHOT}
            history={MOCK_DASHBOARD_HISTORY}
        />
    );
}
