# Free-tier specs for the blog's services (2026-10)

- Scope: official free-tier limits for GCP, Cloudflare, OCI, Supabase, Clerk, GitHub Actions.
- Accessed: 2026-10-14 for every row.
- Tags: `[secondary]` = not from a vendor page. `[CONFLICT]` = sources disagree. `[UNVERIFIED]` = not found.

## Summary

- rows kept: 33 (verified 31, partial 2: GCP external IPv4 price, Cloudflare bandwidth)
- rows unverified: 0
- conflicts: 0
- sources: 22
- second pass: every number was re-read on 2026-10-14. Most re-reads may have hit the fetch tool's 15-minute cache.
- The GCP free-tier page and Clerk pricing were re-fetched with a cache-busting query string. Both matched.

## Table

| Service | Item | Free amount | Notes | Source (URL, accessed 2026-10-14) |
| --- | --- | --- | --- | --- |
| GCP Compute Engine | e2-micro VM | 1 non-preemptible `e2-micro` instance per month | Limit is by time: free hours = hours in the month, summed across all e2-micro VMs and the 3 regions. GPUs/TPUs never free. verified | [S-FT-1] https://docs.cloud.google.com/free/docs/free-cloud-features |
| GCP Compute Engine | Eligible regions | `us-west1` (Oregon), `us-central1` (Iowa), `us-east1` (South Carolina) | US only. verified | [S-FT-1] https://docs.cloud.google.com/free/docs/free-cloud-features |
| GCP Compute Engine | Standard persistent disk | 30 GB-months | Standard PD only (not balanced/SSD, per wording). verified | [S-FT-1] https://docs.cloud.google.com/free/docs/free-cloud-features |
| GCP Compute Engine | Network egress | 1 GB/month | "from North America to all region destinations (excluding China and Australia)". verified | [S-FT-1] https://docs.cloud.google.com/free/docs/free-cloud-features |
| GCP Compute Engine | Snapshot storage | Not listed | The 2026-10 free-tier page lists no snapshot allotment. Treat snapshots as billed (inference from absence). Snapshot price not looked up. verified (absence) | [S-FT-1] https://docs.cloud.google.com/free/docs/free-cloud-features |
| GCP Compute Engine | External IPv4 on the free e2-micro | Not in free tier. In-use IP on a standard VM: $0.005/hour (spot VM $0.0025/hour), since 2024-02-01. Unused static IP: $0.01/hour `[secondary]` | Free-tier page lists no external IP [S-FT-1]. In-use price from Google's own change notice, dated 2024 (was $0.004) [S-FT-22]. A 2026-01-05 secondary repeats $0.005 [S-FT-3]. Unused-IP price is from S-FT-3 only. Live pricing table did not render [S-FT-2]. partial (2024 first-party, corroborated 2026) | [S-FT-22] https://cloud.google.com/vpc/pricing-announce-external-ips . [S-FT-3] https://www.doit.com/blog/gcp-cost-savings-automating-the-cleanup-of-unused-external-ips-with-cloudflow |
| GCP Cloud Logging | Log ingestion/storage | First 50 GiB of log data per project per month | Logs kept for the default retention period incur no retention cost. verified | [S-FT-1] https://docs.cloud.google.com/free/docs/free-cloud-features |
| GCP Cloud Logging | Default retention | `_Default` bucket 30 days (configurable). `_Required` bucket 400 days (not configurable) | verified | [S-FT-5] https://docs.cloud.google.com/logging/quotas |
| Cloudflare Free | CDN / caching | Included ("free SSL, CDN, DDoS protection and more") | HTML and JSON not cached by default. Max cacheable file 512 MB (Free, Pro, Business). verified | [S-FT-6] https://www.cloudflare.com/plans/free/ . [S-FT-7] https://developers.cloudflare.com/cache/concepts/default-cache-behavior/ |
| Cloudflare Free | Bandwidth | No numeric cap found on official pages | Terms allow Cloudflare to limit CDN use without Paid Services "to serve video or a disproportionate percentage of pictures, audio files, or other large files". "Unlimited/unmetered bandwidth" wording not found on a page read. partial | [S-FT-8] https://www.cloudflare.com/service-specific-terms-application-services/ |
| Cloudflare Free | Cache Rules | 10 rules | Pro 25, Business 50, Enterprise 300. verified | [S-FT-9] https://developers.cloudflare.com/cache/how-to/cache-rules/ |
| Cloudflare Free | Rate limiting rules | 1 rule | Counting characteristic: IP only. Period: 10 s. Mitigation timeout: 10 s. Expression fields: Path, Verified Bot. No cache exclusion, no custom counting expression, no throttle action. verified | [S-FT-10] https://developers.cloudflare.com/waf/rate-limiting-rules/ |
| Cloudflare Free | Cloudflare Tunnel | $0 | Docs: "Available on all plans". Blog 2021-04-15: usable "at no cost". verified | [S-FT-11] https://developers.cloudflare.com/tunnel/ . [S-FT-12] https://blog.cloudflare.com/tunnel-for-everyone/ |
| Cloudflare Free | Workers | 100,000 requests/day. 10 ms CPU per HTTP request | Memory 128 MB. Subrequests 50 per request. verified | [S-FT-13] https://developers.cloudflare.com/workers/platform/limits/ |
| Cloudflare Free | DDoS protection | Standard, unmetered, layers 3-7 | "Yes" for Free in the availability table. verified | [S-FT-14] https://developers.cloudflare.com/ddos-protection/ |
| Cloudflare Free | TLS (Universal SSL) | Free certificate, issued and renewed by Cloudflare | Full setup covers apex + first-level subdomains only (`a.example.com`, not `b.a.example.com`). verified | [S-FT-15] https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/ |
| OCI Always Free | Object Storage (Always Free-only account) | 20 GB combined Standard + Infrequent Access + Archive | Applies once the Free Trial has ended. Home region only. verified | [S-FT-16] https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm |
| OCI Always Free | Object Storage (paid account or trial with credits) | 10 GB Standard + 10 GB Infrequent Access + 10 GB Archive | Home region only. verified | [S-FT-16] https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm |
| OCI Always Free | Object Storage API requests | 50,000 per month | Both account states. verified | [S-FT-16] https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm |
| OCI Always Free | Outbound data transfer | 10 TB per month | verified | [S-FT-16] https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm |
| Supabase Free | Database size | 500 MB per project | Shared CPU, 500 MB RAM (Nano compute). verified | [S-FT-17] https://supabase.com/pricing |
| Supabase Free | Egress | 5 GB egress + 5 GB cached egress | verified | [S-FT-17] https://supabase.com/pricing |
| Supabase Free | Monthly active users (Auth) | 50,000 MAU | verified | [S-FT-17] https://supabase.com/pricing |
| Supabase Free | File storage | 1 GB | Max upload 50 MB per file. verified | [S-FT-17] https://supabase.com/pricing |
| Supabase Free | Pausing | Paused after 1 week (7 days) of inactivity | verified | [S-FT-17] https://supabase.com/pricing |
| Supabase Free | Projects | 2 active projects | verified | [S-FT-17] https://supabase.com/pricing |
| Supabase Free | Connections | Pooler (Supavisor) max clients 200. Direct DB connections 60 | Docs: "Nano (free plan)", limits section gives 60 / 200. The pricing page lists 60 / 200 only in the paid Micro add-on row, silent on Free. Same numbers, so no conflict. verified | [S-FT-18] https://supabase.com/docs/guides/platform/compute-and-disk . [S-FT-17] https://supabase.com/pricing |
| Clerk Free (Hobby) | Users | 50,000 MRU per app | Metric is Monthly Retained Users (MRU): a user who visits at least one day after sign-up. Not MAU. Above 50,000 MRU the app must upgrade to Pro, with a one-month grace period. B2B: 100 MRO (monthly retained orgs) per app, up to 20 members per org. verified | [S-FT-19] https://clerk.com/pricing |
| Clerk Free (Hobby) | Key features excluded | Not included: remove "Secured by Clerk" branding, MFA, custom session lifetime (fixed 7 days), SSO connections (SAML/OIDC/EASIE), Directory Sync, passkeys, biometric sign-in, SMS codes, custom password requirements, custom email templates, user bans, allowlist/blocklist, simultaneous sessions, satellite domains, admin logs, SOC2 report, HIPAA | Read twice. The second read added SMS, passwords, email templates, Directory Sync, SOC2, HIPAA. verified | [S-FT-19] https://clerk.com/pricing |
| GitHub Actions (GitHub Free) | Public repos | Free (standard GitHub-hosted runners) | Self-hosted runners also free. verified | [S-FT-20] https://docs.github.com/en/billing/concepts/product-billing/github-actions |
| GitHub Actions (GitHub Free) | Private repos minutes | 2,000 minutes/month | Linux 2-core $0.006/min beyond quota. Windows and macOS cost more per minute. verified | [S-FT-20] https://docs.github.com/en/billing/concepts/product-billing/github-actions |
| GitHub Actions (GitHub Free) | Artifact storage | 500 MB | Cache: 10 GB per repository. verified | [S-FT-20] https://docs.github.com/en/billing/concepts/product-billing/github-actions |
| GitHub Actions | Artifact/log retention default | 90 days | Configurable 1-90 days (public), 1-400 days (private). verified | [S-FT-21] https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization |

## Caveats

- GCP in-use external IPv4 price ($0.005/hour) comes from Google's 2024-02-01 change notice. The live VPC pricing table did not render for the fetch tool (4 tries). A 2026 secondary repeats the same value.
- GCP unused static IP price ($0.01/hour) is `[secondary]` only.
- A 2019 DoiT post gave $0.004/hour. That was the pre-2024 price, so it is superseded, not `[CONFLICT]`.
- GCP free-tier page (2026-10) lists no snapshot allotment and no external IP. Both are billed.
- GCP free egress is 1 GB/month only. Origin traffic served through Cloudflare still counts as VM egress (inference).
- Cloudflare publishes no numeric bandwidth cap for Free. The only limit found is the terms clause on video and large files.
- Cloudflare Free caches no HTML or JSON by default. HTML caching needs a Cache Rule (10 allowed).
- Cloudflare Free rate limiting is narrow: 1 rule, IP only, 10 s window, 10 s block.
- OCI Object Storage depends on account state: 20 GB combined (Always Free-only) vs 10 + 10 + 10 GB (paid or trial). Home region only.
- Clerk counts retained users (MRU), not sign-ups or MAU. 50,000 is a hard cap on Hobby.
- Supabase Free pauses a project after 7 days of inactivity.
- GitHub: public repos on standard runners are free with no minute quota. The 2,000 minutes and 500 MB apply to private repos.
- No `[CONFLICT]` rows were found.

