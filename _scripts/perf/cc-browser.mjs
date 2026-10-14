#!/usr/bin/env node
// _scripts/perf/cc-browser.mjs
// Phase CC browser measurement (cc.design.md §5): the metrics cc-measure.mjs cannot see.
// Playwright + chromium, anonymous and signed-in arms. Runs on GitHub Actions only
// (.github/workflows/cc-browser-measure.yml), never on the owner's Mac.
//
// Measures (design id -> metric name in summary.csv):
//   U2   w2_back3_rsc            _rsc requests during 3 x browser Back at the end of W1
//        w2_back3_rsc_nonprefetch   the same, without prefetch requests
//   G-a  g_a_max_10s             max same-host requests (no /_next/) in any 10 s window, W1+W3+W4
//   G-b  g_b_prefetch_per_menu_link_{max,mean}, g_b_card_prefetch_total   (W4)
//   G-f  g_f_hydration_errors    console/page errors that look like hydration, all walks
//   G-g  g_g_private_status      anonymous GET of --private-path (needs the flag)
//   nav  w1_<step>_nav_ms        from the `[nav]` console line (instrumentation-client.ts)
//
// Prefetch marker (Next 16.2.9, node_modules/next/dist/client/components/segment-cache/cache.js
// lines 993-994, 1218-1219, 1295-1296, 1398-1403): every prefetch request carries the header
// `next-router-prefetch: 1` (or `2`), segment prefetches also `next-router-segment-prefetch: <path>`.
// A real navigation carries `next-router-state-tree` and no prefetch header (fetch-server-response.js:82).
// The `_rsc` query is on both, so "prefetch" is decided by the header, never by the query.
//
// Limits: `[nav]` is not emitted for Back (traverse), so W2 counts requests only. One viewport
// (1440x900). The collapsed rail state runs W1+W2 only (G-f scope). Pace: settle >= 1.5 s after
// every action, 11 s between walks, so the Cloudflare 50 req / 10 s limit (#68) is never near.
//
// Files per run folder (replaces har_summary.py, cc.design.md §14.3): summary.csv (per metric),
// browser_summary.json + browser_summary.txt (_rsc counts, max requests per 10 s, prefetch per link,
// hydration error count, text/x-component byte sum, [nav] lines), nav.log, raw.jsonl.
//
// Usage (CI): node _scripts/perf/cc-browser.mjs --tag baseline1 [--unit QW1] [--web-sha <deployed sha>] [--base https://my.prettylog.com]
//   [--runs 3] [--arms anon,auth] [--rails expanded,collapsed] [--user taeklim]
//   [--project <P> --slug <S>] [--private-path /@taeklim/<private-slug>] [--out deploy/traffic/review/cc/runs]
// The signed-in arm reads CLERK_SECRET_KEY from the environment (never printed).
import { execSync } from 'node:child_process';
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import { openClerkSession } from './clerk-session.mjs';

const CODE_VERSION = 'v2';
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');

function parseArgs(argv) {
    const a = {};
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith('--')) continue;
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) a[argv[i].slice(2)] = true;
        else (a[argv[i].slice(2)] = next), i++;
    }
    return a;
}
const args = parseArgs(process.argv.slice(2));
const P = {
    base: String(args.base ?? 'https://my.prettylog.com').replace(/\/$/, ''),
    runs: Number(args.runs ?? 3),
    arms: String(args.arms ?? 'anon,auth').split(','),
    rails: String(args.rails ?? 'expanded,collapsed').split(','),
    user: String(args.user ?? 'taeklim'),
    tag: String(args.tag ?? ''),
    unit: args.unit ? String(args.unit) : null, // optional here: recorded in the manifest when given
    webSha: args['web-sha'] ? String(args['web-sha']) : null, // deployed commit; the CI checkout sha is only the harness
    project: args.project,
    slug: args.slug,
    privatePath: args['private-path'],
    warmup: !args['no-warmup'],
    runWarmup: !args['no-run-warmup'], // v2: unrecorded W1 pass before every measured run
    settleMs: Math.max(1500, Number(args['settle-ms'] ?? 1500)), // never below 1.5 s (#68)
    walkGapMs: Math.max(11000, Number(args['walk-gap-ms'] ?? 11000)), // drains the 10 s window
    out: resolve(repo, String(args.out ?? 'deploy/traffic/review/cc/runs')),
};
if (!P.tag) throw new Error('--tag is required (baseline1, qw1, u1 ...)');

