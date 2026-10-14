#!/usr/bin/env node
// _scripts/perf/cc-measure.mjs
// Phase CC U0b: HTTP-level baseline and per-unit measurement (cc.design.md §5).
// Runs W1-W4 against one site, anonymous and signed-in, N runs, sequential
// requests >= 1 s apart (Cloudflare limit 50 req / 10 s, decision #68).
//
// APPROXIMATIONS (no browser here, by the owner's rule "no Playwright"):
//   - "navigation time" = time from request start to the last body byte of an
//     `RSC: 1` request (`_rsc` query). The browser's `[nav]` console line also
//     includes hydration and commit; this script does not.
//   - The client router cache does not exist here. W2 (back x3) sends the 3
//     requests a cache-less client would send; the U2 metric (`_rsc` count with
//     staleTimes) needs a browser and is NOT measured.
//   - W4 sends one prefetch request per link by construction; per-link prefetch
//     counts (G-b) and 10 s request peaks (G-a) of a real browser are NOT measured.
//   - Console hydration errors (G-f) and the private-post check (G-g) are NOT measured.
//   - TTFB = time until response headers arrive; connections are kept alive, so
//     only the first request pays DNS and TLS (curl in the design paid it each time).
//   - Bytes are decoded body bytes (like curl without --compressed).
//   - The RSC request carries no `Next-Router-State-Tree`, so bytes are the
//     "full tree" size, never to be mixed with browser HAR bytes (design §5.4).
//
// Usage (repo root):
//   node _scripts/perf/cc-measure.mjs --tag baseline1 [--base https://my.prettylog.com]
//     [--runs 3] [--arms anon,auth] [--only w1,w2,w3,w4,miss,hit,rsc,guards]
//     [--project <P> --slug <S>] [--user taeklim] [--gap-ms 1100] [--no-warmup]
//     [--externals] [--out deploy/traffic/review/cc/runs]
// Local dev server over mkcert TLS: prefix with NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem".
// Signed-in arm: see clerk-session.mjs (reads the Clerk key from the app env file; never printed).
//
// Output: <out>/<T>_<tag>_<sha7>/ raw.jsonl (one line per request, no request
// cookies, Set-Cookie names only), manifest.json (params, env, code hashes,
// metrics), summary.csv, snapshots of both scripts, optional externals.
import { spawnSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import os from 'node:os';
import { openClerkSession } from './clerk-session.mjs';

const CODE_VERSION = 'v1';
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');

function parseArgs(argv) {
    const a = {};
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith('--')) continue;
        const key = argv[i].slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) a[key] = true;
        else (a[key] = next), i++;
    }
    return a;
}
const args = parseArgs(process.argv.slice(2));
const P = {
    base: String(args.base ?? 'https://my.prettylog.com').replace(/\/$/, ''),
    runs: Number(args.runs ?? 3),
    arms: String(args.arms ?? 'anon,auth').split(','),
    only: String(args.only ?? 'w1,w2,w3,w4,miss,hit,rsc,guards').split(','),
    user: String(args.user ?? 'taeklim'),
    tag: String(args.tag ?? ''),
    gapMs: Math.max(1000, Number(args['gap-ms'] ?? 1100)), // never below 1 s (#68)
    warmup: !args['no-warmup'],
    externals: Boolean(args.externals),
    project: args.project,
    slug: args.slug,
    out: resolve(repo, String(args.out ?? 'deploy/traffic/review/cc/runs')),
    envFile: resolve(repo, 'apps/dashboard_client_web/.env.local'),
};
if (!P.tag) throw new Error('--tag is required (baseline1, qw1, u1 ...)');

const sha7 = execSync('git rev-parse --short=7 HEAD', { cwd: repo }).toString().trim();
const dirty = execSync('git status --porcelain', { cwd: repo }).toString().trim() !== '';
const T = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runId = `${T}_${P.tag}_${sha7}`;
const dir = join(P.out, runId);
mkdirSync(dir, { recursive: true });
const rawPath = join(dir, 'raw.jsonl');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastStart = 0;
let aborted = null;
const records = [];

