// Set L1: edge cache HIT burst (traffic.design.md 10.2). 8 rps x 40 s per target = 320, 640 total.
// Question: does the edge absorb a burst? Origin should see about 0 requests.
import { get, overCap, stop, summarize, WEB, API, MAX_VUS, PRE_VUS, baseOptions } from './common.js'

const SET = 'L1'
const CAP = 320 // per target

export const options = {
    ...baseOptions,
    scenarios: {
        web: { executor: 'constant-arrival-rate', exec: 'web', rate: 8, timeUnit: '1s', duration: '40s', preAllocatedVUs: PRE_VUS, maxVUs: MAX_VUS },
        api: { executor: 'constant-arrival-rate', exec: 'api', rate: 8, timeUnit: '1s', duration: '40s', preAllocatedVUs: PRE_VUS, maxVUs: MAX_VUS },
    },
    thresholds: {
        // Stop: more than 1 % non-200 answers (design 10.4 item 5).
        'http_req_failed{target:web}': stop('rate<=0.01'),
        'http_req_failed{target:api}': stop('rate<=0.01'),
        'http_req_duration{target:web}': ['p(95)<3000'], // informational, no abort (L1 stops on non-200 only)
        'http_req_duration{target:api}': ['p(95)<3000'],
    },
}

export function web() {
    if (overCap(CAP)) return
    get('web', `${WEB}/@taeklim/rust-config`, SET)
}

export function api() {
    if (overCap(CAP)) return
    get('api', `${API}/v1/api/posts?limit=1`, SET)
}

export function handleSummary(data) {
    return summarize(data, SET)
}
