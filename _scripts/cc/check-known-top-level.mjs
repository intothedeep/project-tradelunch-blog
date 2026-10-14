#!/usr/bin/env node
// Guard for the proxy 404 allowlist (cc.design.md section 18, candidate A).
// Compares KNOWN_TOP_LEVEL_SEGMENTS with the static top-level route folders
// under apps/dashboard_client_web/app (route groups are looked through; dynamic,
// private and parallel folders are not static segments). Exit 1 on any difference.
// Plain node (24+ strips the types of the .ts import); file listing only, no build.
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '../../apps/dashboard_client_web');
const { KNOWN_TOP_LEVEL_SEGMENTS } = await import(join(web, 'utils/knownTopLevelSegments.ts'));

const ROUTE_FILE = /^(page|route)\.(tsx?|jsx?)$/;

function hasRoute(dir) {
    return readdirSync(dir, { withFileTypes: true }).some((e) =>
        e.isDirectory() ? hasRoute(join(dir, e.name)) : ROUTE_FILE.test(e.name)
    );
}

function staticSegments(dir) {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const p = join(dir, e.name);
        if (e.name.startsWith('(')) out.push(...staticSegments(p));
        else if (!/^[[_@]/.test(e.name) && hasRoute(p)) out.push(e.name);
    }
    return out;
}

const fromApp = new Set(staticSegments(join(web, 'app')));
const fromList = new Set(KNOWN_TOP_LEVEL_SEGMENTS);
const missingInList = [...fromApp].filter((s) => !fromList.has(s));
const extraInList = [...fromList].filter((s) => !fromApp.has(s));

console.log('app/ static top-level routes:', [...fromApp].sort().join(', '));
console.log('allowlist                   :', [...fromList].sort().join(', '));
if (missingInList.length || extraInList.length) {
    console.error('MISMATCH. In app/ but not in allowlist:', missingInList, '| in allowlist but not in app/:', extraInList);
    process.exit(1);
}
console.log('OK: allowlist matches app/');