// One request. Returns { rec, text? }. Appends the raw line before returning (write-first).
async function hit(ctx, name, path, { headers = {}, keepText = false } = {}) {
    const wait = lastStart + P.gapMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
    const startedAt = new Date().toISOString();
    const t0 = performance.now();
    const res = await fetch(P.base + path, {
        redirect: 'manual',
        headers: { 'user-agent': `Mozilla/5.0 (compatible; cc-perf-measure/1; ${runId})`, ...headers },
    });
    const ttfb = performance.now() - t0;
    const buf = Buffer.from(await res.arrayBuffer());
    const total = performance.now() - t0;
    const h = (n) => res.headers.get(n);
    const rec = {
        ...ctx,
        name,
        path,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        status: res.status,
        ttfb_ms: Math.round(ttfb),
        total_ms: Math.round(total),
        bytes: buf.length,
        wire_bytes: h('content-length') ? Number(h('content-length')) : null,
        content_type: h('content-type'),
        cf_cache_status: h('cf-cache-status'),
        age: h('age'),
        cache_control: h('cache-control'),
        location: h('location'),
        set_cookie_names: res.headers.getSetCookie().map((c) => c.split('=')[0]),
        body_sha: createHash('sha256').update(buf).digest('hex').slice(0, 16),
    };
    appendFileSync(rawPath, JSON.stringify(rec) + '\n');
    records.push(rec);
    if (res.status === 429) {
        aborted = `429 at ${path}`; // a 429 corrupts the run (design §5.4): stop, keep what exists
        throw new Error(aborted);
    }
    return { rec, text: keepText ? buf.toString('utf8') : undefined };
}

const RSC = { rsc: '1' };
const PREFETCH = { rsc: '1', 'next-router-prefetch': '1' };
const rscQuery = (token) => `_rsc=${token}`;

async function discover() {
    const U = `/@${P.user}`;
    const ctx = { arm: 'discover', run: -1 };
    let project = P.project;
    let slug = P.slug;
    if (!project) {
        const { text } = await hit(ctx, 'find_project', `${U}/projects`, { keepText: true });
        project = new RegExp(`${U}/projects/([^"/?#\\\\]+)`).exec(text)?.[1];
    }
    if (!slug) {
        const { text } = await hit(ctx, 'find_slug', `${U}/posts`, { keepText: true });
        const skip = new Set(['posts', 'projects', 'about', 'resume', 'saved', 'me', 'log']);
        slug = [...text.matchAll(new RegExp(`${U}/([^"/?#\\\\]+)`, 'g'))].map((m) => m[1]).find((s) => !skip.has(s));
    }
    if (!project || !slug) throw new Error(`could not find project=${project} slug=${slug}; pass --project/--slug`);
    return { project, slug };
}

