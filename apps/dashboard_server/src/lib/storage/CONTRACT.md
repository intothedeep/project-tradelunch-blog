# Storage Provider Contract (SSOT)

Cross-runtime behavioral contract for the provider-swappable image/file storage module.
Implemented **twice** — TS (`apps/dashboard_server/src/lib/storage/`) and Python
(`apps/blog_agent/db/storage/`) — which MUST stay in sync with this document.

> This is a **behavioral** contract (byte movement), not a wire schema. Keep method names,
> param order, and `upsert` semantics identical across both runtimes.

## 1. Provider interface — bytes only

Three methods. Method names are **identical** in both runtimes: `put` / `remove` / `exists`.

```
put(key: string, body: bytes, contentType: string, opts: { upsert: boolean }) -> void   # throws on failure
remove(key: string) -> void                                                              # idempotent (no-op if absent)
exists(key: string) -> boolean
```

The provider does **byte movement only**. It does NOT build URLs, keys, or run image transforms.

### Deliberately EXCLUDED from the interface (YAGNI)
- **`publicUrl`** — NOT per-provider. It is one **shared pure function** (see §2). The public URL is
  CDN-CNAME fronted, so it is identical for every provider.
- **`signedUrl` / `get`** — Supabase-only today, unused in the write path. Do not add to the contract
  until a pre-signed-read need is proven. A provider MAY expose it as an extra (non-contract) method.
- **`list`** — an internal detail of some providers' `exists`; not in the contract.

## 2. Shared pure function — `buildPublicUrl` / `build_public_url`

```
buildPublicUrl(cdnBase: string, bucket: string, key: string) -> string
  = `${cdnBase.replace(/\/+$/,'')}/${bucket}/${key}`
```

Identical output in both runtimes. This is why swapping providers rewrites **zero** `files.stored_uri`
rows — the URL depends only on `CDN_ASSETS` + bucket + key, never on the backend.

## 3. `upsert` semantics (the cross-provider footgun)

The flag means "overwrite an existing object at `key`". Backends differ; the provider must normalize:

| Backend | Native default | `upsert: true` | `upsert: false` |
|---|---|---|---|
| **Supabase** | 409 on existing key | send `x-upsert: true` | send `x-upsert: false` (default) |
| **S3 / OCI** | PUT overwrites silently | plain PutObject | **emulate**: HeadObject first → throw if key exists, else PutObject |

Call-site choices (keep as-is):
- **Express `/images`** uses `upsert: false` (a unique `-{ts}-{rand}` suffix already prevents collisions).
- **blog_agent** uses `upsert: true` (idempotent re-publish of the same slug).

## 4. Provider set (build now)

- `supabase` — native REST (TS `fetch` PUT) / `supabase-py` (Python). Default.
- `oci` **and** `s3` — ONE S3-compatible class each runtime (`@aws-sdk/client-s3` / `boto3`, SigV4).
  `oci` uses path-style addressing (`forcePathStyle: true` / `addressing_style='path'`) + a custom endpoint.
  They differ only by env values, not by code.
- No `local` filesystem provider yet (YAGNI).

## 5. Env matrix (provider-agnostic `STORAGE_*`)

Selector + creds are read once per runtime (TS `env.schema.ts`, Python `configs/storage.py`).

| Var | Used by | Notes |
|---|---|---|
| `STORAGE_PROVIDER` | all | `supabase` (default) \| `oci` \| `s3` |
| `STORAGE_ENDPOINT` | oci, s3 | e.g. `https://{ns}.compat.objectstorage.{region}.oraclecloud.com` |
| `STORAGE_ACCESS_KEY` | oci, s3 | S3 access key id (OCI Customer Secret Key) |
| `STORAGE_SECRET_KEY` | oci, s3 | S3 secret access key |
| `STORAGE_REGION` | oci, s3 | e.g. `ap-osaka-1` |
| `STORAGE_BUCKET_IMAGE` | all | **MUST be `blog.prettylog`** — changing it forces a `files.stored_uri` rewrite |
| `STORAGE_BUCKET_FILE` | (reserved) | optional; no non-image upload path exists yet — do not wire until one does |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | supabase | existing, keep |
| `CDN_ASSETS` | all | public URL base (`https://assets.prettylog.com`), never changes on swap |

## 6. Key scheme (preserved verbatim — provider-independent)

- **Express**: `{userId}/{normalized-filename}-{timestamp}-{random}.webp`
- **blog_agent thumbnail**: `{user_id}/{folder_path}/{slug}/{slug}.webp`
- **blog_agent body image**: `{user_id}/{folder_path}/{slug}/{slug}-{index}.webp`

Key building stays a **separate pure helper** (`imagePath.ts` / `build_object_key()`), NOT inside the
provider. Image transform (sharp / PIL → WebP) also stays a **caller concern**, NOT in the provider.
