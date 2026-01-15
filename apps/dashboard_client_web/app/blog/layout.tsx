import { CategoryErrorBoundary } from '@/app/blog/_components/CategoryErrorboundary.client';
import { CategorySidebarWrapper } from '@/app/blog/_components/CategorySidebarWrapper.server';
import { RightTechStackCard } from '@/app/blog/_components/RightTechStackCard.client';
import { ScrollToTopButton } from '@/app/ScrollToTop';
import { cn } from '@/lib/utils';

export const BlogMainLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            <div className="w-full mx-auto p-2 sm:p-4 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                    {/* Left Sidebar - Categories & Tech Stack */}
                    <aside className={cn('order-1', 'lg:col-span-1')}>
                        <div
                            className={cn(
                                'space-y-0 lg:space-y-4',
                                'lg:sticky lg:top-4'
                            )}
                        >
                            <CategoryErrorBoundary>
                                <CategorySidebarWrapper />
                            </CategoryErrorBoundary>
                            <RightTechStackCard />
                        </div>
                    </aside>

                    {/* Main Content - Takes more space */}
                    <main
                        className={cn(
                            'order-2',
                            'space-y-4 md:space-y-6',
                            'lg:col-span-4 xl:col-span-5'
                        )}
                    >
                        {children}
                    </main>
                </div>
            </div>

            <ScrollToTopButton />
        </div>
    );
};

export default BlogMainLayout;