// Each walk returns nothing; records carry (arm, run, walk, step) for the summary.
async function walks(arm, run, x, headersFor) {
    const U = `/@${P.user}`;
    const on = (w) => P.only.includes(w);
    const call = async (walk, name, path, kind, extra = {}) => {
        const headers = { ...(await headersFor()), ...(kind === 'rsc' ? RSC : kind === 'prefetch' ? PREFETCH : {}) };
        return hit({ arm, run, walk }, name, path, { headers, ...extra });
    };
    const cb = (n) => `cb=cc${runId}_${arm}_${run}_${n}`;

    if (on('w1')) {
        await call('w1', 's1_home', '/', 'html');
        await call('w1', 's2_posts', `${U}/posts?${rscQuery('ccw1s2')}`, 'rsc');
        await call('w1', 's3_projects', `${U}/projects?${rscQuery('ccw1s3')}`, 'rsc');
        await call('w1', 's4_project', `${U}/projects/${x.project}?${rscQuery('ccw1s4')}`, 'rsc');
        await call('w1', 's5_post', `${U}/${x.slug}?${rscQuery('ccw1s5')}`, 'rsc');
        await call('w1', 's6_home', `/?${rscQuery('ccw1s6')}`, 'rsc');
    }
    if (on('w2')) {
        // back x3 from s6: s5, s4, s3 (same _rsc values as W1, as a cache-less client would send)
        await call('w2', 'back1_post', `${U}/${x.slug}?${rscQuery('ccw1s5')}`, 'rsc');
        await call('w2', 'back2_project', `${U}/projects/${x.project}?${rscQuery('ccw1s4')}`, 'rsc');
        await call('w2', 'back3_projects', `${U}/projects?${rscQuery('ccw1s3')}`, 'rsc');
    }
    if (on('w3')) {
        // Two load-more scrolls from the home feed, then the second again (HIT check, U7 option a).
        const first = await call('w3', 'lm1', '/api/posts/load-more?limit=10&username=', 'json', { keepText: true });
        const cursor = JSON.parse(first.text || '{}').nextCursor; // BIGINT stays a string: only pasted into a URL
        if (cursor) {
            const q = `/api/posts/load-more?cursor=${encodeURIComponent(cursor)}&limit=10&username=`;
            await call('w3', 'lm2', q, 'json');
            await call('w3', 'lm2_again', q, 'json');
        }
    }
    if (on('w4')) {
        await call('w4', 'card_hover', `${U}/projects/${x.project}?${rscQuery('ccw4card')}`, 'prefetch');
        const menu = { home: '/', posts: `${U}/posts`, projects: `${U}/projects`, about: `${U}/about`, resume: `${U}/resume`, log: '/log' };
        for (const [k, p] of Object.entries(menu)) {
            await call('w4', `menu_${k}`, `${p}?${rscQuery(`ccw4m${k}`)}`, 'prefetch');
        }
    }
    if (on('miss')) {
        // ?cb= gives a new edge key: the origin renders. QW1 counts ssr_fetch lines in each [started_at, ended_at].
        for (const [k, p] of [['home', '/'], ['posts', `${U}/posts`], ['projects', `${U}/projects`], ['project', `${U}/projects/${x.project}`], ['post', `${U}/${x.slug}`]]) {
            await call('miss', k, `${p}?${cb(k)}`, 'html');
        }
    }
    if (on('hit')) {
        for (const [k, p] of [['home', '/'], ['posts', `${U}/posts`], ['projects', `${U}/projects`]]) {
            await call('hit', k, `${p}?${cb(k)}`, 'html'); // same key as the MISS above
        }
    }
    if (on('rsc')) {
        for (const [k, p] of [['posts', `${U}/posts`], ['projects', `${U}/projects`], ['post', `${U}/${x.slug}`]]) {
            await call('rsc_full', k, `${p}?${rscQuery(`ccf${runId}`)}`, 'rsc');
            await call('rsc_pref', k, `${p}?${rscQuery(`ccp${runId}`)}`, 'prefetch');
        }
    }
}

// G-e, G-e2, G-k: once per script, anonymous.
async function guards() {
    const U = `/@${P.user}`;
    const ctx = { arm: 'anon', run: 0, walk: 'guards' };
    for (const [k, p] of [['nope', '/nope'], ['nope_handle', '/@nope/x'], ['nope_slug', `${U}/nope`]]) {
        await hit(ctx, k, `${p}?cb=ccg${runId}`, {});
    }
    // Today: rail_cookie (same key) is the cached plain HTML, the bug. After QW2 rail_cookie_fresh
    // (new key, a real render with the cookie) must equal rail_plain apart from nothing rail-related.
    // The bodies are saved (public HTML) so the main session can diff them.
    const key = `/?cb=ccr${runId}`;
    const html = { cookie: 'railCollapsed=1' };
    const bodies = {
        rail_plain: (await hit(ctx, 'rail_plain', key, { keepText: true })).text,
        rail_cookie: (await hit(ctx, 'rail_cookie', key, { headers: html, keepText: true })).text,
        rail_cookie_fresh: (await hit(ctx, 'rail_cookie_fresh', `/?cb=ccs${runId}`, { headers: html, keepText: true })).text,
    };
    for (const [n, t] of Object.entries(bodies)) writeFileSync(join(dir, `${n}.html`), t);
}

