// Finance app root — placeholder until P3 routes land.
// The real dashboard route is /dashboard; redirect once it exists.
// For now, render a minimal placeholder so the app boots without error.
export default function FinanceRootPage() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <p className="text-muted-foreground text-sm">
                Finance app — routes land in P3.
            </p>
        </div>
    );
}
