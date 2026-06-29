import { ScrollToTopButton } from '@/app/ScrollToTop';

// Username-INDEPENDENT blog chrome. This layout sits ABOVE the [username]
// segment so it cannot read params.username — username-dependent chrome
// (category sidebar) lives in app/blog/[username]/layout.tsx and, for the
// /blog index, in the index page itself via <BlogContentShell />.
//
// NOTE: no chrome wrapper here — the child BlogShell is the full-bleed shell
// (its own min-h-screen + centered, padded main + the `font-mono` aesthetic),
// exactly as on `/`. A wrapping `p-2 sm:p-4 md:p-8` here used to push the whole
// shell in / add a top gap `/` lacked, and a `font-mono` div here applied mono
// to `/blog/*` but NOT `/` (which never passes through this layout) — both made
// the chrome inconsistent. The font now lives on BlogShell, shared by both. We
// keep only the scroll-to-top affordance.
export const BlogMainLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <>
            {children}
            <ScrollToTopButton />
        </>
    );
};

export default BlogMainLayout;