const stats = (v) => {
    const s = [...v].sort((a, b) => a - b);
    const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    return { values: v, median: m, min: s[0], max: s[s.length - 1], range: s[s.length - 1] - s[0] };
};

// Metrics named in §5.3 (values per run, median, range) plus the record-only ones.
function summarize() {
    const real = records.filter((r) => r.run > 0 && r.walk !== 'guards');
    const out = { arms: {}, guards: {} };
    for (const arm of P.arms) {
        const rs = real.filter((r) => r.arm === arm);
        const steps = {};
        for (const r of rs) {
            const k = `${r.walk}.${r.name}`;
            (steps[k] ??= { ttfb_ms: [], total_ms: [], bytes: [], status: [], cf_cache_status: [] });
            steps[k].ttfb_ms.push(r.ttfb_ms);
            steps[k].total_ms.push(r.total_ms);
            steps[k].bytes.push(r.bytes);
            steps[k].status.push(r.status);
            steps[k].cf_cache_status.push(r.cf_cache_status);
        }
        const a = { steps: {} };
        for (const [k, s] of Object.entries(steps)) {
            a.steps[k] = { ttfb_ms: stats(s.ttfb_ms), total_ms: stats(s.total_ms), bytes: stats(s.bytes), status: s.status, cf_cache_status: s.cf_cache_status };
        }
        // Per-run sums. U3: w1.s5 total_ms (a.steps). U4: sum of w1 nav steps 2-6. U1: x-component bytes of W1.
        const perRun = (pred, field) => {
            const runs = [...new Set(rs.map((r) => r.run))];
            return stats(runs.map((n) => rs.filter((r) => r.run === n && pred(r)).reduce((t, r) => t + r[field], 0)));
        };
        a.w1_nav_total_ms_s2_s6 = perRun((r) => r.walk === 'w1' && r.name !== 's1_home', 'total_ms');
        a.w1_xcomponent_bytes = perRun((r) => r.walk === 'w1' && r.content_type?.includes('text/x-component'), 'bytes');
        const firstRun = rs[0]?.run;
        a.w2_requests_emulated = rs.filter((r) => r.walk === 'w2' && r.run === firstRun).length;
        a.w3_load_more_requests = rs.filter((r) => r.walk === 'w3' && r.run === firstRun).length;
        a.set_cookie_lines = rs.reduce((t, r) => t + r.set_cookie_names.length, 0);
        // QW1: the windows to count ssr_fetch lines in (Cloud Logging, UA contains the run id).
        a.miss_windows = rs.filter((r) => r.walk === 'miss').map((r) => ({ run: r.run, name: r.name, path: r.path, start: r.started_at, end: r.ended_at, status: r.status, cf_cache_status: r.cf_cache_status }));
        out.arms[arm] = a;
    }
    const g = (n) => records.find((r) => r.walk === 'guards' && r.name === n);
    for (const n of ['nope', 'nope_handle', 'nope_slug']) out.guards[`status_${n}`] = g(n)?.status ?? null;
    const rp = g('rail_plain');
    const rc = g('rail_cookie');
    const rf = g('rail_cookie_fresh');
    // sha equality is exact bytes: unrelated per-render bytes can break it, so diff the saved .html files too.
    out.guards.rail_cookie_same_key_same_html = rp && rc ? rp.body_sha === rc.body_sha : null;
    out.guards.rail_cookie_fresh_same_html = rp && rf ? rp.body_sha === rf.body_sha : null;
    out.guards.rail_cache_status = rp && rc && rf ? [rp.cf_cache_status, rc.cf_cache_status, rf.cf_cache_status] : null;
    out.guards.public_set_cookie_lines = records.filter((r) => r.arm === 'anon' && r.set_cookie_names.length > 0).length;
    return out;
}

