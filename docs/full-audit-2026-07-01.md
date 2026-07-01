# Aeonvera Full-Stack Audit — Synthesized Report

_Next.js 16 health + payments SaaS handling PHI. Findings below are post-adversarial-verification; severities reflect verifier adjustments. Every claim cites `file:line`._

_Generated 2026-07-01 by a multi-agent audit: 19 focused reviewers across security / correctness / quality-arch / perf / a11y / design, each finding adversarially re-verified against the real code before inclusion (112 agents total; 92 raw findings → 79 confirmed, 6 refuted)._

---

## 1. Executive Summary

Overall posture is **reasonably strong on the fundamentals**: server-side auth (`getUser`) is enforced per route, RLS is fail-closed, share links are token+code gated, and the primary XSS surface is covered by React auto-escaping. Most security findings are **defense-in-depth gaps** (spoofable-IP rate limiting, OAuth key reuse, missing PKCE/CSP `script-src`) rather than active, attacker-reachable breaches.

The items that actually matter:

- **One confirmed cross-profile PHI disclosure.** `app/api/care-network/[inviteToken]/route.ts` rebuilds the export bundle against the owner's *first* health profile instead of the invited subject's — a coach/family invitee for a dependent can receive the wrong person's full labs/clinical bundle. This is the single most serious confirmed issue.
- **Two fail-open controls on PHI scoping/access** (`sanitizeCareRole` defaults to `physician`; `verifyShareAccessCode` returns `true` on a null hash for legacy rows). Both are bounded but both fail *open* on PHI.
- **Systematic unit-conversion bugs** in the biological-age engine: lab-imported **glucose** and **hsCRP** are scored in the wrong unit, so the most at-risk users (diabetic, high-inflammation) are reported as metabolically *excellent*. This silently corrupts the product's core output.
- **A silently-failing clinical write** (`daily_execution_plans` upsert against a dropped constraint) and a **fully-sequential daily-coach cron** that will time out and drop coaching for most users at scale.

Nothing in the confirmed set is a cross-tenant/anonymous data breach or a payment-integrity flaw. The correctness bugs (glucose/hsCRP/plan-write) are arguably higher business risk than the security bugs because they degrade clinical output for exactly the users who depend on it.

---

## 2. Critical & High Findings

Confirmed first. Duplicates merged (e.g. the OAuth-key-reuse and `getUserSubscription` null-deref items each reported by multiple units).

| Severity | Dimension | Location | Issue | Fix |
|---|---|---|---|---|
| High | Security | `app/api/care-network/[inviteToken]/route.ts:106-113` | Care-network share ignores membership `health_profile_id`; `buildPhysicianExportBundle` falls back to owner's oldest profile → wrong subject's full PHI bundle to invitee (multi-profile owners). | Select `health_profile_id` (line 46) and pass `healthProfileId: invite.health_profile_id` into the bundle, mirroring physician-share (`physician-share/[shareToken]/route.ts:91-96`). |
| High | Correctness | `lib/longevity/biologicalAgeEngine.ts:429-455` (+ `lib/labs/clinicalBiomarkers.ts:349`, `latestLabInputs.ts`, `labs/import/route.ts:98`) | Lab glucose stored as mmol/L but `computeMetabolic` scores it as mg/dL; every real value buckets to `<85` "excellent" (200 mg/dL diabetic → 11.1 → -2.0). | Pick one canonical engine-input unit; convert stored research-unit value back to mg/dL before populating `input.fasting_glucose`, or align thresholds. |
| High | Correctness | `lib/longevity/biologicalAgeEngine.ts:571-597` (+ `clinicalBiomarkers.ts:350`) | Lab hsCRP stored mg/dL but scored on mg/L thresholds (~10x too low); elevated inflammation reads as excellent. | Normalize hsCRP to one canonical unit end-to-end; align `computeMetabolic` thresholds (mg/L is conventional). |
| High | Correctness | `lib/clinical/clinicalFollowUpResponses.ts:226-246` | `daily_execution_plans` upsert uses `onConflict:"user_id,plan_date"` but that constraint was dropped for **partial** unique indexes (`20260619212413`); Postgres raises 42P10, error is swallowed → clinical answer never written to today's plan. | Use the update-then-insert helper from `morningAutopilot` (`upsertDailyExecutionPlan`); set `health_profile_id`. |
| High | Performance | `app/api/cron/daily-coach/route.ts:122-179` | All users processed sequentially, 4 heavy awaited sub-pipelines each; O(users × latency) exceeds Vercel timeout → silently coaches only a prefix of users. | Bounded-concurrency pool (p-limit 5-10) and/or shard by cursor/user-id range. |

