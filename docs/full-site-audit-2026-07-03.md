# Aeonvera — Full Site Audit (2026-07-03)

Scope: complete multi-layer code audit (security, correctness, performance, dead code,
design-system, Next 16/React 19 framework) across ~62,700 LOC (36 pages, 68 API routes,
41 components, 73 lib modules) **plus** a visual/UX audit of all 34 renderable pages at
desktop light, desktop dark, and mobile (102 screenshots).

Method: parallel finder agents per layer with **adversarial verification** of every
critical/high code finding (0 false positives survived). Visual audit ran one judge per
page over its three shots. Authenticated pages were captured with a provisioned Sovereign
QA account against the real Supabase project.

| Layer | Critical | High | Medium | Low |
|---|---|---|---|---|
| Code | 2 | 3 | 3 (+10 unverified) | 21 unverified |
| Visual | 0 | 9 | 14 | 6 |

---

## 🔴 CRITICAL

### C1. Any authenticated user can self-grant Sovereign (payment bypass)
`supabase/migrations/20260619120000_workspace_health_profiles.sql:180`

`workspaces.plan` / `subscription_status` are the server's source of truth for entitlements
(`lib/auth/workspaceSubscription.ts`, `lib/usage/tierUsage.ts`, `lib/auth/serverFeatureAccess.ts`).
But the migration does `grant select, insert, update on public.workspaces to authenticated`
with **no column-level restriction**, and the UPDATE RLS policy only checks row ownership.
Postgres RLS cannot restrict *which columns* are written, so any logged-in user can run, with
the public anon key + their own JWT:

```js
supabase.from('workspaces')
  .update({ plan:'sovereign', subscription_status:'active', max_health_profiles:10 })
  .eq('owner_user_id', myUserId)
```

…and unlock every paid feature + higher usage/profile caps with **zero Stripe payment**.
The INSERT policy is equally permissive (a user can insert a pre-populated sovereign workspace).
The Stripe webhook/checkout/portal code itself is sound — the break is purely that the
trusted columns are client-writable.

**Fix:** revoke table-level UPDATE/INSERT and re-grant only user-editable columns
(`grant update (name) on public.workspaces to authenticated`), or add a BEFORE
UPDATE/INSERT trigger rejecting changes to billing columns unless made by the service role.
Apply the same protection to `profiles.plan`/`subscription_status` (the secondary entitlement source).

### C2. Imported labs are double-normalized → wrong clinical risk tiers
`lib/clinical/clinicalIntelligence.ts:588` (root cause `lib/labs/clinicalBiomarkers.ts:256`)

At import, values are converted to canonical **storage** units (glucose `/18` → mmol/L,
hsCRP `/10` → mg/dL) but the row keeps the **original** `unit` string. `normalizeValue()`
then re-derives units from that stale string, so a real 90 mg/dL glucose is scored as
"5 mg/dL" and a 2.0 mg/L hsCRP as "0.2". This engine drives `urgent`/`clinician_review`
flags, follow-up questions, and the **physician export packet** — imported glucose and hsCRP
classifications are systematically wrong.

**Fix:** pick one canonical unit per biomarker and be consistent — either overwrite the stored
`unit` after conversion, or store in the unit the classifier expects and drop the import-time
conversions. (Same root cause as H2.)

---

## 🟠 HIGH — Code

### H1. Command-router preferences written user-scoped, read profile-scoped → silently lost
`lib/agent/agentCommandRouter.ts:235`

`savePreferences` inserts `agent_preferences` with `health_profile_id = null`, but every reader
(`personalHealthAgent`, `agentPreferenceMemory`, morning autopilot, preferences GET) filters by
`health_profile_id` when a profile is active. Any user with an active health profile has their
chat/voice-learned preferences (coaching tone, reminder window, training time…) written 200-OK
but never applied. **Fix:** thread the active profile context into the write, and add
`health_profile_id` to the unique key.

### H2. Lab trends display canonical storage units, not the user's units
`lib/labs/labTrends.ts:47`

`buildLabTrends` shows `latest.value` (mmol/L, mg/dL) against targets stated in mg/dL / mg/L, so
a 90 mg/dL glucose displays as "5.0" next to a "70–90 mg/dL" target. **Fix:** convert to display
units before building value/delta/interpretation.

### H3. Wearable metrics ingested with no dedup/idempotency
`lib/wearables/ingestWearableMetrics.ts:47`

Raw `.insert()` and an `.upsert()` **with no `onConflict`** run against tables that have no unique
constraint, while the cron re-syncs a rolling 2-day window (manual Oura = 14-day) every run. The
same per-day metric is re-inserted each sync; `buildHealthState` then averages all rows, corrupting
baselines, trends, risk scores, and biological-age refreshes — compounding daily. **Fix:** add a
unique natural key and `.upsert(..., { onConflict })` on both tables.