const baseUrl = new URL(P.base);
const U = `/@${P.user}`;
const sha7 = (process.env.GITHUB_SHA ?? execSync('git rev-parse HEAD', { cwd: repo }).toString()).trim().slice(0, 7);
const T = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runId = [T, P.unit, P.tag, P.webSha?.slice(0, 7) ?? sha7, 'browser'].filter(Boolean).join('_');
const dir = join(P.out, runId);
mkdirSync(dir, { recursive: true });
const rawPath = join(dir, 'raw.jsonl');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HYDRATION = /hydrat|did not match|server rendered HTML|Minified React error #(418|423|425)/i;
const warnings = [];
let aborted = null;
const details = []; // per (arm, rail, run): [nav] lines and prefetch per link, for browser_summary.*

const raw = (rec) => appendFileSync(rawPath, JSON.stringify(rec) + '\n');

// Project and post slug from the public lists, as cc-measure does (fixed for all runs).
async function discover() {
    const get = async (p) => (await fetch(P.base + p, { headers: { 'user-agent': `cc-perf-browser/1; ${runId}` } })).text();
    let { project, slug } = P;
    if (!project) project = new RegExp(`${U}/projects/([^"/?#\\\\]+)`).exec(await get(`${U}/projects`))?.[1];
    if (!slug) {
        const skip = new Set(['posts', 'projects', 'about', 'resume', 'saved', 'me', 'log']);
        const html = await get(`${U}/posts`);
        slug = [...html.matchAll(new RegExp(`${U}/([^"/?#\\\\]+)`, 'g'))].map((m) => m[1]).find((s) => !skip.has(s));
    }
    if (!project || !slug) throw new Error(`could not find project=${project} slug=${slug}; pass --project/--slug`);
    const pk = /pk_live_[A-Za-z0-9+/=_-]+/.exec(await get('/'))?.[0] ?? process.env.CLERK_PUBLISHABLE_KEY;
    return { project, slug, pk };
}

const RSC_SAVE_CAP = 300 * 1024; // bytes kept per saved navigation body
const saveCount = new Map(); // `${arm}_${rail}_r${run}_${step}` -> files written so far

// v2: body size by a fallback chain, so a failed res.body() is not a null (u1-verdict.md §2).
// 1 body() = decoded bytes (the v1 value). 2 request.sizes().responseBodySize and 3 content-length
// are wire (encoded) sizes: they differ from decoded when the response is compressed. bytes_src says which.
async function recordBody(res, rec) {
    let buf = null;
    try {
        buf = await res.body();
        rec.bytes = buf.length;
        rec.bytes_src = 'body';
    } catch {
        rec.bytes = null;
        rec.bytes_src = null;
        const wire = await res.request().sizes().then((z) => z.responseBodySize, () => 0);
        const cl = Number(res.headers()['content-length']);
        if (wire > 0) (rec.bytes = wire), (rec.bytes_src = 'sizes');
        else if (cl > 0) (rec.bytes = cl), (rec.bytes_src = 'content-length');
    }
    // v2: keep W1 navigation (non-prefetch) bodies so the rail fragment size R can be measured.
    if (buf && rec.walk === 'w1' && rec.run > 0 && !rec.prefetch) {
        const key = `${rec.arm}_${rec.rail}_r${rec.run}_${rec.step}`;
        const n = (saveCount.get(key) ?? 0) + 1;
        saveCount.set(key, n);
        const file = `w1_${key}${n > 1 ? `_${n}` : ''}.rsc`;
        writeFileSync(join(dir, file), buf.subarray(0, RSC_SAVE_CAP));
        rec.rsc_file = file;
        rec.rsc_truncated = buf.length > RSC_SAVE_CAP;
    }
}

