import { FinancialGridLayout } from "@/components/dashboard/FinancialGridLayout.client";

interface DashboardPageProps {
    params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: DashboardPageProps) {
    const { username } = await params;
    const displayName = username.replace(/^@/, "");
    return {
        title: `${displayName}'s Dashboard | Financial Overview`,
        description: `Financial market overview for ${displayName} — FX, commodities, rates and institutional holdings.`,
    };
}

export default async function DashboardPage({ params }: DashboardPageProps) {
    const { username } = await params;
    const displayName = username.replace(/^@/, "");

    return (
        <main className="flex flex-col min-h-screen bg-background p-4 md:p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Markets Overview
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Dashboard for <span className="font-semibold">@{displayName}</span>
                    </p>
                </div>
            </div>

            <div className="w-full">
                <FinancialGridLayout />
            </div>
        </main>
    );
}
