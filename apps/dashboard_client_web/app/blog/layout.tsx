import { ScrollToTopButton } from '@/app/ScrollToTop';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider.client';

// Username-INDEPENDENT blog chrome. This layout sits ABOVE the [username]
// segment so it cannot read params.username — username-dependent chrome
// (category sidebar) lives in app/blog/[username]/layout.tsx and, for the
// /blog index, in the index page itself via <BlogContentShell />.
// Wrapped in ReactQueryProvider because blog interactivity (SaveButton →
// useFavorites/useToggleFavorite) relies on TanStack Query hooks.
export const BlogMainLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <ReactQueryProvider>
            <div className="min-h-screen bg-background text-foreground font-mono">
                <div className="w-full mx-auto p-2 sm:p-4 md:p-8">{children}</div>

                <ScrollToTopButton />
            </div>
        </ReactQueryProvider>
    );
};

export default BlogMainLayout;