// One browser context with its own request recorder. `refresh` re-sets the 60 s Clerk JWT.
async function openSession(browser, ua, { arm, rail, run, walk }, auth) {
    const ctx = await browser.newContext({ baseURL: P.base, viewport: { width: 1440, height: 900 }, userAgent: ua });
    await ctx.addInitScript(() => {
        try { localStorage.setItem('navTiming', '1'); } catch { /* storage blocked */ }
    });
    if (rail === 'collapsed') await ctx.addCookies([{ name: 'railCollapsed', value: '1', url: P.base }]);
    const domain = baseUrl.hostname.endsWith('prettylog.com') ? '.prettylog.com' : baseUrl.hostname;
    const refresh = async () => {
        if (!auth) return;
        const cookies = (await auth.cookieHeader()).split('; ').map((p) => {
            const i = p.indexOf('=');
            return { name: p.slice(0, i), value: p.slice(i + 1), domain, path: '/', secure: true, sameSite: 'Lax' };
        });
        await ctx.addCookies(cookies);
    };
    if (auth) {
        await ctx.addCookies([{ name: '__client', value: auth.clientCookie, domain: auth.fapiHost, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
        await refresh();
    }
    const page = await ctx.newPage();
    const S = { ctx, page, refresh, arm, rail, run, walk, cur: null, recs: [], flushed: 0, pending: [], navLines: [], hydration: [], hydrationTotal: 0, steps: [] };
    const byReq = new Map();
    page.on('request', (req) => {
        const u = new URL(req.url());
        const sameHost = u.host === baseUrl.host;
        if (!sameHost && !u.hostname.startsWith('blog-api.')) return;
        const h = req.headers();
        const rec = {
            kind: 'req', arm, rail, run, walk: S.walk, step: S.cur, at: Date.now(), host: u.host,
            path: u.pathname + u.search, method: req.method(), type: req.resourceType(),
            rsc: u.searchParams.has('_rsc'), prefetch: h['next-router-prefetch'] ?? null,
            segment: h['next-router-segment-prefetch'] ?? null, counted: sameHost && !u.pathname.startsWith('/_next/'),
            status: null, cf_cache_status: null,
        };
        S.recs.push(rec);
        byReq.set(req, rec);
    });
    page.on('response', (res) => {
        const rec = byReq.get(res.request());
        if (!rec) return;
        rec.status = res.status();
        rec.cf_cache_status = res.headers()['cf-cache-status'] ?? null;
        rec.xcomponent = (res.headers()['content-type'] ?? '').includes('text/x-component');
        if (rec.status === 429) aborted = aborted ?? `429 at ${rec.path}`; // a 429 corrupts the run: stop
        // Decoded body bytes of RSC responses (the sum is a summary metric). Awaited at the step end.
        if (rec.xcomponent) S.pending.push(recordBody(res, rec));
    });
    page.on('console', (m) => {
        const text = m.text();
        const nav = /^\[nav\] (\S+) (\S+) (\d+)/.exec(text);
        if (m.type() === 'info' && nav) S.navLines.push({ from: nav[1], to: nav[2], ms: Number(nav[3]) });
        else if (m.type() === 'error' && HYDRATION.test(text)) (S.hydrationTotal++, S.hydration.push(text.slice(0, 300)));
    });
    page.on('pageerror', (e) => {
        if (HYDRATION.test(e.message)) (S.hydrationTotal++, S.hydration.push(e.message.slice(0, 300)));
    });
    return S;
}

// Runs one action, waits settleMs, records one step line. Write-first: flushed at step end.
async function step(S, name, action) {
    if (aborted) throw new Error(aborted);
    S.cur = name;
    await S.refresh();
    const i0 = S.recs.length;
    const n0 = S.navLines.length;
    const t0 = Date.now();
    let err = null;
    let extra = {};
    try {
        extra = (await action()) ?? {};
    } catch (e) {
        err = String(e.message).split('\n')[0];
    }
    const wall = Date.now() - t0;
    await sleep(P.settleMs);
    await Promise.all(S.pending.splice(0));
    const win = S.recs.slice(i0);
    const rec = {
        kind: 'step', arm: S.arm, rail: S.rail, run: S.run, walk: S.walk, step: name, wall_ms: wall,
        nav_ms: S.navLines[n0]?.ms ?? null,
        requests: win.filter((r) => r.counted).length,
        rsc: win.filter((r) => r.rsc).length,
        rsc_nonprefetch: win.filter((r) => r.rsc && !r.prefetch).length,
        prefetch: win.filter((r) => r.prefetch).length,
        err, ...extra,
    };
    S.steps.push(rec);
    for (const r of S.recs.slice(S.flushed)) raw(r);
    S.flushed = S.recs.length;
    raw(rec);
    for (const h of S.hydration.splice(0)) raw({ kind: 'hydration', arm: S.arm, rail: S.rail, run: S.run, walk: S.walk, step: name, text: h });
    if (aborted) throw new Error(aborted);
    return rec;
}

// Click the link if it is visible in `scope`; else the client router (recorded as `via`).
async function goTo(S, href, scope) {
    const link = S.page.locator(`${scope} a[href="${href}"]`).first();
    let via = 'click';
    if ((await link.count()) > 0 && (await link.isVisible())) await link.click();
    else {
        via = 'router.push';
        await S.page.evaluate((h) => window.next?.router?.push(h), href);
    }
    await S.page.waitForURL((u) => u.pathname === href, { timeout: 15_000 });
    return { via };
}

const NAV = 'nav[aria-label="Primary"]';

async function walkW1W2(S, x, auth) {
    await step(S, 's1_home', async () => {
        await S.page.goto('/', { waitUntil: 'load' });
        if (auth) {
            const ok = await S.page.waitForFunction(() => Boolean(window.Clerk?.user), null, { timeout: 10_000 }).then(() => true, () => false);
            if (!ok) warnings.push(`${S.arm}/${S.rail}/run${S.run}: window.Clerk.user not set after load (signed-in state unverified)`);
            return { signed_in: ok };
        }
        return { load_ms: Math.round(await S.page.evaluate(() => performance.getEntriesByType('navigation')[0]?.duration ?? 0)) };
    });
    await step(S, 's2_posts', () => goTo(S, `${U}/posts`, NAV));
    await step(S, 's3_projects', () => goTo(S, `${U}/projects`, NAV));
    await step(S, 's4_project', () => goTo(S, `${U}/projects/${x.project}`, 'main'));
    await step(S, 's5_post', () => goTo(S, `${U}/${x.slug}`, 'main'));
    await step(S, 's6_home', () => goTo(S, '/', NAV));
    S.walk = 'w2'; // back x3 from s6: expect s5, s4, s3
    for (const n of [1, 2, 3]) {
        await step(S, `back${n}`, async () => {
            await S.page.goBack({ waitUntil: 'commit' });
            return { at: new URL(S.page.url()).pathname };
        });
    }
}

async function walkW3(S) {
    await step(S, 'load_home', () => S.page.goto('/', { waitUntil: 'load' }).then(() => undefined));
    for (const n of [1, 2]) {
        await step(S, `scroll${n}`, async () => {
            const lm = S.page.waitForResponse((r) => /load-more|\/v1\/api\/posts/.test(r.url()), { timeout: 8000 }).catch(() => null);
            await S.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await S.page.mouse.wheel(0, 20000);
            return { load_more_seen: Boolean(await lm) };
        });
    }
}

async function walkW4(S, x) {
    let menu = [];
    await step(S, 'first_screen', async () => {
        await S.page.goto('/', { waitUntil: 'load' });
        await sleep(4000); // viewport prefetches fire after load
        menu = await S.page.$$eval(`${NAV} a[href]`, (as) => as.map((a) => a.getAttribute('href')));
        return { menu_links: menu.length };
    });
    const cardHref = `${U}/projects/${x.project}`;
    await step(S, 'card_hover', async () => {
        const exact = S.page.locator(`main a[href="${cardHref}"]`).first();
        const any = S.page.locator('main a[href^="/@"]').first();
        const target = (await exact.count()) > 0 ? exact : any;
        await target.hover({ timeout: 8000 });
        await sleep(1500);
        return { card_href: await target.getAttribute('href') };
    });
    return { menu, cardHref: S.steps.at(-1).card_href ?? cardHref };
}

function maxIn10s(times) {
    const t = [...times].sort((a, b) => a - b);
    let best = 0;
    for (let i = 0, j = 0; j < t.length; j++) {
        while (t[j] - t[i] >= 10_000) i++;
        best = Math.max(best, j - i + 1);
    }
    return best;
}

const pathOnly = (p) => p.split('?')[0];

// Flat { metricName: number } for one (arm, rail, run).
function metricsOf(sessions, w4) {
    const m = {};
    const all = sessions.flatMap((s) => s.recs);
    const steps = sessions.flatMap((s) => s.steps);
    for (const s of steps.filter((s) => s.walk === 'w1')) {
        m[`w1_${s.step}_nav_ms`] = s.nav_ms;
        if (s.step !== 's1_home') m[`w1_${s.step}_rsc_nonprefetch`] = s.rsc_nonprefetch;
    }
    const nav26 = steps.filter((s) => s.walk === 'w1' && s.step !== 's1_home');
    m.w1_nav_ms_s2_s6 = nav26.every((s) => s.nav_ms != null) ? nav26.reduce((t, s) => t + s.nav_ms, 0) : null;
    m.w1_rsc_total = all.filter((r) => r.walk === 'w1' && r.rsc).length;
    m.w1_rsc_nonprefetch = all.filter((r) => r.walk === 'w1' && r.rsc && !r.prefetch).length;
    const w2 = steps.filter((s) => s.walk === 'w2');
    if (w2.length) {
        m.w2_back3_rsc = w2.reduce((t, s) => t + s.rsc, 0);
        m.w2_back3_rsc_nonprefetch = w2.reduce((t, s) => t + s.rsc_nonprefetch, 0);
    }
    const counted = all.filter((r) => r.counted);
    const gaSet = counted.filter((r) => ['w1', 'w3', 'w4'].includes(r.walk));
    m.g_a_max_10s = maxIn10s(gaSet.map((r) => r.at));
    for (const w of ['w1', 'w3', 'w4']) m[`g_a_max_10s_${w}`] = maxIn10s(counted.filter((r) => r.walk === w).map((r) => r.at));
    m.w3_load_more_requests = all.filter((r) => r.walk === 'w3' && /load-more|\/v1\/api\/posts/.test(r.path)).length;
    if (w4) {
        const pf = all.filter((r) => r.walk === 'w4' && r.prefetch && r.host === baseUrl.host);
        const per = w4.menu.map((h) => pf.filter((r) => pathOnly(r.path) === h && r.step === 'first_screen').length);
        m.g_b_menu_links = w4.menu.length;
        m.g_b_prefetch_per_menu_link_max = per.length ? Math.max(...per) : null;
        m.g_b_prefetch_per_menu_link_mean = per.length ? Number((per.reduce((a, b) => a + b, 0) / per.length).toFixed(2)) : null;
        m.g_b_prefetch_total = pf.length;
        m.g_b_card_prefetch_total = pf.filter((r) => pathOnly(r.path) === w4.cardHref).length;
    }
    const xc = all.filter((r) => r.xcomponent);
    m.rsc_count_all = all.filter((r) => r.rsc).length;
    // v2: a run with any unknown size reports an empty byte sum, never a sum that counted nulls as 0.
    m.rsc_bytes_null_count = xc.filter((r) => r.bytes == null).length;
    m.rsc_bytes_w1_null_count = xc.filter((r) => r.walk === 'w1' && r.bytes == null).length;
    m.rsc_bytes_fallback_count = xc.filter((r) => r.bytes_src === 'sizes' || r.bytes_src === 'content-length').length;
    m.rsc_bytes_total = m.rsc_bytes_null_count ? null : xc.reduce((t, r) => t + r.bytes, 0);
    m.rsc_bytes_w1 = m.rsc_bytes_null_count ? null : xc.filter((r) => r.walk === 'w1').reduce((t, r) => t + r.bytes, 0);
    // v2: W1 document/RSC responses served MISS: the run is not a warm-edge run.
    m.w1_miss_count = all.filter((r) => r.walk === 'w1' && (r.type === 'document' || r.rsc) && r.cf_cache_status === 'MISS').length;
    m.g_f_hydration_errors = sessions.reduce((t, s) => t + s.hydrationTotal, 0);
    const si = steps.find((s) => s.step === 's1_home' && s.signed_in !== undefined);
    if (si) m.auth_signed_in = si.signed_in ? 1 : 0;
    m.step_errors = steps.filter((s) => s.err).length;
    return m;
}

async function runOnce(browser, ua, x, auth, { arm, rail, run }) {
    const full = rail === 'expanded';
    const sessions = [];
    const open = async (walk) => {
        const S = await openSession(browser, ua, { arm, rail, run, walk }, arm === 'auth' ? auth : null);
        sessions.push(S);
        return S;
    };
    let w4 = null;
    try {
        if (run > 0 && P.runWarmup) {
            // v2: unrecorded W1 pass (labelled run 0, no bodies saved, not in the metrics) to warm the edge.
            const wu = await openSession(browser, ua, { arm, rail, run: 0, walk: 'w1' }, arm === 'auth' ? auth : null);
            await walkW1W2(wu, x, arm === 'auth').finally(() => wu.ctx.close().catch(() => {}));
            await sleep(P.walkGapMs);
        }
        const s1 = await open('w1');
        await walkW1W2(s1, x, arm === 'auth');
        await s1.ctx.close();
        if (full) {
            await sleep(P.walkGapMs);
            const s3 = await open('w3');
            await walkW3(s3);
            await s3.ctx.close();
            await sleep(P.walkGapMs);
            const s4 = await open('w4');
            w4 = await walkW4(s4, x);
            await s4.ctx.close();
            await sleep(P.walkGapMs);
        }
    } finally {
        for (const s of sessions) await s.ctx.close().catch(() => {});
    }
    const m = metricsOf(sessions, w4);
    const id = { arm, rail, run };
    const navLines = sessions.flatMap((s) => s.navLines.map((n) => ({ ...id, walk: s.walk, ...n })));
    const prefetchPerLink = w4
        ? Object.fromEntries(w4.menu.map((h) => [h, sessions.flatMap((s) => s.recs).filter((r) => r.walk === 'w4' && r.step === 'first_screen' && r.prefetch && r.host === baseUrl.host && pathOnly(r.path) === h).length]))
        : null;
    if (run === 0) return m; // warmup: not summarised
    details.push({ ...id, metrics: m, nav_lines: navLines, prefetch_per_menu_link: prefetchPerLink });
    for (const n of navLines) appendFileSync(join(dir, 'nav.log'), `${n.arm} ${n.rail} run${n.run} ${n.walk} [nav] ${n.from} ${n.to} ${n.ms}\n`);
    const w2at = sessions[0].steps.filter((s) => s.walk === 'w2').map((s) => s.at);
    m.w2_back3_at_ok = w2at.join(',') === [`${U}/${x.slug}`, `${U}/projects/${x.project}`, `${U}/projects`].join(',') ? 1 : 0;
    return m;
}

const stats = (v) => {
    const s = v.filter((n) => typeof n === 'number').sort((a, b) => a - b);
    if (!s.length) return { values: v, median: null, min: null, max: null, range: null };
    const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    return { values: v, median: med, min: s[0], max: s[s.length - 1], range: s[s.length - 1] - s[0] };
};

const sha12 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);

// One readable block per (arm, rail, run): the numbers cc.design.md §14.3 asks for.
function textOf(d) {
    const m = d.metrics;
    const links = d.prefetch_per_menu_link ? Object.entries(d.prefetch_per_menu_link).map(([h, n]) => `${h}=${n}`).join(' ') : 'n/a';
    return [
        `== ${d.arm} ${d.rail} run${d.run}`,
        `_rsc requests: all=${m.rsc_count_all} w1=${m.w1_rsc_total} w1_nonprefetch=${m.w1_rsc_nonprefetch} back3=${m.w2_back3_rsc ?? 'n/a'}`,
        `max requests per 10 s: all=${m.g_a_max_10s} w1=${m.g_a_max_10s_w1} w3=${m.g_a_max_10s_w3 ?? 'n/a'} w4=${m.g_a_max_10s_w4 ?? 'n/a'}`,
        `prefetch per menu link: ${links}`,
        `hydration errors: ${m.g_f_hydration_errors}`,
        `text/x-component bytes: total=${m.rsc_bytes_total ?? ''} w1=${m.rsc_bytes_w1 ?? ''} null=${m.rsc_bytes_null_count} fallback=${m.rsc_bytes_fallback_count} w1_miss=${m.w1_miss_count}`,
        ...d.nav_lines.map((n) => `[nav] ${n.walk} ${n.from} ${n.to} ${n.ms} ms`),
    ].join('\n');
}

async function main() {
    let browser = null;
    let auth = null;
    let x = null;
    const byGroup = {}; // `${arm}.${rail}` -> metric -> values per run
    let exit = 0;
    let chromeVersion = null;
    try {
        x = await discover();
        P.project = x.project;
        P.slug = x.slug;
        if (P.arms.includes('auth')) {
            auth = await openClerkSession({ username: P.user, origin: baseUrl.origin, publishableKey: x.pk });
        }
        browser = await chromium.launch({ headless: true });
        chromeVersion = browser.version();
        const ua = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36 cc-perf-browser/1 ${runId}`;
        if (P.warmup) {
            await runOnce(browser, ua, x, null, { arm: 'anon', rail: 'collapsed', run: 0 }); // warms the edge; run 0 is dropped
            await sleep(P.walkGapMs);
        }
        for (let run = 1; run <= P.runs; run++) {
            for (const rail of P.rails) {
                for (const arm of P.arms) {
                    const m = await runOnce(browser, ua, x, auth, { arm, rail, run });
                    raw({ kind: 'metrics', arm, rail, run, metrics: m });
                    const g = (byGroup[`${arm}.${rail}`] ??= {});
                    for (const [k, v] of Object.entries(m)) (g[k] ??= []).push(v);
                }
            }
        }
        if (P.privatePath) {
            const S = await openSession(browser, ua, { arm: 'anon', rail: 'expanded', run: 1, walk: 'gg' }, null);
            const res = await step(S, 'private_post', async () => {
                const r = await S.page.goto(P.privatePath, { waitUntil: 'load' });
                return { status: r?.status() ?? null, title: await S.page.title(), body_chars: (await S.page.innerText('body')).length };
            });
            await S.ctx.close();
            (byGroup['anon.expanded'] ??= {}).g_g_private_status = [res.status];
        } else {
            warnings.push('G-g not measured: pass --private-path (owner private post URL path)');
        }
    } catch (e) {
        exit = 2;
        aborted = aborted ?? String(e.message).split('\n')[0];
    } finally {
        if (browser) await browser.close().catch(() => {});
        if (auth) {
            try { await auth.close(); } catch { warnings.push('session revoke failed: revoke it in the Clerk dashboard'); }
        }
    }

    const metrics = {};
    const rows = ['arm,rail,metric,median,min,max,range,values'];
    for (const [group, g] of Object.entries(byGroup)) {
        metrics[group] = {};
        const [arm, rail] = group.split('.');
        for (const [k, v] of Object.entries(g)) {
            const s = (metrics[group][k] = stats(v));
            rows.push([arm, rail, k, s.median, s.min, s.max, s.range, `"${v.join(' ')}"`].join(','));
        }
    }
    writeFileSync(join(dir, 'summary.csv'), rows.join('\n') + '\n');
    writeFileSync(join(dir, 'browser_summary.json'), JSON.stringify(details, null, 2) + '\n');
    writeFileSync(join(dir, 'browser_summary.txt'), details.map(textOf).join('\n') + '\n');
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
        code_version: CODE_VERSION,
        code_sha: sha12(fileURLToPath(import.meta.url)),
        clerk_session_sha: sha12(join(here, 'clerk-session.mjs')),
        run_id: runId,
        unit: P.unit,
        web_sha: P.webSha, // the DEPLOYED commit; null when the workflow input was left empty
        harness_sha: sha7, // CI checkout
        git_dirty: false, // CI checkout
        params: { ...P, out: undefined },
        env: { node: process.version, chromium: chromeVersion, platform: `${os.platform()} ${os.release()}`, started: T },
        aborted,
        warnings,
        metrics,
    }, null, 2) + '\n');
    copyFileSync(fileURLToPath(import.meta.url), join(dir, 'cc-browser.snapshot.mjs'));
    copyFileSync(join(here, 'clerk-session.mjs'), join(dir, 'clerk-session.snapshot.mjs'));
    console.log(`${aborted ? 'ABORTED: ' + aborted : 'ok'}  groups=${Object.keys(byGroup).length}  dir=${dir}`);
    process.exit(exit);
}

main();
