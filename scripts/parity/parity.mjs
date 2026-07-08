/**
 * scripts/parity/parity.mjs
 *
 * Parity harness: hits the same finance endpoints on TWO backends and
 * deep-diffs the JSON responses.
 *
 * Ignores: timestamp-like fields (see IGNORED_KEYS) + array ordering
 * (arrays sorted by stable key before diff).
 *
 * Usage:
 *   node scripts/parity/parity.mjs [options]
 *
 * Options:
 *   --base-a  <url>     Base URL A (default: http://localhost:4000)
 *   --base-b  <url>     Base URL B (default: http://localhost:3002)
 *   --cik     <value>   CIK for /funds/:cik and /funds/:cik/rankflow
 *   --cusip   <value>   CUSIP for /securities/:cusip/consensus
 *   --ticker  <value>   Ticker for /securities/:ticker/by-ticker
 *   --filer   <value>   filerId for /politicians/:filerId
 *   --timeout <ms>      Request timeout in ms (default: 10000)
 *
 * Exit 0 = all endpoints match. Exit 1 = at least one divergence.
 *
 * Reuse note (B2.1): pass --base-a <finance_api-oracle-url> --base-b <dashboard_server-supabase-url>
 * to compare Oracle vs Supabase after data move.
 */

// ---------------------------------------------------------------------------
// Config defaults — replace with real values from your dataset, or pass via CLI
// ---------------------------------------------------------------------------

const DEFAULTS = {
  BASE_A: 'http://localhost:4000',   // finance_api (local dev)
  BASE_B: 'http://localhost:3002',   // dashboard_server (local dev)

  // Real sample params — caller MUST supply valid values for their dataset.
  // These defaults are illustrative; endpoints return data:null for unknown params.
  CIK: '0001067983',          // Example: Berkshire Hathaway
  CUSIP: '594918104',         // Example: Microsoft
  TICKER: 'MSFT',
  FILER: 'nancy_pelosi',      // Example kadoa filer_id slug format

  TIMEOUT_MS: 10_000,
};

// ---------------------------------------------------------------------------
// Fields to strip before comparison.
// These are generation-time / fetch-time values that legitimately diverge
// between two independently-running servers.
// Extend this set freely — it is the single source for normalization policy.
// ---------------------------------------------------------------------------

const IGNORED_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'generatedAt',
  'fetchedAt',
  'asOf',
  'timestamp',
  'lastModified',
  'cachedAt',
  'requestedAt',
]);

// ISO-8601 value pattern (generation-time strings we also ignore by value shape).
// Only applied when the key is NOT already in IGNORED_KEYS.
// We intentionally do NOT strip every date string — domain dates (quarters, disclosures)
// ARE part of the parity contract. Only scalar top-level "when was this generated" values.
// (Currently unused: key-based stripping covers all known cases. Left for extension.)
// const ISO_VALUE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// ---------------------------------------------------------------------------
// CLI parsing (no deps — hand-rolled for zero overhead)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--')) {
      args[key.slice(2)] = argv[i + 1] ?? true;
      i++;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Fetch with timeout
// ---------------------------------------------------------------------------

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return { ok: false, status: res.status, body: null };
    }
    const body = await res.json();
    return { ok: true, status: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, body: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Normalize: strip ignored keys + sort arrays by stable key
// ---------------------------------------------------------------------------

function normalize(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    const normalized = value.map(normalize);
    return stableSort(normalized);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (!IGNORED_KEYS.has(k)) {
        out[k] = normalize(v);
      }
    }
    return out;
  }
  return value;
}

/**
 * Sort an array of values by a stable, deterministic key.
 * Objects are sorted by a JSON fingerprint of their keys in alpha order
 * so that pure ordering differences (same records, different DB return order)
 * are ignored. Primitives sorted lexicographically.
 */
function stableSort(arr) {
  return [...arr].sort((a, b) => {
    const ka = stableKey(a);
    const kb = stableKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

function stableKey(v) {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'object') return String(v);
  // Deterministic fingerprint: sort object keys alphabetically, recurse.
  const keys = Object.keys(v).sort();
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, stableKey(v[k])])));
}

// ---------------------------------------------------------------------------
// Deep diff: returns array of { path, a, b } for every divergence.
// Compares normalized values only.
// ---------------------------------------------------------------------------

function deepDiff(a, b, path = '') {
  const diffs = [];
  if (a === b) return diffs;
  if (a === null || b === null || typeof a !== typeof b) {
    diffs.push({ path: path || '(root)', a, b });
    return diffs;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      diffs.push({ path: path || '(root)', a: `Array(${a.length})`, b: `Array(${b.length})` });
      return diffs;
    }
    for (let i = 0; i < a.length; i++) {
      diffs.push(...deepDiff(a[i], b[i], `${path}[${i}]`));
    }
    return diffs;
  }
  if (typeof a === 'object' && !Array.isArray(a)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      diffs.push(...deepDiff(a[k], b[k], path ? `${path}.${k}` : k));
    }
    return diffs;
  }
  if (a !== b) {
    diffs.push({ path: path || '(root)', a, b });
  }
  return diffs;
}

// ---------------------------------------------------------------------------
// Print helpers
// ---------------------------------------------------------------------------

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function pass(label) { return `${GREEN}PASS${RESET}  ${label}`; }
function fail(label) { return `${RED}FAIL${RESET}  ${label}`; }
function warn(label) { return `${YELLOW}WARN${RESET}  ${label}`; }

