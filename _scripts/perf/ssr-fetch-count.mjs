#!/usr/bin/env node
// _scripts/perf/ssr-fetch-count.mjs
// QW1 metric (cc.design.md §14.2): Next-server fetches (`ssr_fetch` log lines) per MISS render.
// Reads <run dir>/manifest.json `metrics.arms.<arm>.miss_windows`, gets the web log lines, and
// groups `ssr_fetch` lines into one MISS render per window:
//
//   proxy "request" line whose query holds the window's cb  -> t_i
//   ssr_fetch lines with t_i < time <= t_next               -> count_i
//   t_next = the next "request" line of any source, capped at t_i + 5 s
//
// There is no request id, so the window is the only link. Windows are bounded by the VM's own
// request lines, not by the Mac clock. A window is CONTAMINATED (dropped) when a request line
// from another client (ua without the run id, path not /_next/) falls inside the render
// (t_i, t_i + duration + 500 ms]. Not detectable: a foreign render that started BEFORE t_i
// and still fetches inside the window; run at a quiet hour (UTC 05-07) as the design says.
// No request line for the cb (e.g. a log gap): fallback "clock-window" = the script's own
// [start, end]; counted, flagged, never dropped silently.
//
// Usage (repo root, main session):
//   node _scripts/perf/ssr-fetch-count.mjs <run dir> [--arm anon] [--pages home,posts,post]
//        [--from-file <log .json|.jsonl>] [--limit 5000] [--project <gcp project>]
// Without --from-file it runs ONE `gcloud logging read` for the span of the windows (+-10 s) and
// saves a REDUCED copy (time, message, path, query, ua; no ip, no cookies) as blog-web-log.json
// in the run dir. Entries are never printed. Outputs: ssr_fetch_counts.json, ssr_fetch_summary.txt.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CAP_MS = 5000;
const PAD_S = 10;
const TAIL_MS = 500; // slack after the script-side duration for the contamination check

function parseArgs(argv) {
    const a = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith('--')) { a._.push(argv[i]); continue; }
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) a[argv[i].slice(2)] = true;
        else (a[argv[i].slice(2)] = next), i++;
    }
    return a;
}
const args = parseArgs(process.argv.slice(2));
if (!args._[0]) throw new Error('usage: ssr-fetch-count.mjs <run dir> [--arm anon] [--pages home,posts,post] [--from-file f]');
const runDir = resolve(args._[0]);
const arm = String(args.arm ?? 'anon');
const pages = String(args.pages ?? 'home,posts,post').split(',');

const manifest = JSON.parse(readFileSync(join(runDir, 'manifest.json'), 'utf8'));
const runId = manifest.run_id;
const windows = (manifest.metrics?.arms?.[arm]?.miss_windows ?? []).map((w) => ({
    ...w,
    // Baseline manifests have no `cb` field: it is the query value in `path`.
    cb: w.cb ?? new URL(w.path, 'http://x').searchParams.get('cb'),
}));
if (!windows.length) throw new Error(`no miss_windows for arm "${arm}" in ${runDir}/manifest.json`);

// One log entry -> { t, message, path, query, ua }. Accepts a Cloud Logging entry or a flat payload.
function normalize(e) {
    let p = e.jsonPayload;
    if (!p && typeof e.textPayload === 'string') {
        try { p = JSON.parse(e.textPayload); } catch { /* not JSON: ignored below */ }
    }
    p ??= e.message ? e : null;
    if (!p || (p.message !== 'request' && p.message !== 'ssr_fetch')) return null;
    const t = Date.parse(p.time ?? e.timestamp);
    if (Number.isNaN(t)) return null;
    return { t, message: p.message, path: p.path ?? '', query: p.query ?? '', ua: p.ua ?? '' };
}

function readFromFile(f) {
    const txt = readFileSync(resolve(f), 'utf8').trim();
    const rows = txt.startsWith('[') ? JSON.parse(txt) : txt.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    return rows;
}

function readFromCloudLogging() {
    const starts = windows.map((w) => Date.parse(w.start));
    const ends = windows.map((w) => Date.parse(w.end));
    const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
    const A = iso(Math.min(...starts) - PAD_S * 1000);
    const B = iso(Math.max(...ends) + PAD_S * 1000);
    const filter = `logName:"blog-web" AND timestamp>="${A}" AND timestamp<="${B}" AND (jsonPayload.message="request" OR jsonPayload.message="ssr_fetch")`;
    const limit = String(args.limit ?? 5000);
    const argv = ['logging', 'read', filter, '--order=asc', `--limit=${limit}`, '--format=json'];
    if (args.project) argv.push(`--project=${args.project}`);
    const r = spawnSync('gcloud', argv, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    // stderr is shown (gcloud errors carry no log content); stdout never is.
    if (r.status !== 0) throw new Error(`gcloud logging read failed (exit ${r.status}): ${(r.stderr ?? '').slice(0, 500)}`);
    const rows = JSON.parse(r.stdout || '[]');
    if (rows.length >= Number(limit)) console.warn(`WARNING: ${rows.length} entries = --limit; the span may be truncated, raise --limit`);
    return rows;
}

const source = args['from-file'] ? `file:${args['from-file']}` : 'gcloud logging read';
const lines = (args['from-file'] ? readFromFile(args['from-file']) : readFromCloudLogging())
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => a.t - b.t); // stable: ties keep file order
if (!args['from-file']) writeFileSync(join(runDir, 'blog-web-log.json'), JSON.stringify(lines, null, 1) + '\n');

