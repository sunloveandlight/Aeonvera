# Aeonvera Production Readiness

Last updated: 2026-06-20

## Current Standard

Aeonvera should be treated as a health-data application. The production bar is:

- authenticated user data is never authorized from client-editable metadata
- profile-scoped data is resolved through `health_profile_id` where available
- downgraded profiles remain preserved but read-only once outside the active plan limit
- paid or expensive actions are rate-limited
- public share-token endpoints are rate-limited and do not reveal extra account state
- Stripe webhooks are signature-verified, idempotent, and retry-safe
- provider webhooks are signature-verified
- launch checks can be run without paid observability tooling

## API Route Control Matrix

All mutating routes are now in one of these buckets:

- `authenticated + rate-limited`: normal app writes, AI calls, uploads, syncs, profile/member changes, share creation, notification changes
- `signed webhook`: Stripe and Resend webhooks
- `cron secret`: scheduled jobs and deep health checks

Public token routes are read-only and rate-limited:

- `app/api/care-network/[inviteToken]/route.ts`
- `app/api/physician-share/[shareToken]/route.ts`
- `app/api/longevity/future-self/scenarios/[shareToken]/route.ts`

Signed or secret-protected routes intentionally do not use IP rate limiting because provider retries can come from shared infrastructure:

- `app/api/stripe/webhook/route.ts`
- `app/api/webhooks/resend/route.ts`
- `app/api/cron/daily-coach/route.ts`
- `app/api/cron/wearable-sync/route.ts`
- `app/api/ops/health/route.ts`

High-cost authenticated routes with explicit rate limits:

- `app/api/agent/chat/route.ts`
- `app/api/agent/planner/route.ts`
- `app/api/agent/realtime/route.ts`
- `app/api/agent/voice/route.ts`
- `app/api/labs/import/route.ts`
- `app/api/longevity/report/route.ts`
- `app/api/optimization/protocol/route.ts`
- `app/api/wearables/apple/import/route.ts`
- `app/api/wearables/oura/sync/route.ts`
- `app/api/wearables/whoop/sync/route.ts`
- `app/api/stripe/checkout/route.ts`
- `app/api/stripe/customer-portal/route.ts`
- `app/api/stripe/sync-subscription/route.ts`

## Profile And Downgrade Behavior

Expected behavior:

- profile data is not deleted on downgrade
- active profile count is controlled by `workspaces.max_health_profiles`
- profiles outside the writable plan rank are frozen
- frozen profiles can still be selected/read where the user has access
- writes to frozen profiles return a locked/frozen response
- subject-table writes are also guarded by database triggers where `health_profile_id` exists

Verification coverage:

- `tests/e2e/authenticated-profile-flow.spec.ts` creates secondary profiles, switches active profile context, exercises profile-scoped APIs, downgrades the writable limit, and verifies frozen writes return `423`.
- `supabase/migrations/20260620173008_freeze_profile_subject_writes.sql` enforces frozen subject writes at the database layer.

Launch-week check:

- rerun the authenticated profile flow against the production project after migrations are applied
- confirm `health_profile_access`, profile switching, and frozen-profile write failures in production logs

## Stripe Production Behavior

Expected behavior:

- checkout and customer portal are authenticated and rate-limited
- manual subscription sync is authenticated and rate-limited
- webhook events require `stripe-signature`
- webhook events are idempotent through `stripe_events`
- webhook event ids are rolled back if processing fails so Stripe retries can repair state
- plan changes update both `profiles` and `workspaces`
- downgrades preserve data and lower `max_health_profiles`, causing excess profiles to freeze

Launch-week check:

- verify live-mode webhook endpoint is enabled for `https://www.aeonvera.com/api/stripe/webhook`
- send Stripe CLI replay tests for checkout, subscription update, invoice failure, and subscription deletion
- confirm live price ids match Core, Elite, and Sovereign
- confirm Vercel production env uses `sk_live_` and the live webhook secret

## Visual QA Scope

Current targeted visual smoke scope:

- `/`
- `/about`
- `/login`
- `/pricing`
- `/demo`

Each route should pass desktop and mobile checks for:

- nonblank render
- no console errors or warnings
- no framework error overlay
- login password show/hide control inside the input

Launch-week full screenshot pack:

- all public routes
- all authenticated routes with a seeded test account
- desktop `1440x1000`
- mobile `390x844`

## Free Monitoring Baseline

Until traffic requires paid drains:

- keep structured JSON logs in API routes for webhook, sync, AI, import, and profile-freeze failures
- use Vercel Runtime Logs for incident triage
- use `/api/ops/health` for simple app/database health checks
- keep Supabase advisors, `npm audit`, e2e, build, and visual smoke in the release checklist
- set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production so rate limits remain durable across Vercel instances

## Verification Commands

Run before deployment:

```bash
npm run lint
npx tsc --noEmit --pretty false
npm run build
npm audit --omit=dev --audit-level=moderate
npm run test:e2e
supabase db advisors --linked --type performance
```

Targeted runtime smoke:

```bash
npm run dev -- --port 3000
```

Then run Playwright checks for the visual QA scope above.

## Launch Checklist

- Confirm all production env vars in Vercel.
- Confirm durable rate-limit env vars are present: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Confirm Supabase migrations are applied to production.
- Confirm Stripe live webhook events and live price ids.
- Confirm `/api/ops/health` returns `ok: true`.
- Confirm `robots.txt` excludes authenticated and ops routes.
- Confirm sitemap contains only public marketing/legal routes.
- Confirm public share-token pages do not expose private data without a valid token/access code.
- Confirm downgrade/frozen-profile behavior in production with a test workspace.
- Confirm email domain and Resend webhook.
- Confirm Google/Oura/WHOOP OAuth redirect URLs in production.
- Run final visual screenshot pack.
