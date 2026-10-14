// Purpose: the blocking <head> script that copies the `railCollapsed` cookie onto
// `<html data-rail>` before first paint, so CSS picks the rail width without the
// server reading the cookie (cc.design.md R-A). Plain string, no imports: it is
// inlined verbatim into the HTML.
// Invariant: collapsed only when the cookie is exactly `railCollapsed=1`
// (same rule as parseRailCollapsedCookie in store/layout.atom).

export const RAIL_INIT_SCRIPT =
    '(function(){try{var c=/(?:^|;\\s*)railCollapsed=1(?:;|$)/.test(document.cookie);' +
    "document.documentElement.setAttribute('data-rail',c?'collapsed':'expanded')}catch(e){}})()";