function printDiffs(diffs) {
  const MAX_SHOW = 10;
  for (const { path, a, b } of diffs.slice(0, MAX_SHOW)) {
    const aStr = JSON.stringify(a) ?? 'undefined';
    const bStr = JSON.stringify(b) ?? 'undefined';
    console.log(`        path: ${BOLD}${path}${RESET}`);
    console.log(`          A:  ${aStr.slice(0, 120)}`);
    console.log(`          B:  ${bStr.slice(0, 120)}`);
  }
  if (diffs.length > MAX_SHOW) {
    console.log(`        ... and ${diffs.length - MAX_SHOW} more divergences`);
  }
}

// ---------------------------------------------------------------------------
// Compare one endpoint
// ---------------------------------------------------------------------------

async function compareEndpoint(label, urlA, urlB, timeoutMs) {
  const [rA, rB] = await Promise.all([
    fetchJson(urlA, timeoutMs),
    fetchJson(urlB, timeoutMs),
  ]);

  // Network / timeout errors
  if (rA.error || rB.error) {
    const errA = rA.error ? `A error: ${rA.error}` : '';
    const errB = rB.error ? `B error: ${rB.error}` : '';
    console.log(warn(`${label} — fetch error [${[errA, errB].filter(Boolean).join(' | ')}]`));
    return { label, status: 'error' };
  }

  // HTTP errors
  if (!rA.ok || !rB.ok) {
    console.log(warn(`${label} — HTTP status A=${rA.status} B=${rB.status}`));
    return { label, status: 'http-error', statusA: rA.status, statusB: rB.status };
  }

  const normA = normalize(rA.body);
  const normB = normalize(rB.body);
  const diffs = deepDiff(normA, normB);

  if (diffs.length === 0) {
    console.log(pass(label));
    return { label, status: 'pass' };
  } else {
    console.log(fail(`${label} — ${diffs.length} divergence(s)`));
    printDiffs(diffs);
    return { label, status: 'fail', diffCount: diffs.length };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const BASE_A   = args['base-a'] ?? DEFAULTS.BASE_A;
  const BASE_B   = args['base-b'] ?? DEFAULTS.BASE_B;
  const CIK      = args['cik']     ?? DEFAULTS.CIK;
  const CUSIP    = args['cusip']   ?? DEFAULTS.CUSIP;
  const TICKER   = args['ticker']  ?? DEFAULTS.TICKER;
  const FILER    = args['filer']   ?? DEFAULTS.FILER;
  const TIMEOUT  = Number(args['timeout'] ?? DEFAULTS.TIMEOUT_MS);

  console.log(`\n${BOLD}Finance Parity Harness${RESET}`);
  console.log(`  A: ${BASE_A}`);
  console.log(`  B: ${BASE_B}`);
  console.log(`  params → cik=${CIK} cusip=${CUSIP} ticker=${TICKER} filer=${FILER}\n`);

  // Endpoint list — paths under /v1/api on each base URL.
  // Parameterized entries use the CLI-supplied or default sample values.
  const endpoints = [
    { label: '/dashboard',                     path: '/v1/api/dashboard' },
    { label: '/dashboard/history/batch',       path: '/v1/api/dashboard/history/batch' },
    { label: '/funds',                         path: '/v1/api/funds' },
    { label: `/funds/${CIK}`,                  path: `/v1/api/funds/${CIK}` },
    { label: `/funds/${CIK}/rankflow`,         path: `/v1/api/funds/${CIK}/rankflow` },
    { label: '/rankings',                      path: '/v1/api/rankings' },
    { label: '/rankings/flow',                 path: '/v1/api/rankings/flow' },
    { label: '/securities/screen',             path: '/v1/api/securities/screen' },
    { label: `/securities/${CUSIP}/consensus`, path: `/v1/api/securities/${CUSIP}/consensus` },
    { label: `/securities/${TICKER}/by-ticker`,path: `/v1/api/securities/${TICKER}/by-ticker` },
    { label: `/politicians/${FILER}`,          path: `/v1/api/politicians/${FILER}` },
  ];

  const results = [];
  for (const ep of endpoints) {
    const urlA = `${BASE_A}${ep.path}`;
    const urlB = `${BASE_B}${ep.path}`;
    const result = await compareEndpoint(ep.label, urlA, urlB, TIMEOUT);
    results.push(result);
  }

  // Summary table
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${BOLD}Summary${RESET}`);
  const passed  = results.filter((r) => r.status === 'pass').length;
  const failed  = results.filter((r) => r.status === 'fail').length;
  const errored = results.filter((r) => r.status === 'error' || r.status === 'http-error').length;

  for (const r of results) {
    const icon =
      r.status === 'pass'       ? `${GREEN}✓${RESET}` :
      r.status === 'fail'       ? `${RED}✗${RESET}` :
                                  `${YELLOW}?${RESET}`;
    const detail =
      r.status === 'fail'       ? ` (${r.diffCount} diff(s))` :
      r.status === 'http-error' ? ` (A=${r.statusA} B=${r.statusB})` :
      r.status === 'error'      ? ' (fetch error)' :
                                  '';
    console.log(`  ${icon}  ${r.label}${detail}`);
  }

  console.log(`\n  Passed: ${passed}  Failed: ${failed}  Errors: ${errored}  Total: ${results.length}`);
  console.log(`${'─'.repeat(60)}\n`);

  if (failed > 0 || errored > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Harness crashed:', err);
  process.exit(1);
});
