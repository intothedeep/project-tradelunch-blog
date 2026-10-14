# 14. blog_agent publish: an IPv6 connect failure, then a broken top image

Result (2026-10-13): 14.1 fixed in `753c2c9`. 14.2 fixed for one post by hand, root cause open. 14.3 is a reusable toolkit.

Script: `apps/blog_agent/scripts/publish_oneshot.py`.

## 14.1 `[Errno 51] Connect call failed ('2600:1f18:...', 5432, 0, 0)`

### Symptom

```text
Resolving category hierarchy: projects > cnn-from-scratch
PUBLISH FAIL: ... Upload failed: [Errno 51] Connect call failed ('2600:1f18:45ac:6d05:e9cd:d772:e2eb:dfd5', 5432, 0, 0)
```

- 8 images had already uploaded to OCI.
- The DB step failed. No post row was written.
- `.env` values were correct. The check script (14.3) printed:

| Line | Value |
| --- | --- |
| `DB target` | `db.mqrwxjvoyuvyjsbpqzby.supabase.co:5432 -> REMOTE (prod?)` |
| `STORAGE_PROVIDER` | `oci` |
| `bucket` | `blog-assets.prettylog.com` |
| `CDN_ASSETS` | `https://blog-assets.prettylog.com` |

### Cause

Question: credentials, server, or network?

```text
blog_agent (asyncpg) ─► db.<ref>.supabase.co:5432 ─► only an AAAA record (IPv6)
                                                      │
this network: no IPv6 route ─► Errno 51 (network unreachable)
```

- `configs/database.py` preferred `POSTGRES_URL_NON_POOLING`. That is the direct host `db.<ref>.supabase.co`.
- The direct host has only an IPv6 (AAAA) address. This network has no IPv6 route.
- Errno 51 on macOS means network unreachable. No packet path exists. It is not a server refusal and not a login error.
- Read the address in the error. It is IPv6. That points at the network, not at credentials.

Not verified: why this worked before. Two guesses. The network had IPv6 earlier. Or `POSTGRES_URL_NON_POOLING` held a pooler URL earlier.

### Diagnosis

psql 17 is at `/opt/homebrew/bin`. Build three URLs from `.env` and print them masked.

```sh
cd apps/blog_agent
H=db.<ref>.supabase.co
SP="$(grep '^POSTGRES_URL=' .env | cut -d= -f2- | tr -d "\"'" | sed 's/:6543/:5432/')"   # session pooler
PH="$(echo "$SP" | sed -E 's#.*@([^:/]+).*#\1#')"                                     # pooler host
echo "$SP" | sed -E 's#//([^:]+):[^@]*@#//\1:***@#'                                   # masked print

dig +short A $H; dig +short AAAA $H        # 1. direct host addresses
dig +short A $PH                           # 2. pooler host addresses
curl -6 -s -m 5 -o /dev/null -w 'ipv6 %{http_code}\n' https://ipv6.google.com   # 3. IPv6 route
pg_isready -h $H  -p 5432 -t 5             # 4. direct
pg_isready -h $PH -p 5432 -t 5             # 5. session pooler
pg_isready -h $PH -p 6543 -t 5             # 6. transaction pooler
psql "$SP" -c "select current_user, inet_server_port(), now();"
```

Owner's output, network checks (2026-10-13):

| # | Check | Output | Meaning |
| --- | --- | --- | --- |
| 1 | `dig A` / `AAAA` direct host | A: empty. AAAA: `2600:1f18:45ac:6d05:e9cd:d772:e2eb:dfd5` | direct host is IPv6-only |
| 2 | `dig A` pooler host | `44.216.29.125`, `44.208.221.186`, `52.45.94.125` (AWS ELB) | pooler has IPv4 |
| 3 | `curl -6` | `ipv6 000`, exit 28 (timeout) | this Mac has no IPv6 route |
| 4 | `pg_isready` direct :5432 | `no response`, exit 2 | same fault as `[Errno 51]` |
| 5 | `pg_isready` pooler :5432 | `accepting connections`, exit 0 | session pooler reachable |
| 6 | `pg_isready` pooler :6543 | `accepting connections`, exit 0 | transaction pooler reachable (blog_agent now uses it) |

The address in check 1 is the same address as in the `[Errno 51]` message.

Owner's output with the session pooler:

| Check | Output |
| --- | --- |
| `current_user` | `postgres` |
| `inet_server_port()` | `5432` |
| `now()` | `2026-10-14 01:06:51 UTC` |
| categories query before the publish | 0 rows |
| publish with `POSTGRES_URL_NON_POOLING="$SP"` as a prefix | `PUBLISH PASS`, post ID `368565578069184512` |
| category `projects` | `368565571240857600`, level 0 |
| category `cnn-from-scratch` | `368565576462766080`, parent `368565571240857600` |

How to read a result:

| Result | Meaning |
| --- | --- |
| `[Errno 51]` with an IPv6 address | no IPv6 route. Use a host with an A record |
| `[Errno 61]` or "refused" | server reachable, nothing listening |
| password or `FATAL` text | credentials. Only then check the keys |
| `psql "$SP"` works, direct fails | the network is the fault |

### Fix

Owner decision (2026-10-13). Status: fixed in `753c2c9`.

