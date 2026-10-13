# Method: seven habits the cases taught

Result: every habit below shortened at least one case in this book.

Purpose: one checklist to run before guessing.

## The loop

```text
symptom ─► shrink it ─► split the path ─► read the literal error ─► one change ─► re-check running value
   │          (curl -m)     (with / without       (host, scheme,       (one thing)     (pm2 env, ss)
   │                         middleware,           port)
   │                         VM vs tunnel)
   └── logs and docs disagree? read the framework source
```

## Table

| # | Habit | Case |
| --- | --- | --- |
| 1 | Put a timeout on every `curl` (`-m`) | Ch. 1 |
| 2 | Compare a path with middleware against one without | Ch. 1 |
| 3 | Test inside the VM, then through the tunnel | Ch. 1 |
| 4 | Read the error's URL literally | Ch. 1, 5 |
| 5 | Read framework source when logs and docs disagree | Ch. 1 |
| 6 | Change one thing, then re-check | Ch. 1, 7, 8 |
| 7 | Verify the running value, not the file | Ch. 8, 9 |

## How to use each habit

### 1. Timeouts on curl

1. Write `curl -m 20 ...` every time.
2. A hang then ends as `000` after 20 s. Without `-m` the terminal waits forever.
3. Example: `curl -m 20 http://127.0.0.1:3000/` gave `000` after 20 s in chapter 1.

### 2. Middleware path against a plain path

1. Pick one path the middleware matches (`/`).
2. Pick one it skips (`/robots.txt`, `/_next/*`, files with an extension).
3. Example: `/` hung, `/robots.txt` returned `200` in 0.25 s. The fault sits in the middleware.

### 3. Inside the VM first

1. `curl http://127.0.0.1:3000/` on the VM removes Cloudflare, the tunnel and TLS.
2. If it fails there, the fault is in the app. Stop looking at the tunnel.
3. Then curl the public host from the Mac. A new failure now points at the tunnel.

### 4. Read the URL literally

1. Copy the host, scheme and port from the error text.
2. Ask who built each part.
3. `Failed to proxy https://localhost:3000/` shows scheme `https` (from `X-Forwarded-Proto`) and host `localhost` (not the `HOSTNAME` we set).
4. `https://local.prettylog.com:3000` shows a port. Clerk rejected exactly that (chapter 5).

### 5. Framework source

1. Open `node_modules` at the file and line the stack names.
2. Chapter 1 settled on `resolve-routes.js:117` and `next-server.js:1132`. No doc said so.

### 6. One change at a time

1. Change one value. Re-run the same check.
2. A first hypothesis (Host header from cloudflared) died because a plain curl with no header also failed.
3. A reverted try (`unstable_rethrow`, chapter 3) is a result too. Write it down.

### 7. The running value

1. The file on disk is not the process environment.
2. Run `pm2 env $(pm2 id blog-web | tr -dc '0-9') | grep HOSTNAME`.
3. Run `ss -ltnp | grep ':3000'` for the real bind address.

## Reading

| You see | Think |
| --- | --- |
| `000` after the timeout | hang. Look for a proxy loop or a blocked call |
| `000` at once | refused. Nothing listens at that address |
| `200` static, hang on `/` | middleware |
| `500` with no CORS headers | origin not in the running list |
| `401` | wrong Clerk instance or `azp` not listed |
