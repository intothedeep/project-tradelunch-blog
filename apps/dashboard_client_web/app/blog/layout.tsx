import { ScrollToTopButton } from '@/app/ScrollToTop';

// Username-INDEPENDENT blog chrome. This layout sits ABOVE the [username]
// segment so it cannot read params.username — username-dependent chrome
// (category sidebar) lives in app/blog/[username]/layout.tsx and, for the
// /blog index, in the index page itself via <BlogContentShell />.
//
// NOTE: no padding/min-h-screen wrapper here — the child BlogShell is the
// full-bleed shell (its own min-h-screen + centered, padded main), exactly as
// on `/`. A wrapping `p-2 sm:p-4 md:p-8` here used to push the whole shell in
// and add a top gap that `/` did not have (inconsistent chrome). We keep only
// the monospace aesthetic and the scroll-to-top affordance.
export const BlogMainLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="font-mono">
            {children}
            <ScrollToTopButton />
        </div>
    );
};

export default BlogMainLayout;
