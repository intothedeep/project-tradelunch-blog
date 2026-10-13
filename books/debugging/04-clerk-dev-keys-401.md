# 4. Local web with Clerk dev keys gets 401 from the prod API

Result: fixed 2026-10-13 by mode C in `apps/dashboard_client_web/LOCAL_PROD_API.md` (commit `cc5aead`).

## Symptom

| Where | What |
| --- | --- |
| Local web on `localhost:3000`, signed in with dev keys | calls to the prod API fail |
| API response | 401 `{"success":false,"message":"unauthorized"}` |
| Token `iss` | `https://epic-owl-28.clerk.accounts.dev` |
| Token `azp` | `http://localhost:3000` |

(Claim values read from the token the browser sent, 2026-10-13.)

## Cause

```text
localhost:3000 + Clerk dev key ─► token (iss = *.clerk.accounts.dev, azp = http://localhost:3000)
                                       ▼
prod API  verifyToken(secretKey = sk_live, authorizedParties = ALLOWED_ORIGINS_LIST)
                                       ▼
          not our instance, azp not listed ─► anonymous ─► 401
```

- `resolveAuth` returns `anonymous` on any verify error. The caller then answers 401.
- Two checks must pass: token from the production instance, and `azp` in `ALLOWED_ORIGINS`.
- Clerk production keys work only on `prettylog.com` and subdomains, never on `localhost`.

## Fix

Mode C: serve the local web as `https://local.prettylog.com` with production keys.
Steps: chapters 5 to 8 and `LOCAL_PROD_API.md`.

After the fix the token shows `iss` `https://clerk.prettylog.com` and `azp` `https://local.prettylog.com` (read from the token, 2026-10-13).

## Evidence

- `apps/dashboard_server/src/middlewares/resolveAuth.ts` lines 47 to 52 build `verifyOptions` with `authorizedParties`.
- Lines 59 to 61: the `catch` returns `{ kind: 'anonymous' }`.
- `LOCAL_PROD_API.md` status line: working end to end on 2026-10-13 (sign-in, comment write, CORS preflight 204).

## Lesson

Decode the token and read `iss` and `azp` before touching the server. They name the mismatch.
