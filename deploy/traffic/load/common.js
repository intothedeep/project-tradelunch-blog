// Shared by l1.js and l2.js (traffic.design.md section 10). Public URLs only.
import http from 'k6/http'
import exec from 'k6/execution'
import { Counter } from 'k6/metrics'

export const WEB = 'https://my.prettylog.com'
export const API = 'https://blog-api.prettylog.com'

// Requests below only ever use public GET URLs and a test User-Agent.
http.setResponseCallback(http.expectedStatuses(200)) // a redirect or 4xx counts as failed

// Options every set shares: design 10.4 item 4 (maxVUs 20, timeout 10 s, no redirects).
export const baseOptions = {
    discardResponseBodies: true,
}
export const MAX_VUS = 20
export const PRE_VUS = 10

// One counter per target and cf-cache-status value, made at init time
// (k6 cannot create metrics later), so the summary can print the split.
const STATUSES = ['HIT', 'MISS', 'EXPIRED', 'BYPASS', 'DYNAMIC', 'STALE', 'REVALIDATED', 'UPDATING', 'NONE']
const cfCounters = {}
for (const t of ['web', 'api']) {
    for (const s of STATUSES) cfCounters[`${t}_${s}`] = new Counter(`cf_${t}_${s}`)
}
export const serverErrors = new Counter('server_errors') // 5xx, any target

function header(res, name) {
    for (const k of Object.keys(res.headers)) if (k.toLowerCase() === name) return res.headers[k]
    return null
}

// A hard cap per scenario: the arrival-rate executors may start a few extra
// iterations, so the iteration number gates the request itself.
export function overCap(cap) {
    return exec.scenario.iterationInTest >= cap
}

// Run-wide unique number inside one scenario (__ITER is per VU, so it would repeat).
export function seq() {
    return exec.scenario.iterationInTest
}

// get(target, url, setName): GET with the test User-Agent and count cache status and 5xx.
export function get(target, url, setName) {
    const res = http.get(url, {
        headers: { 'User-Agent': `prettylog-load-test/${setName}` },
        redirects: 0,
        timeout: '10s',
        tags: { target, set: setName },
    })
    const raw = (header(res, 'cf-cache-status') || 'NONE').toUpperCase()
    const key = `${target}_${STATUSES.includes(raw) ? raw : 'NONE'}`
    cfCounters[key].add(1)
    if (res.status >= 500) serverErrors.add(1)
    return res
}

// Stop conditions as thresholds (design 10.4 item 5). delayAbortEval gives k6 10 s of data first.
export function stop(expr) {
    return [{ threshold: expr, abortOnFail: true, delayAbortEval: '10s' }]
}

// End-of-test text: one markdown table for $GITHUB_STEP_SUMMARY, plus the raw JSON artifact.
export function summarize(data, setName) {
    const m = data.metrics
    const vals = (x) => (x && (x.values || x)) || {}
    const val = (name, field) => (vals(m[name])[field] !== undefined ? vals(m[name])[field] : 0)
    const rows = []
    for (const t of ['web', 'api']) {
        const d = m[`http_req_duration{target:${t}}`]
        const f = m[`http_req_failed{target:${t}}`]
        if (!d) continue
        const cf = STATUSES.map((s) => [s, val(`cf_${t}_${s}`, 'count')]).filter(([, c]) => c > 0)
        rows.push(
            `| ${t} | ${vals(d).count} | ${vals(d)['p(95)'].toFixed(0)} | ` +
                `${f ? (vals(f).rate * 100).toFixed(2) : '0.00'} | ${cf.map(([s, c]) => `${s} ${c}`).join(', ') || 'none'} |`,
        )
    }
    const aborted = Object.values(m).some((x) => x.thresholds && Object.values(x.thresholds).some((ok) => ok === false))
    const md = [
        `### Load test ${setName}`,
        '',
        '| target | requests | p95 ms | failed % | cf-cache-status |',
        '| --- | --- | --- | --- | --- |',
        ...rows,
        '',
        `Total requests: ${val('http_reqs', 'count')}, rate: ${val('http_reqs', 'rate').toFixed(2)} rps, 5xx: ${val('server_errors', 'count')}.`,
        `Thresholds: ${aborted ? 'CROSSED (the run aborted or failed a stop condition)' : 'all held'}.`,
        '',
    ].join('\n')
    return { stdout: md, 'summary.md': md, 'summary.json': JSON.stringify(data, null, 2) }
}