## open_questions

- GCP external IPv4: live pricing table [S-FT-2] not readable by the fetch tool. In-use $0.005/hour rests on the 2024 notice [S-FT-22]. Unused $0.01/hour is `[secondary]` [S-FT-3]. Confirm in the console billing SKU list.

## Sources

[S-FT-1] Google Cloud Free Tier: Free cloud features | https://docs.cloud.google.com/free/docs/free-cloud-features | published: undated | accessed: 2026-10-14 | type: official | note: Compute Engine and Observability sections read twice
[S-FT-2] Google Cloud: Network pricing | https://cloud.google.com/vpc/network-pricing | published: undated | accessed: 2026-10-14 | type: official | note: price table truncated in fetch, no value read
[S-FT-3] DoiT: GCP cost savings, automating the cleanup of unused external IPs with CloudFlow | https://www.doit.com/blog/gcp-cost-savings-automating-the-cleanup-of-unused-external-ips-with-cloudflow | published: 2026-01-05 | accessed: 2026-10-14 | type: blog | note: secondary, read twice, links Google pricing table
[S-FT-4] DoiT: No more free external IPs on Google Cloud | https://www.doit.com/blog/no-more-free-external-ips-on-google-cloud-how-much-will-it-cost-you | published: 2019-12-02 | accessed: 2026-10-14 | type: blog | note: STALE, superseded by S-FT-3
[S-FT-5] Cloud Logging: Quotas and limits | https://docs.cloud.google.com/logging/quotas | published: undated | accessed: 2026-10-14 | type: official | note: retention rows read twice
[S-FT-6] Cloudflare Free plan | https://www.cloudflare.com/plans/free/ | published: undated | accessed: 2026-10-14 | type: official
[S-FT-7] Cloudflare Docs: Default cache behavior | https://developers.cloudflare.com/cache/concepts/default-cache-behavior/ | published: undated | accessed: 2026-10-14 | type: official
[S-FT-8] Cloudflare Service-Specific Terms: Application Services | https://www.cloudflare.com/service-specific-terms-application-services/ | published: undated | accessed: 2026-10-14 | type: official
[S-FT-9] Cloudflare Docs: Cache Rules | https://developers.cloudflare.com/cache/how-to/cache-rules/ | published: undated | accessed: 2026-10-14 | type: official | note: availability table read twice
[S-FT-10] Cloudflare Docs: Rate limiting rules | https://developers.cloudflare.com/waf/rate-limiting-rules/ | published: undated | accessed: 2026-10-14 | type: official | note: availability table read twice
[S-FT-11] Cloudflare Docs: Cloudflare Tunnel | https://developers.cloudflare.com/tunnel/ | published: undated | accessed: 2026-10-14 | type: official | note: read twice
[S-FT-12] Cloudflare Blog: A Boring Announcement: Free Tunnels for Everyone | https://blog.cloudflare.com/tunnel-for-everyone/ | published: 2021-04-15 | accessed: 2026-10-14 | type: official
[S-FT-13] Cloudflare Workers Docs: Limits | https://developers.cloudflare.com/workers/platform/limits/ | published: undated | accessed: 2026-10-14 | type: official | note: read twice
[S-FT-14] Cloudflare Docs: DDoS Protection | https://developers.cloudflare.com/ddos-protection/ | published: undated | accessed: 2026-10-14 | type: official | note: read twice
[S-FT-15] Cloudflare Docs: Universal SSL | https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/ | published: undated | accessed: 2026-10-14 | type: official
[S-FT-16] Oracle Cloud Infrastructure Docs: Always Free Resources | https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm | published: undated | accessed: 2026-10-14 | type: official | note: read twice
[S-FT-17] Supabase Pricing | https://supabase.com/pricing | published: undated | accessed: 2026-10-14 | type: official | note: read twice
[S-FT-18] Supabase Docs: Compute and Disk | https://supabase.com/docs/guides/platform/compute-and-disk | published: undated | accessed: 2026-10-14 | type: official | note: read twice
[S-FT-19] Clerk Pricing | https://clerk.com/pricing | published: undated | accessed: 2026-10-14 | type: official | note: read three times
[S-FT-20] GitHub Docs: GitHub Actions billing | https://docs.github.com/en/billing/concepts/product-billing/github-actions | published: undated | accessed: 2026-10-14 | type: official | note: read twice
[S-FT-21] GitHub Docs: Configuring the retention period for GitHub Actions artifacts and logs in your organization | https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization | published: undated | accessed: 2026-10-14 | type: official | note: read twice
[S-FT-22] Google Cloud: Announcement of pricing change for external IPv4 addresses in use by VMs | https://cloud.google.com/vpc/pricing-announce-external-ips | published: effective 2024-02-01 | accessed: 2026-10-14 | type: official | note: read once