---

## 🟠 HIGH — Visual

Two systemic themes; both are real defects (not intentional-design), and the theme-parity ones
corroborate the code-level Toggle finding (M3).

### Light-theme parity is broken
- **V-H1/H2/M-resources — Resource template + resources index leave the whole body dark in light mode;** only the footer flips to white, producing a jarring dark-top/light-bottom split. Pages: `/resources/biomarkers/[slug]`, `/resources/categories/[slug]`, `/resources`. Light theme is not propagating to the content region.
- **V-H3/H4 — Concierge success checkmark badge is near-invisible in light theme** (desktop + mobile) — the page's primary success affordance disappears. `/concierge/success`
- **V-H5/H6 — Ops status pills (`OK`/`WATCH`) and all ~18 `SET` env pills render as blank pale-green blobs in light theme** — status indicators unreadable. `/ops` (also mobile, M-ops)

### Mobile hero headings overflow / clip off-screen
- **V-H7 `/optimization`** — "Build your health, understood." clips to "understoo".
- **V-H8 `/physician-export`** — "Longitudinal healthspan summary" runs past the right edge.
- **V-H9 `/plan`** — "Sovereign intelligence" clipped at both words.

**Fix pattern:** apply a responsive `clamp()` font-size to these hero headings; and audit the
light-theme cascade so `data-theme="light"` reaches these body surfaces / control fills.

---

## 🟡 MEDIUM

### Code (verified)
| # | Finding | Location |
|---|---|---|
| M1 | Unbounded `select('*')` on `behavior_events`, no limit | `app/api/longevity/report/route.ts:159` |
| M2 | Unbounded full-history read of `health_metrics` every state build | `app/api/health/state/route.ts:129` |
| M3 | Toggle knob/track use `bg-white/*` → invisible in light theme (root of several visual bugs) | `components/ui/forms/Toggle.tsx:25` |

### Code (reported, not adversarially verified — triage recommended)
CSP omits `script-src`/`default-src` (`next.config.ts`); PhenoAge CRP 10× inflation
(`biologicalAgeEngine.ts:1513`); Oura readiness+activity both map to `recovery_score`
(`normalizeHealthMetrics.ts:67`); Oura/WHOOP fetchers read only page 1 (`whoop.ts:99`); daily
plan "today" computed in UTC ignoring user tz (`autopilot/daily-plan:1025`); push notifications
bypass quiet hours (`coachDelivery.ts:132`); parallelizable sequential queries in longevity report;
N+1 entitlement queries in `listProfiles` (`health-profiles/route.ts:266`); redundant workspace/plan
resolution on hot routes (`agent/chat:48`); `sendCoachEmail` no try/catch breaks its no-throw
contract (`email.ts:29`); concierge onboarding 500 on non-critical email failure.

### Visual
Decorative gold-orb/glow overlaps content on several authed pages — onboarding & success
(orb over the **consent checkbox**), life-autopilot (orb over "Orchestration"), data-sources
(glow over first card heading); large empty void in digital-twin Scenarios card; concierge-success
heading touches card edge on mobile; optimization "Step 1" badge clipped on mobile; consent
checkbox low-contrast in light on `/success`.

---

## 🟢 LOW (selected)
Dead code to delete: `lib/memory/conversationMemoryFusionEngine.ts`, `lib/design/systemIdentity.ts`,
`components/layout/ThemeToggle.tsx`, unused type guards in `commandOrb/intents.ts`. Footer renders
`new Date()` during SSR → year-boundary hydration mismatch (`Footer.tsx:103`). Hardcoded dev
token-encryption key (`tokenCrypto.ts:14`). Rate-limit key from spoofable `X-Forwarded-For`
(`rateLimit.ts:21`). Future-self share route serves data with no access-code gate
(`future-self/scenarios/[shareToken]:27`). Referral partner codes generated but never redeemed.
Plus low-severity decorative-orb wash-out on assessment/network/report in light theme.

---

## Clean pages (visual, no defects found)
home, demo, login, login-signup, pricing, privacy, terms, waitlist, resource-article,
resources-articles, resources-biomarkers, resources-guides, companion, dashboard, life-os,
memory, settings.

## Suggested fix order
1. **C1** (payment bypass) — ship immediately; it's a one-line-class-of-fix migration.
2. **C2 + H2** (lab unit normalization) — one root cause; affects clinical output & physician exports.
3. **H1, H3** (preferences lost, wearable dedup) — data-integrity correctness.
4. **Visual light-theme parity + mobile heading overflow** (V-H1…H9) — high user-visible polish, low risk.
5. Medium perf/robustness + dead-code sweep.

*Screenshots retained at* `scratchpad/shots` *and* `scratchpad/shots-auth` *(102 PNGs).*
