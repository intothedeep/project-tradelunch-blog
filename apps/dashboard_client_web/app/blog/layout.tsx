import { ScrollToTopButton } from '@/app/ScrollToTop';

// Username-INDEPENDENT blog chrome. This layout sits ABOVE the [username]
// segment so it cannot read params.username — username-dependent chrome
// (category sidebar) lives in app/blog/[username]/layout.tsx and, for the
// /blog index, in the index page itself via <BlogContentShell />.
export const BlogMainLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            <div className="w-full mx-auto p-2 sm:p-4 md:p-8">{children}</div>

            <ScrollToTopButton />
        </div>
    );
};

export default BlogMainLayout;
