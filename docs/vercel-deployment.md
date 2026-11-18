# Deploying MabatID on Vercel

[← Technical reference](technical-reference.md) · [README](../README.md)

These instructions are for the project team. The repository is prepared for Vercel; a Vercel project, its environment variables, domain and final deployment are configured separately in the team's account.

## Repository defaults

| Setting | Configuration |
| --- | --- |
| Framework | Next.js, selected in `vercel.json` |
| Node.js | `26.x`, pinned in `package.json` and `.nvmrc` |
| Install | `npm ci` |
| Build | `npm run check` |
| Output | Next.js default; leave the output-directory override unset |
| Function region | `sin1` (Singapore), a regional default for the Philippine audience; align it with the Supabase region if different |
| Planning function duration | 30 seconds |

`npm run check` requires zero lint warnings, runs the tests, validates server environment variable formats on Vercel, and creates the production build (including TypeScript checking). The test runner explicitly uses test settings and disables Vercel detection in its child process so build-time tests never consume hosted planning quotas.

The build environment check validates formats, not database connectivity or permissions. A successful build must still be followed by the live checks below.

## Project configuration

1. Import `sagembng/MabatID` into the intended Vercel team.
2. Use the repository root and the Next.js framework preset. Let `vercel.json` supply install and build commands.
3. Configure the server environment variables before deploying.
4. Use `main` as the production branch when ready to publish. Vercel Git integration normally deploys pushes to that branch automatically.
5. Configure the chosen domain and verify the app through HTTPS. Do not use a static-export preset; planning, feedback and transfers require server functions.

No Vercel project, account settings or deployment is created by these repository files.

## Environment variables

Set these in the Vercel project's **Settings → Environment Variables** for Production:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | The existing Supabase project URL. |
| `SUPABASE_SECRET_KEY` | The existing server secret key, or a legacy `service_role` key. A publishable/anon key will not work. |
| `TRANSFER_CODE_SECRET` | The existing 64-hex secret. Keep it stable across deployments and instances. |
| `ENGAGEMENT_SECRET` | Optional separate 64-hex secret; leave unset to use `TRANSFER_CODE_SECRET`. |

Copy the actual values privately from the team's environment configuration. Do not commit `.env.local`, print secret values in build logs, or add `NEXT_PUBLIC_` prefixes. Environment changes require a new deployment to affect existing functions.

Vercel's system environment variables (`VERCEL`, `VERCEL_ENV`, and related metadata) should remain enabled. Do not override `NODE_ENV` in project settings. The app automatically trusts Vercel's `x-vercel-forwarded-for` header only when `VERCEL=1`; `TRANSFER_TRUSTED_IP_HEADER`, `ENGAGEMENT_TRUSTED_IP_HEADER` and `PLANNING_TRUSTED_IP_HEADER` can stay unset on Vercel.

Use a separate Supabase project and secrets for Preview when testing mutations. Planning counters have separate production/preview namespaces, but transfer, likes and feedback data otherwise belong to whichever Supabase project is configured. Preview deployments without the required variables fail the build instead of publishing nonfunctional APIs.

## Database readiness

For the already configured project, the transfer and engagement schemas were applied through the Supabase SQL Editor. Do not rerun their `CREATE TABLE` migrations. SQL Editor execution does not populate CLI migration history; reconcile that history before introducing automated CLI migrations.

For a new database, follow [server and database setup](technical-reference.md#server-and-database-setup) and [engagement setup](technical-reference.md#setup).

Before launch, run [the transfer verification query](../supabase/verify-transfers.sql) in Supabase. Confirm:

- Schema version is `1`.
- Both transfer tables have RLS enabled.
- Anon/authenticated table and RPC access are false.
- No relay functions use security definer.
- Exactly one named cleanup job is active.

If the cleanup job is missing, run [transfer-cleanup.sql](../supabase/transfer-cleanup.sql) once. It schedules cleanup every minute within Supabase; a Vercel cron is not required. Expiry blocks access immediately, while cleanup removes expired rows. Check the Supabase Cron run history after setup to confirm successful runs.

The weekly likes/feedback migration also provides the `mabatid_engagement_rate` function used by planning. There is no additional planning migration to apply. Supabase Security Advisor should show no errors or warnings; informational “RLS Enabled No Policy” entries are intentional for server-only tables.

These database checks are operator steps. The repository does not claim to have checked a hosted cron job during a build.

## Request limits

Both planning endpoints share limits backed by Postgres, so restarting or scaling Vercel functions does not reset them:

| Limit | Window |
| --- | --- |
| 60 planning attempts per trusted client IP | 60 seconds |
| 300 planning attempts overall | 60 seconds |

The per-IP check runs first so repeated rejected attempts from one IP do not drain the overall allowance. Both `/api/plans/tree` and `/api/plans/preview` consume the same quota. Preview and production quotas are separate. IPs are HMAC-hashed before storage; profile fields are not stored in these counters.

Limits apply in production and hosted previews. Missing configuration, invalid/missing Vercel IP metadata, unavailable rate storage, or a missing rate function returns `503` before planning begins. Exceeded quotas return `429`. Both include `Retry-After: 60` and uncached responses. Local development and unit tests do not consume hosted counters.

Transfers, likes and feedback retain their existing shared database limits and automatically gain their configured per-IP protection on Vercel. Optional header overrides are for other deployments where the proxy reliably overwrites that header.

For additional protection before a function is invoked, add a Vercel Firewall rule after creating the project: match POST requests to `/api/plans/tree` or `/api/plans/preview`, count by IP using a fixed 60-second window, allow 60 requests and return 429 above it. Observe normal traffic and adjust for real usage, especially shared school or office networks. Firewall settings are account-side configuration; `vercel.json` does not install this rate rule.

## Verify the deployed URL

1. Confirm the landing page, ID illustrations and team-card enlarge/flip controls render correctly on desktop and mobile.
2. Try the planner as a guest, then create a disposable profile and verify saved progress survives reload.
3. Check `GET /api/transfers/status` returns `{ "enabled": true }`.
4. Check `GET /api/likes` returns a real count, Philippine week, reset timestamp and browser state.
5. Using disposable data, verify a like survives reload and appears consistently on the landing page and in Settings.
6. Submit test feedback from a completed profile, confirm the team can review it in Supabase, then remove the test submission.
7. Transfer a disposable profile between browsers and verify review, cancellation and successful import. Check the cleanup job's run history.
8. Confirm planning limits return 429 and unavailable rate storage returns 503 in a preview environment, not by load-testing production.
9. Check Vercel runtime logs for 403, 429, 503 and timeout errors. Check usage monitoring and spending controls for the selected plan.

Production verification requires a deployed URL. Passing repository checks does not substitute for these steps.

## References

- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Function regions](https://vercel.com/docs/regions)
- [Trusted Vercel request headers](https://vercel.com/docs/headers/request-headers)
- [Vercel Firewall rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
