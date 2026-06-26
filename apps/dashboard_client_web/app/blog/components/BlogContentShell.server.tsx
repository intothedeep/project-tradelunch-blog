import { CategoryErrorBoundary } from '@/app/blog/components/CategoryErrorboundary.client';
import { CategorySidebarWrapper } from '@/app/blog/components/CategorySidebarWrapper.server';
import { RightTechStackCard } from '@/app/blog/components/RightTechStackCard.client';
import { cn } from '@/lib/utils';

// Username-dependent blog content shell: category sidebar (scoped to the
// author) + main content column. Username must be supplied (already stripped
// of any leading '@').
type Props = {
    username: string;
    children: React.ReactNode;
};

export const BlogContentShell = ({ username, children }: Props) => {
    return (
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
                        <CategorySidebarWrapper username={username} />
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
    );
};

export default BlogContentShell;