1. `configs/database.py` `_resolve_database_url` reads `POSTGRES_URL` (pooled, transaction pooler, port 6543) first. `POSTGRES_URL_NON_POOLING` is the fallback.
2. The transaction pooler can send each statement to a different backend. asyncpg prepared statements then break.
3. `db/connection.py` `get_engine` sets SQLAlchemy's documented pgbouncer setup:

```python
"statement_cache_size": 0,
"prepared_statement_cache_size": 0,
"prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
```

Note: Express (`dashboard_server`) already uses `POSTGRES_URL` and is unaffected. The comment in `.env.example` still states the old order. The owner edits it.

### Evidence

- `ruff`: "All checks passed!". `mypy`: "Success: no issues found in 40 source files".
- Read-only check through the app engine: `target: aws-0-us-east-1.pooler.supabase.com:6543`. 3 sessions x 6 parameterized statements OK (server port 5432).

## 14.2 The top image of a post does not load after a re-publish

### Symptom

- On the site, the first body image of the `00-overview` post is broken. The card image (og_image) is fine.
- DB check: `select left(content,60) ...` gave `![00-overview thumbnail](00-overview.png)`. A relative path, not a CDN URL.

### Cause

Question: why was this one line not rewritten?

```text
Run 1 (the failed 14.1 run)
  uploading_agent.py:196  resize_for_og(local_path)
  image_processing_agent.py:113  writes <stem>.webp INTO the post folder
        │
        ▼  folder now holds 00-overview.png + 00-overview.webp
Run 2
  extracting_parse.py ~197-207  every image with stem == article name
        overwrites `thumbnail`  ─► last one wins ─► .webp
        │
        ▼
  _replace_content_urls (~544)  matches only ..(<original_filename>)
        original_filename = 00-overview.webp  ─► the .png line stays
```

- (A) `agents/extracting_parse.py`: `if item.stem == article_name: thumbnail = str(item)`. The loop uses `iterdir()`. The last match wins.
- (B) `agents/image_processing_agent.py:113`: `out_path = output_path or str(Path(image_path).with_suffix(".webp"))`. With no `output_path`, the file lands next to the source.
- (C) `agents/uploading_agent.py`: the regex is `rf"!\[([^\]]*)\]\([^)]*{re.escape(original_filename)}\)"`. The markdown names `00-overview.png`, the file name is `00-overview.webp`. No match.

### Fix

Applied for this post only: change the markdown line to `00-overview.webp`, then publish again.

Owner's output after:

| Row | Value |
| --- | --- |
| rows for the slug | 2 |
| newest | `368567280277131264`, 2026-10-14 01:14:46, head `![00-overview thumbnail](https://blog-assets.prettylog.com/1...` |
| old version | `368565578069184512`, 01:08:00, still `00-overview.png` |

Versions are kept. The site shows the latest per slug. No row was deleted.

Root cause: OPEN. Proposed:

1. Write the OG webp to a temp dir with `resize_for_og(..., output_path=...)`. The post folder is never modified.
2. Pick the thumbnail deterministically. Prefer the file the markdown references. Else order png, jpg, jpeg, webp, gif, svg.
3. Move leftover `.webp` files out of the post folder (`00-overview` and the `how-to-build-quick-app` posts). Do not rename them to `x_...` in place. An `x_` name no longer matches the stem, so it would upload as a body image.

Rule of thumb: the first publish of a post folder is safe. A second publish hits this until the fix lands.

### Evidence

- The three code lines above.
- The two DB rows in the table above.

## 14.3 Toolkit

### Read-only queries (all against `$SP`)

```sh
# connection check
psql "$SP" -c "select current_user, inet_server_port(), now();"
# post versions by slug prefix
psql "$SP" -c "select id::text, created_at, left(content,60) from posts where slug like '<prefix>%' and deleted_at is null order by created_at desc;"
# duplicate root categories
psql "$SP" -c "select count(*) from categories where user_id=1 and title='projects' and deleted_at is null;"
```

- Also useful: categories for user 1 by title, and series posts by category id.
- The duplicate check matters. A root category has `parent_id` NULL, so the `(user_id,parent_id,title)` unique key from migration 0010 does not stop duplicates.

### Slugs

- The one-shot path builds the slug from the TITLE (`schema.generate_slug_from_title`), not the folder name.
- Site URL: `/blog/<username>/<slug>`. A leading `@` is also accepted and stripped by the route.
- Changing a title changes the slug and breaks cross-links.

### Publish command

```sh
uv run python scripts/publish_oneshot.py --no-llm ./posts/<cat>/<sub>/<slug>/<slug>.md
```

Exit codes: 0 = PASS, 1 = publish failure, 2 = bad path.

### Masked env check

Script: `apps/blog_agent/scripts/check_publish_env.py` (added 2026-10-13). It prints hosts, provider names and set/UNSET flags, never a secret value.

```sh
cd apps/blog_agent
uv run python scripts/check_publish_env.py
```

Output after the 14.1 fix:

```text
DB target        : aws-0-us-east-1.pooler.supabase.com:6543  -> REMOTE (prod?)
STORAGE_PROVIDER : oci
```

Read the first line before every publish. `db.<ref>.supabase.co` there means the IPv6-only direct host again.

## Lesson

1. Read the address family in a connect error before you blame credentials. An IPv6 address plus Errno 51 is a network fact.
2. A tool that writes into its input folder changes its own next input. Write outputs to a temp dir.
3. Verify content in the DB, not only the PASS line. Run 2 passed and still stored a relative path.