_(No findings were rated Critical after verification.)_

---

## 3. By Dimension

### Security

- **`app/api/care-network/[inviteToken]/route.ts:106-113`** (High) — cross-profile PHI disclosure; see table.
- **`lib/care-network/rolePermissions.ts:15-19`** (Medium) — `sanitizeCareRole` fails **open**: unknown/omitted role → `physician` (widest PHI set incl. labs, clinical_insights). Used at `invitations/route.ts:117` with no prior validation. Fix: reject with 400 or default to least-privileged `family`.
- **`lib/security/shareAccess.ts:32-33`** (Medium; also reported by sec-rls-identity) — `verifyShareAccessCode` returns `true` when `expectedHash` is null. Legacy share/invite rows created before migration `20260613160000` have NULL `access_code_hash` → token alone unlocks full PHI. New rows are safe (POST always sets hash). Fix: fail **closed** on NULL for PHI links; backfill/NOT NULL-constrain legacy rows.
- **OAuth token-encryption key reuse** — `lib/security/tokenCrypto.ts:5-19` (Medium; reported by sec-oauth-wearables, sec-rls-data, qual-dup-types — **merged**). Key falls back `OAUTH_TOKEN_ENCRYPTION_KEY → SHARE_ACCESS_SALT → CRON_SECRET → SUPABASE_SERVICE_ROLE_KEY`; `.env.local` has only `SHARE_ACCESS_SALT` set. Rotating the salt/service-role key silently makes all stored wearable/calendar tokens undecryptable; the "production requires it" guard is effectively dead (service-role key is always present). Fix: require a dedicated key and fail closed; support versioned key ids for rotation.
- **Spoofable-IP rate limiting** — `lib/security/rateLimit.ts:21-25,94` (Medium as systemic finding; Low on the billing/AI-route subsets — **merged**). `getClientIp` trusts leftmost `x-forwarded-for` with no trusted-proxy validation; limiter key is IP-only. Rotating XFF defeats throttling on public (waitlist) and authenticated cost-bearing (agent/chat, voice, realtime, stripe/*) routes; shared-NAT users collide. Mitigations: per-user `checkAndRecordUsage` caps AI *cost*; `concierge/onboarding:73-79` already shows the correct per-user-key pattern. Fix: key authenticated routes on user id; only trust XFF from a known proxy hop.
- **`lib/security/shareAccess.ts:3-13`** (Low) — share-code hashing salt falls back to `NEXT_PUBLIC_SUPABASE_URL` (a browser-shipped, non-secret value) in non-prod. Prod guarded by throw. Fix: drop the public fallback; use an isolated dev constant.
- **Cron/ops secret compared with `!==`** — `cron/daily-coach/route.ts:39`, `cron/wearable-sync/route.ts:41`, `ops/health/route.ts:17` (Low) — non-constant-time bearer comparison (timing side channel). Safe idiom already exists at `shareAccess.ts:41`. Fix: `crypto.timingSafeEqual` on equal-length buffers.
- **`next.config.ts:8-11`** (Low) — CSP omits `default-src`/`script-src` (documented, intentional); no defense-in-depth against injected scripts. Fix: add nonce-backed `script-src` + `default-src 'self'` once inline scripts are nonced.
- **OAuth flows lack PKCE** — `lib/wearables/oauth.ts:54-103`, `lib/calendar/google.ts:50-73` (Low) — confidential clients + user-bound httpOnly `state` cookie make practical risk low; add PKCE (S256) per OAuth BCP.
- **`app/api/longevity/future-self/scenarios/[shareToken]/route.ts:27-50`** (Low) — public scenarios have no expiry/revocation/access-code; `share_token` is a v4 UUID and payload is projection data. Fix: add `expires_at`/`revoked_at`.
- **`lib/digital-twin/physicianExportBundle.ts:76-81`** (Medium, correctness/security overlap) — if a share's `health_profile_id` access is later removed/expired **or the lookup errors**, `resolveActiveHealthProfileContext` silently falls back to user-wide legacy scope (`activeHealthProfile.ts:92-93`), broadening PHI to an external physician recipient. Fix: for explicit `health_profile_id`, treat unresolved access as 410/404, not fallback.
- **`supabase/migrations/20260620053058…:37-41`** (Low) — dead anon SELECT policy on `future_self_scenarios` re-added after launch hardening revoked the grant; inert today, latent footgun if grant ever re-added. Fix: drop the policy or assert-never-grant.
- **`app/api/waitlist/route.ts:10-11,28,55-62`** (Low) — unauthenticated write; only defense is spoofable-IP throttle; forged `ip_address` stored. Non-PHI. Fix: trusted client IP + secondary abuse control.
- **Info-level:** OAuth error reflected into same-origin redirect (React-escaped, not XSS) `wearables/oura/callback:19-21,63-67`; planner route has no per-user meter `agent/planner:72-107`; full self-scoped PHI serialized to OpenAI/xAI prompts (BAA/consent concern) `personalHealthAgent:484-504,570-607`; in-memory rate-limit fallback is per-instance `rateLimit:17,55-76`.

### Correctness

- **Glucose & hsCRP unit bugs** — High; see table.
- **Clinical follow-up upsert 42P10** — High; see table.
- **`lib/coach/runCoachPipeline.ts:59-67`** (Medium) — `.single()` on `health_states` throws for any cron work-item user lacking that row (users with only protocols/labs/wearables); caught+logged, so coach pipeline silently never runs for them. Fix: `.maybeSingle()` + graceful skip.
- **`lib/clinical/clinicalFollowUpResponses.ts:190-238`** (Medium) — clinical plan write omits `health_profile_id`, always targeting the legacy NULL row; fragments a profile-scoped user's "today" plan away from autopilot's row. Fix: thread `ActiveHealthProfileContext` through `recordClinicalFollowUpAnswer`.
- **`lib/metrics/normalizeHealthMetrics.ts:69-74`** (Medium) — Oura `readiness` **and** `activity_score` both map to `recovery_score` at the same timestamp → collide/overwrite, corrupting recovery baseline/trend/risk. (Biological-age unaffected — it doesn't read `recovery_score`.) Fix: map `activity_score` to a distinct canonical metric.
- **`lib/wearables/ingestWearableMetrics.ts:64-73`** (Medium) — `health_metrics` upsert has no `onConflict` and no PK in payload → effectively INSERTs; overlapping 14-day/2-day sync windows create duplicate `(subject,metric,day)` rows, biasing baselines. (Table DDL not in repo — see §4 note.) Fix: explicit `onConflict` on the intended unique key + matching index, or dedupe pre-write.
- **`lib/wearables/apple.ts:95-113`** (Medium) — sleep-analysis samples without start/end fall back to the raw category integer as `sleep_hours`; `normalizeValue` clamps to [0,24] so a bogus value passes, corrupting sleep baseline (feeds biological-age). Fix: don't emit `sleep_hours` without a real duration.
- **`lib/auth/getUserSubscription.ts:35-68`** (Medium; reported by sec-billing at Low and qual-dup-types at High — **merged, verifier settled at Medium**) — `.maybeSingle()` can return null; lines 62/65/68 deref `data` without `?.` (unlike `data?.plan` on 48). Throws for a workspace member with a valid subscription but no `profiles` row — the exact case the code comment claims to support. Client-side (PricingPageClient) → breaks pricing/plan UI. Fix: `data?.onboarding_completed` etc.
- **`lib/longevity/biologicalAgeImprovementLoop.ts:115-125`** (Low) — baseline is oldest of the most-recent-24 rows, not the true first tracked point; "trajectory since first point" drifts once a user exceeds 24 rows. Fix: fetch earliest row separately.
- **`lib/execution/executionSummary.ts:70-74`** (Low) — `deferred` counted in adherence denominator → rescheduling penalized like skipping, triggering negative coach nudges (`adaptiveDailyCoach.ts:334-347`). Fix: decide semantics; exclude deferred if neutral.
- **`app/api/waitlist/route.ts:30-66`** (Low) — check-then-insert races on `UNIQUE(email)` → second concurrent insert 500s despite effective success. Fix: `upsert(onConflict:"email")` or catch 23505.
- **`lib/notifications/coachDelivery.ts:132,191`** (Low) — push bypasses quiet hours while email honors them (the more intrusive channel fires at night). Fix: gate push on `!quietHoursActive`.
- **`lib/notifications/coachDelivery.ts:231`** (Low) — returns `email:"processed"` even when no email address exists (recorded row is "skipped"). Fix: include `email` presence in status.
- **`lib/memory/semanticMemory.ts:18,174-185`** (Low) — embedding model env-configurable but pgvector column/RPCs fixed at 1536 dims; non-default model → silent memory failure. Fix: pin model or pass `dimensions:1536` + validate length.
- **`lib/health-profiles/activeHealthProfile.ts:86-88`** (Low) — default active profile is oldest access row, ignoring `is_primary`; diverges from UI's primary-first default → within-authorized-set subject mismatch (not cross-user). Fix: order `is_primary desc, created_at asc`.
- **API-contract nits (Low):** malformed JSON → 500 not 400 across ~6 POST handlers (`optimization/protocol:96` et al.); missing-table status inconsistent GET vs POST (`digital-twin/outcomes:52-59 vs 141-150`, 200 vs 500 vs life-os `503`); clinical follow-up silently ignores partial answer submission (`clinical/follow-up:50-76`); dashboard search-param store listens for non-firing `pushstate`/`replacestate` events (`dashboard:2249-2258`).
- **Info-level:** future-self current-trajectory easing inconsistency (dead field) `futureSelfSimulator:261-278`; push delivery row always labels `provider:"web-push"` even for Expo `coachDelivery:218`; fusion snapshot conversation order reversed (dead code) `conversationMemoryFusionEngine:68-84`; `initplan` migration naive text-replace `20260620052848:31-64`.

### Quality / Architecture

- **`lib/supabase/client.ts:9-13`** (Medium; same in `server.ts`, `admin.ts`) — clients created without `<Database>` generic → all query results `any`; this is the **root cause** letting the `getUserSubscription` null-deref pass `strict` type-checking, and forces ~8 hand-maintained row types. Fix: `supabase gen types` + pass `<Database>`.
- **`lib/auth/routeContext.ts:24-55`** (Low; originally Medium) — `requireAuthenticatedRouteContext` exists but only 2 files use it; 57 routes hand-roll `getUser`/401/`getSupabaseAdmin`/`resolveActiveHealthProfileContext`. No current gap, but a hardening change won't propagate. Fix: migrate routes, prioritizing PHI routes.
- **`lib/auth/ensureProfile.ts:1-26`** (Low) — server-named helper imports the browser Supabase singleton and swallows fetch/insert errors; works only because callers are client components. Fix: accept a client arg + return success boolean.
- **`lib/auth/getUserSubscription.ts:16-77`** (Low) — inconsistent return shape (5 vs 8 keys) with no declared return type. Fix: explicit return type covering both branches.
- **Info:** duplicated "missing table/schema" detectors across ~18 modules (`tierUsage:267-281` et al.) — extract shared `isMissingSchema`; inconsistent error envelope wording `digital-twin/outcomes:71/192`; no `loading.tsx`/per-segment `error.tsx` (`app/error.tsx` only); dashboard is a single ~2262-line client component.

### Performance

- **`cron/daily-coach/route.ts:122-179`** (High) — sequential cron; see table.
- **`cron/daily-coach/route.ts:208-221`** (Medium; originally High) — N+1 sequential `isHealthProfileFrozenById` (~3 round-trips each) while building work items. Background job, dwarfed by downstream LLM work, hence Medium. Fix: batch distinct ids into one `.in()` query + memoize per-workspace entitlements.
- **`cron/daily-coach/route.ts:60-100`** (Medium) — `wearable_metrics`/`lab_biomarkers` user-discovery selects 5000 raw rows (no DISTINCT), capped at 5000 → duplicate transfer and silent user drop beyond the cap. Fix: distinct-owner view/RPC or active-subjects table.
- **`cron/wearable-sync/route.ts:61-125`** (Medium) — sequential per-connection loop with per-connection plan lookup + external fetch + full ingest; external latency serialized → timeout risk. Fix: bounded concurrency + hoist/cache plan lookups.
- **`lib/wearables/ingestWearableMetrics.ts:80-97`** (Low; originally Medium) — `select("*")` full-history re-read + full state rebuild on every sync; PostgREST 1000-row cap limits blast radius. Fix: select needed columns + rolling window; incremental update.
- **`lib/execution/aeonveraExecutionEngine.ts:49-56`** (Low) — per-item awaited inserts for behavior/notification rows inside the cron loop. Fix: batch array inserts.
- **`app/dashboard/page.tsx:382-391`** (Low) — double-fetches `lab_biomarkers` (direct query + `/api/labs/trends` re-query with re-auth). Fix: fetch once, derive both.
- **`components/layout/AeonCommandOrb.tsx:308-349` + `AeonOrbVisual.tsx:66-123`** (Low) — two continuous rAF loops (13 CSS-var writes/frame + ~450 canvas strokes/frame) never pause on idle/`document.hidden`; drains mobile battery. Fix: pause on idle/hidden (preserve visuals).
- **Info:** entire 2262-line dashboard ships as one client component; 14-request `Promise.all` fires post-hydration (`dashboard/page.tsx:1-3`).

### Accessibility

- **`app/login/page.tsx:154-158`** (Medium) — auth error/status message in a plain `<div>`, no `role="alert"`/`aria-live`; SR users get no feedback on failed sign-in. Fix: add `role="alert"`.
- **`components/layout/AeonCommandOrb.tsx:1304-1332`** (Medium) — assistant replies, "thinking" indicator, and voice-failure status not in a live region; assistant/voice interaction is silent to AT. Fix: wrap in `aria-live="polite"` / `role="status"`.
- **`components/layout/AeonCommandOrb.tsx:1262-1428`** (Low; originally Medium) — orb panel is a modal overlay without `role="dialog"`/`aria-modal`, no focus move-in/trap, no Escape-to-close (outside-`pointerdown` only). A keyboard-operable close button exists (so not a hard trap), hence Low. Fix: dialog semantics + focus management + Escape (mirror `Header.tsx:163-168`).
- **`components/ui/forms/Toggle.tsx:16-28`** (Low) — accessible name only from optional `aria-label={label}`; label-less toggle is unnamed. Current callers pass labels (latent). Fix: require a name.
- **`components/ui/forms/Checkbox.tsx:18-27` / `Card.tsx:40-42`** (Info; originally Low) — checkbox/clickable-card can ship unnamed if `label`/`actionLabel` omitted; all current callers pass them. Fix: enforce a name via types.

### Design consistency

- **`components/pricing/PricingPlanCard.tsx:27-157` + `globals.css:3910-4045`** (Low; originally Medium) — an entire parallel pricing-card system (157-line component + ~135 CSS lines) is dead code; live page uses `.aeon-apple-plan`. Maintenance trap. Fix: delete component (move `PricingPlan` type out) + remove CSS.
- **`globals.css:2985-2988, 3068-3074 (dead) / 5618-5627 (winning)`** (Low) — `.aeon-orb-send` defined 3x; two glass defs overridden by `!important` primary-button SSOT; button renders gold, not glass. Fix: remove the two early definitions.
- **`globals.css:3207-3220, 4579-4613 (dead) / 5677-5706 (SSOT)`** (Low) — chrome-control styling duplicated across 3 layers; earlier gold-tinted hover is dead (SSOT forces transparent). Fix: delete superseded blocks.
- **Info:** `.pricing-plan-card` hardcodes light-mode hex, no dark override (but dead) `globals.css:3910-3949`; `--royal` token is a dead alias of `--gold` `globals.css:24-25`; two eyebrow conventions `.text-eyebrow` vs `.av-eyebrow` (intentional marketing-vs-product split, undocumented) `globals.css:261-268, 5817-5823`.

---

## 4. Uncertain / Needs Human Verification

These are technically-accurate observations whose *impact/exploitability* the verifier could not fully confirm — a human should confirm intent/data-state.

- **Workspace plan inheritance grants paid features to any active member incl. viewers** — `lib/usage/tierUsage.ts:31-51`, `workspaceSubscription.ts:28-39`. Mechanism confirmed (role ignored; usage counted per-user not pooled), but appears to be **intentional household/workspace billing**. Confirm: should `viewer` consume paid intelligence layers? Should usage pool per workspace?
- **wearable_connections RLS is wrong shape for a secret-bearing table** — `supabase/migrations/20260620204504…:1-33`. Confirmed the consolidation drops the owner-only policy and the shared profile-subject read policy becomes effective; **only the revoked `authenticated` grant prevents token exposure today**. Not currently reachable (grant revoked; app reads via service-role, sanitized columns). `calendar_connections` half **refuted**. Confirm: add a test/comment asserting these tables are never `GRANT`ed to `authenticated`, or move tokens to a server-only table.
- **`record_usage_event_if_available` trusts caller-supplied `p_limit`/`p_user_id`** — `supabase/migrations/20260701183134…:1-62`. Accurate, but function is `security definer`, `service_role`-only, and all callers pass server-derived values. No reachable exploit; hardening-only.
- **`digital-twin/export` has no rate limiting** — `app/api/digital-twin/export/route.ts:11-65`. True, but it's a GET consistent with sibling **read** handlers (which also aren't rate-limited), and ownership-scoped (self-data only). Residual is a minor resource-exhaustion hardening gap.
- **State-rebuild legacy `user_id` filter can span profiles** — `lib/wearables/ingestWearableMetrics.ts:80-84`. Literal claim true, but no reachable path produces the mixed null/non-null-profile state given migration/provisioning invariants. Recommend defensive `.is('health_profile_id', null)` on legacy reads.
- **Oura noon-UTC bucketing / clinical "today" server-local vs UTC** — `lib/wearables/oura.ts:117-120`; `proactiveClinicalFollowUps.ts:193-201` vs `clinicalFollowUpResponses.ts:190`. Code inconsistencies are real but production runs `TZ=UTC` (Vercel) and freshness thresholds are multi-day, so no demonstrable defect.
- **`health_metrics` duplicate-row upsert** (§3 Correctness) carries a data-state caveat: the `health_metrics` table DDL is **not in the repo** (only ALTERs), so whether a unique constraint exists could not be verified from source. Confirm the live schema.

---

## 5. Ruled-Out (Notable Refuted Claims)

Checked and dismissed — do not action:

- **Waitlist redirect breaks `/api` calls** (`proxy.ts`) — the matcher excludes `/api/*`, so `proxy()` never runs for API routes. No breakage.
- **Freeze trigger blocks granting access to a frozen profile** (`20260620173008…`) — the app layer already returns a clean 423 before the DB write. Trigger is a redundant backstop.
- **`future_self_scenarios` anon-readable via `is_public` + `DEFAULT TRUE`** — remediated by `20260617120000` (default→false, backfill, `revoke select from anon`). Not exploitable.
- **Double unit-normalization of hsCRP in PhenoAge layer** (`biologicalAgeEngine.ts:790`) — `normalizeCrp` is called exactly once; `value/10` is the correct mg/L→mg/dL conversion. (Distinct from the *real* lab-import hsCRP bug in §2/§3.)
- **BMI computed with no zero/absurd-height guard** — always resolves finite; height/weight coerced to safe defaults in `buildAssessmentInput`.
- **Wearable cron bypasses freeze/entitlement enforcement** (`cron/wearable-sync/route.ts:141-157`) — the DB `enforce_writable_health_profile` trigger fires on all writes (service role bypasses RLS, not triggers). No frozen-profile PHI is persisted.

---

## 6. Prioritized Remediation Plan

### P0 — Must fix now (confirmed High, small-to-moderate effort)
1. **[Quick win]** Care-network PHI scoping: add `health_profile_id` to select and pass it into `buildPhysicianExportBundle` (`care-network/[inviteToken]/route.ts:46,106-113`).
2. **Fix glucose unit scoring** end-to-end (`biologicalAgeEngine.ts:429-455` + `clinicalBiomarkers.ts:349` + `latestLabInputs.ts`). Backfill/recompute affected users' biological age.
3. **Fix hsCRP unit scoring** (`biologicalAgeEngine.ts:571-597` + `clinicalBiomarkers.ts:350`). Same canonical-unit decision as #2; recompute.
4. **Fix clinical follow-up plan upsert** — switch to `morningAutopilot`'s update-then-insert and set `health_profile_id` (`clinicalFollowUpResponses.ts:226-246,190-238`). Closes both the 42P10 silent failure **and** the profile-scope fragmentation in one change.
5. **Daily-coach cron scalability** — bounded concurrency + cursor sharding (`cron/daily-coach/route.ts:122-179`). Larger effort; ship behind monitoring of cron completion.

### P1 — High-value fail-open / correctness (Medium)
6. **[Quick win]** `sanitizeCareRole` fail-closed → `family` or 400 (`rolePermissions.ts:15-19`).
7. **[Quick win]** `verifyShareAccessCode` fail-closed on NULL hash for PHI links + backfill legacy `access_code_hash` (`shareAccess.ts:32-33`).
8. **[Quick win]** `getUserSubscription` optional chaining on lines 62/65/68 (`getUserSubscription.ts`).
9. **[Quick win]** `runCoachPipeline` `.maybeSingle()` + graceful skip (`runCoachPipeline.ts:59-67`).
10. **[Quick win]** Dedicated `OAUTH_TOKEN_ENCRYPTION_KEY`, remove unrelated-secret fallbacks, fail closed (`tokenCrypto.ts:5-19`).
11. **Wearable ingestion data integrity** — add `onConflict` to `health_metrics` upsert + map Oura `activity_score` to a distinct metric + guard Apple `sleep_hours` (`ingestWearableMetrics.ts:64-73`, `normalizeHealthMetrics.ts:69-74`, `apple.ts:95-113`). Verify the live `health_metrics` schema first (§4).
12. **Rate-limit hardening** — key authenticated routes on user id; stop trusting raw XFF (`rateLimit.ts:21-25,94`; apply pattern from `concierge/onboarding`).
13. **Physician-share legacy-scope fallback** — treat unresolved `health_profile_id` as 410/404 (`physicianExportBundle.ts:76-81`).

### P2 — Accessibility & remaining correctness (Medium/Low)
14. **[Quick win]** `role="alert"` on login error (`login/page.tsx:154-158`); `aria-live` on orb message stream/status (`AeonCommandOrb.tsx:1304-1332`); dialog semantics + Escape + focus mgmt on orb panel (`:1262-1428`).
15. **[Quick win]** Waitlist `upsert(onConflict:"email")` (`waitlist/route.ts:30-66`); push quiet-hours gate (`coachDelivery.ts:191`); constant-time cron/ops secret compare (`daily-coach:39`, `wearable-sync:41`, `ops/health:17`).
16. Adherence `deferred` semantics (`executionSummary.ts:70-74`); improvement-loop true-first baseline (`biologicalAgeImprovementLoop.ts:115-125`); active-profile `is_primary` ordering (`activeHealthProfile.ts:86-88`).
17. Defensive JSON parsing → 400 across the ~6 POST handlers; standardize missing-table status.

### P3 — Type safety, perf, hygiene (larger / lower urgency)
18. **Generate Supabase `Database` types** and pass `<Database>` to all clients (`supabase/client.ts`, `server.ts`, `admin.ts`) — restores null-safety, catches field typos.
19. Cron perf follow-ups: batch freeze checks (`daily-coach:208-221`), distinct-owner discovery (`:60-100`), bounded-concurrency wearable-sync (`wearable-sync:61-125`), windowed `health_metrics` read, batched execution inserts.
20. Orb rAF idle/hidden pausing (`AeonCommandOrb.tsx:308-349`, `AeonOrbVisual.tsx:66-123`); dashboard lab double-fetch (`dashboard:382-391`).
21. Adopt `requireAuthenticatedRouteContext` across PHI routes; extract shared `isMissingSchema`; embedding-model dimension guard.
22. **[Quick wins]** Design hygiene — delete dead pricing-card system, `.aeon-orb-send`/chrome duplicate CSS, `--royal` token; document eyebrow split. (Respect design-preservation: remove dead code only, do not restyle live surfaces.)

### P4 — Confirm intent, then act (see §4)
23. Workspace plan inheritance for viewers + per-user vs pooled usage.
24. wearable_connections RLS shape / never-grant assertion.
25. Add hardening-only limiter to `digital-twin/export`; standardize day-boundary (UTC) across clinical dedup and plan keys.
