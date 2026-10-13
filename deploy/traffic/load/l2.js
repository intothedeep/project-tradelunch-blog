// Set L2: origin MISS capacity (traffic.design.md 10.2). A unique `lt` query string
// per request gives a new cache key, so every request is a MISS and reaches the origin.
// Web runs first (4 x 60 s = 240 s, 450 requests), then api (4 x 30 s = 120 s, 450 requests),
// so the two origins are never loaded together and C_web, C_api stay separate.
import { get, overCap, seq, stop, summarize, WEB, API, MAX_VUS, PRE_VUS, baseOptions } from './common.js'

const SET = 'L2'
const CAP = 450 // per target; 900 total
const RUN = __ENV.RUN_ID || 'local'

export const options = {
    ...baseOptions,
    scenarios: {
        web: {
            executor: 'ramping-arrival-rate',
            exec: 'web',
            startRate: 0,
            timeUnit: '1s',
            preAllocatedVUs: PRE_VUS,
            maxVUs: MAX_VUS,
            stages: [
                { target: 0.5, duration: '0s' },
                { target: 0.5, duration: '60s' },
                { target: 1, duration: '0s' },
                { target: 1, duration: '60s' },
                { target: 2, duration: '0s' },
                { target: 2, duration: '60s' },
                { target: 4, duration: '0s' },
                { target: 4, duration: '60s' },
            ],
        },
        api: {
            executor: 'ramping-arrival-rate',
            exec: 'api',
            startTime: '250s', // after web ends (240 s) plus a short drain
            startRate: 0,
            timeUnit: '1s',
            preAllocatedVUs: PRE_VUS,
            maxVUs: MAX_VUS,
            stages: [
                { target: 1, duration: '0s' },
                { target: 1, duration: '30s' },
                { target: 2, duration: '0s' },
                { target: 2, duration: '30s' },
                { target: 4, duration: '0s' },
                { target: 4, duration: '30s' },
                { target: 8, duration: '0s' },
                { target: 8, duration: '30s' },
            ],
        },
    },
    thresholds: {
        // Stop: any 5xx, failed rate above 2 %, p95 above 3 s (design 10.4 item 5).
        server_errors: stop('count<1'),
        'http_req_failed{target:web}': stop('rate<=0.02'),
        'http_req_failed{target:api}': stop('rate<=0.02'),
        'http_req_duration{target:web}': stop('p(95)<3000'),
        'http_req_duration{target:api}': stop('p(95)<3000'),
    },
}

export function web() {
    if (overCap(CAP)) return
    get('web', `${WEB}/?lt=${RUN}-${seq()}`, SET)
}

export function api() {
    if (overCap(CAP)) return
    get('api', `${API}/v1/api/posts?limit=1&lt=${RUN}-${seq()}`, SET)
}

export function handleSummary(data) {
    return summarize(data, SET)
}
