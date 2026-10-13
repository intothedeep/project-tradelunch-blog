// PM2 apps for the GCP VM (design §3.4). No secrets here: they come from
// ~/prettylog/shared/{api,web}.env at load time. Copied to ~/prettylog/ on deploy.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(os.homedir(), 'prettylog');

// KEY=VALUE per line; blank lines and # comments skipped. Does not rely on
// PM2's own env-file support. A missing file yields {} so `pm2 start` still loads.
function readEnvFile(file) {
    if (!fs.existsSync(file)) return {};
    const env = {};
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!m || line.trim().startsWith('#')) continue;
        env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
    }
    return env;
}

module.exports = {
    apps: [
        {
            name: 'blog-api',
            cwd: path.join(root, 'api/current'),
            script: 'dist/src/index.js',
            exec_mode: 'fork',
            instances: 1,
            max_memory_restart: '200M',
            node_args: '--max-old-space-size=160',
            // Spread order: base values win over the secret file so a stray
            // PORT/HOST_NAME in shared/*.env cannot move the binding.
            env: {
                ...readEnvFile(path.join(root, 'shared/api.env')),
                NODE_ENV: 'production',
                PORT: '4000',
                HOST_NAME: '127.0.0.1',
            },
        },
        {
            // Started in M3 (release.sh starts it on first `web` release).
            name: 'blog-web',
            cwd: path.join(root, 'web/current/apps/dashboard_client_web'),
            script: 'server.js',
            exec_mode: 'fork',
            instances: 1,
            max_memory_restart: '320M',
            node_args: '--max-old-space-size=256',
            env: {
                ...readEnvFile(path.join(root, 'shared/web.env')),
                NODE_ENV: 'production',
                PORT: '3000',
                // `localhost`, not `127.0.0.1` (2026-10-13). Next 16 builds the
                // middleware request URL as http://localhost:<port> but its
                // router origin from HOSTNAME. With 127.0.0.1 the two differ,
                // so Clerk's same-URL rewrite (every request) looked external
                // and Next proxied to itself: "Failed to proxy http://localhost:3000/".
                // Still loopback only: localhost resolves to 127.0.0.1 here.
                HOSTNAME: 'localhost',
            },
        },
    ],
};
