// Username-INDEPENDENT blog chrome. This layout sits ABOVE the [username]
// segment so it cannot read params.username — username-dependent chrome
// (category sidebar) lives in app/blog/[username]/layout.tsx and, for the
// /blog index, in the index page itself via <BlogContentShell />.
//
// NOTE: no chrome wrapper here — the child BlogShell is the full-bleed shell
// (its own min-h-screen + centered, padded main + the `font-mono` aesthetic),
// exactly as on `/`. The font now lives on BlogShell, shared by both. The
// scroll-to-top affordance is now GLOBAL (mounted once in the root layout), so
// this layout is a pure pass-through boundary kept for the segment hierarchy.
export const BlogMainLayout = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};

export default BlogMainLayout;