const requests = lines.filter((l) => l.message === 'request');
const fetches = lines.filter((l) => l.message === 'ssr_fetch');

function countWindow(w) {
    const dur = Date.parse(w.end) - Date.parse(w.start);
    // Exact cb match: a substring test would let cb "..._post" match "..._posts".
    const ours = w.cb ? requests.filter((r) => new URLSearchParams(r.query).get('cb') === w.cb) : [];
    const base = { run: w.run, name: w.name, path: w.path, cb: w.cb, cf_cache_status: w.cf_cache_status, status: w.status };
    if (!ours.length) {
        // clock-window fallback: the script's own start/end, Mac clock.
        const in_ = fetches.filter((f) => f.t >= Date.parse(w.start) && f.t <= Date.parse(w.end));
        return { ...base, mode: 'clock-window', contaminated: false, count: in_.length, by_path: byPath(in_) };
    }
    const first = ours[0];
    const i = requests.indexOf(first);
    const next = requests[i + 1];
    const tEnd = Math.min(next ? next.t : Infinity, first.t + CAP_MS);
    const in_ = fetches.filter((f) => f.t > first.t && f.t <= tEnd);
    const foreign = requests.filter((r) => r !== first && r.t > first.t && r.t <= first.t + dur + TAIL_MS && !r.ua.includes(runId) && !r.path.startsWith('/_next/'));
    return {
        ...base,
        mode: 'request-line',
        contaminated: foreign.length > 0,
        foreign_requests: foreign.map((r) => r.path), // paths only
        window_ms: tEnd - first.t,
        capped: !next || next.t - first.t > CAP_MS,
        count: in_.length,
        by_path: byPath(in_),
    };
}

function byPath(arr) {
    const o = {};
    for (const f of arr) o[f.path] = (o[f.path] ?? 0) + 1;
    return o;
}

const median = (v) => {
    const s = [...v].sort((a, b) => a - b);
    if (!s.length) return null;
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const results = windows.map(countWindow);

// Repetition sum = counts of the chosen pages in one repetition; valid only when every page window is usable.
const reps = [...new Set(results.map((r) => r.run))].sort((a, b) => a - b).map((run) => {
    const rs = pages.map((p) => results.find((r) => r.run === run && r.name === p));
    const ok = rs.every((r) => r && !r.contaminated);
    return { run, valid: ok, sum: ok ? rs.reduce((t, r) => t + r.count, 0) : null, per_page: Object.fromEntries(pages.map((p, k) => [p, rs[k]?.count ?? null])) };
});
const valid = reps.filter((r) => r.valid).map((r) => r.sum);
const runValue = { median: median(valid), min: valid.length ? Math.min(...valid) : null, max: valid.length ? Math.max(...valid) : null, values: valid, n_valid: valid.length, n_repetitions: reps.length };
runValue.range = valid.length ? runValue.max - runValue.min : null;

const out = {
    run_id: runId, web_sha: manifest.web_sha ?? null, unit: manifest.unit ?? null, arm, source, pages,
    pages_contaminated: results.filter((r) => r.contaminated).map((r) => `${r.run}/${r.name}`),
    clock_window: results.filter((r) => r.mode === 'clock-window').map((r) => `${r.run}/${r.name}`),
    run_value: runValue, repetitions: reps, windows: results,
};
writeFileSync(join(runDir, 'ssr_fetch_counts.json'), JSON.stringify(out, null, 2) + '\n');

const summary = [
    `run ${runId}  arm ${arm}  source ${source}`,
    `ssr_fetch per MISS render, pages ${pages.join('+')} (sum per repetition):`,
    ...reps.map((r) => `  rep ${r.run}: ${r.valid ? r.sum : 'dropped (contaminated or missing window)'}  ${JSON.stringify(r.per_page)}`),
    `run value: median ${runValue.median}  range ${runValue.range}  valid ${runValue.n_valid}/${runValue.n_repetitions}`,
    `contaminated windows: ${out.pages_contaminated.length ? out.pages_contaminated.join(' ') : 'none'}`,
    `clock-window fallback: ${out.clock_window.length ? out.clock_window.join(' ') : 'none'}`,
    ...results.filter((r) => r.name === 'post').map((r) => `  post rep ${r.run} by path: ${JSON.stringify(r.by_path)}`),
].join('\n');
writeFileSync(join(runDir, 'ssr_fetch_summary.txt'), summary + '\n');
console.log(summary);
