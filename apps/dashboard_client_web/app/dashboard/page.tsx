import { FinancialGridLayout } from '@/components/dashboard/FinancialGridLayout.client';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Financial Dashboard | Taek Lim',
    description:
        'Financial market overview including FX, commodities, rates and institutional holdings.',
};

export default function DashboardPage() {
    return (
        <main className="flex flex-col min-h-screen bg-background p-4 md:p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Markets Overview
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Dashboard for{' '}
                        <span className="font-semibold">@taeklim</span>
                    </p>
                </div>
            </div>

            <div className="w-full">
                <FinancialGridLayout />
            </div>
        </main>
    );
}