function writeCsv(metrics) {
    const rows = ['arm,key,metric,median,min,max,range,values'];
    for (const [arm, a] of Object.entries(metrics.arms)) {
        for (const [k, s] of Object.entries(a.steps)) {
            for (const m of ['ttfb_ms', 'total_ms', 'bytes']) {
                const v = s[m];
                rows.push([arm, k, m, v.median, v.min, v.max, v.range, `"${v.values.join(' ')}"`].join(','));
            }
        }
        for (const m of ['w1_nav_total_ms_s2_s6', 'w1_xcomponent_bytes']) {
            const v = a[m];
            rows.push([arm, m, 'sum_per_run', v.median, v.min, v.max, v.range, `"${v.values.join(' ')}"`].join(','));
        }
    }
    writeFileSync(join(dir, 'summary.csv'), rows.join('\n') + '\n');
}

const sha12 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);

async function main() {
    const sessions = {};
    let x = null;
    let exit = 0;
    try {
        if (P.arms.includes('auth')) {
            sessions.auth = await openClerkSession({ envFile: P.envFile, username: P.user, origin: new URL(P.base).origin });
        }
        x = await discover();
        const headersFor = {
            anon: async () => ({}),
            auth: async () => ({ cookie: await sessions.auth.cookieHeader() }),
        };
        if (P.warmup && P.arms.includes('anon') && P.only.includes('w1')) {
            const only = P.only;
            P.only = ['w1']; // warm the edge for the fixed _rsc values; run 0 is dropped from the summary
            await walks('anon', 0, x, headersFor.anon);
            P.only = only;
        }
        for (let run = 1; run <= P.runs; run++) {
            for (const arm of P.arms) await walks(arm, run, x, headersFor[arm]);
        }
        if (P.only.includes('guards') && P.arms.includes('anon')) await guards();
    } catch (e) {
        exit = 2;
        aborted = aborted ?? String(e.message);
    } finally {
        if (sessions.auth) {
            try { await sessions.auth.close(); } catch { aborted = (aborted ?? '') + ' | session revoke failed'; }
        }
    }

    const metrics = records.length ? summarize() : {};
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
        code_version: CODE_VERSION,
        code_sha: sha12(fileURLToPath(import.meta.url)),
        clerk_session_sha: sha12(join(here, 'clerk-session.mjs')),
        run_id: runId,
        git_sha: sha7,
        git_dirty: dirty, // the measured SITE version is the deployed commit, not necessarily this one
        params: { ...P, envFile: undefined, out: undefined, project: x?.project, slug: x?.slug, rail_state: 'cookie unset (expanded) for all arms' },
        env: { node: process.version, platform: `${os.platform()} ${os.release()}`, started: T, requests: records.length },
        aborted,
        metrics,
    }, null, 2) + '\n');
    if (records.length) writeCsv(metrics);
    copyFileSync(fileURLToPath(import.meta.url), join(dir, 'cc-measure.snapshot.mjs'));
    copyFileSync(join(here, 'clerk-session.mjs'), join(dir, 'clerk-session.snapshot.mjs'));
    writeFileSync(join(dir, 'code.sha256'), `${sha12(fileURLToPath(import.meta.url))}  cc-measure.mjs\n`);

    if (P.externals && !aborted) {
        await sleep(15_000); // let the 10 s rate window drain before traffic-check.sh's ~20 GETs
        const run = (cmd, argv, file) => writeFileSync(join(dir, file), spawnSync(cmd, argv, { cwd: repo, env: { ...process.env, W: P.base } }).stdout);
        run('./_scripts/cloudflare/traffic-check.sh', [], 'traffic-check.txt');
        run('./_scripts/gcp/vm-metrics.sh', ['1'], 'vm.txt');
    }
    console.log(`${aborted ? 'ABORTED: ' + aborted : 'ok'}  requests=${records.length}  dir=${dir}`);
    process.exit(exit);
}

main();
