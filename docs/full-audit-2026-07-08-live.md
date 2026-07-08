# Aeonvera — Full Live Audit (2026-07-08)

Scope: full working-tree code audit plus visual sweep of every discovered renderable
page. Coverage included 70 API routes, 39 page routes, Supabase migrations, memory/
biological-context WIP, professional/PHI governance, wearable ingestion, subscription
guards, and rendered page QA across desktop light, desktop dark, mobile light, and
mobile dark.

Verification run:

- `npx tsc --noEmit` — pass
- `npm run lint` — pass
- `npm run test:eval` — pass, 24/24
- `npm run build` — pass
- Playwright visual capture: 39 pages × 4 states = 156 screenshots
- Remote Supabase migration verification from the prior push: biological context,
  typed memory, profile memory RPC, and documented sensitive-basis constraint present

Artifacts:

- Screenshots and visual JSON: `scratchpad/audit-2026-07-08-fast`
- Prior local audit draft still exists at `docs/full-audit-2026-07-08.md`

| Layer | Critical | High | Medium | Low |
|---|---:|---:|---:|---:|
| Code | 0 | 3 | 8 | 14 |
| Visual | 0 broken | 1 | 5 | 7 |

## Executive read

The app is in a strong launch state mechanically: typecheck, lint, build, and evals are
all green. The newest memory hardening is materially better than the prior audit: automatic
memory now filters heuristic fallback candidates, biological context merges partial patches,
notes are labeled untrusted, contradictory pregnancy/lactation states are blocked, and the
daily-coach cron has a bounded source query plus batched entitlement resolution.

The remaining risk is not broad instability. It is concentrated in PHI scoping and
professional governance: wearable tokens are still keyed to login user + provider instead
of profile, sensitive consent with `legal_basis = other` still bypasses documentation, and
professional app pages are not middleware-protected even though their APIs are.

## High Findings

### H1. Manual Oura/WHOOP sync can write one profile's wearable data onto another active profile

Locations:

- `app/api/wearables/oura/sync/route.ts:57`
- `app/api/wearables/oura/sync/route.ts:72`
- `app/api/wearables/whoop/sync/route.ts:60`
- `app/api/wearables/whoop/sync/route.ts:75`
- `lib/wearables/oauth.ts:149`
- `lib/wearables/oauth.ts:163`
- `lib/wearables/oauth.ts:178`

The OAuth connection is saved and read with `onConflict: "user_id,provider"` and token
lookup filters only by `user_id`, `provider`, and `status`. The manual sync routes then
ingest fetched metrics into the current active-cookie health profile. A user who connects
Oura/WHOOP while profile A is active, switches to profile B, and hits sync can ingest A's
device data into B's health record. Reconnecting the same provider for B can also overwrite
A's row because the connection key does not include `health_profile_id`.

Fix: make wearable connections profile-scoped. Add a migration that replaces the unique
key with `(user_id, health_profile_id, provider)` for profile rows plus a legacy partial
key for `health_profile_id is null`; update token lookup/refresh/sync to resolve the
connection row for the target profile and ingest into that connection's profile, not the
active cookie.

### H2. Sensitive professional consent can still bypass documentation via `legal_basis = other`

Locations:

- `app/api/professional/consents/route.ts:92`
- `lib/professional/workflow.ts:263`
- `supabase/migrations/20260707203959_require_documented_sensitive_professional_basis.sql:8`

The route and DB constraint require a document only when `legal_basis` is `treatment` or
`contract`. The app still accepts `legal_basis = other`, and access decisions do not
distinguish legal basis. An org admin can create consent for `labs_sensitive`,
`mental_health`, `documents`, or `notes` with no document and no member-granted in-app
consent by choosing `other`.

Fix: document or member-grant every sensitive data class regardless of legal basis. Either
remove `other` for sensitive classes, or require `source_document_url`/`source_document_hash`
for any non-`patient_consent`/`guardian_consent` sensitive consent.

### H3. Professional app pages are outside middleware protection

Location: `proxy.ts:60`

The proxy protects `/dashboard`, `/memory`, `/physician-export`, `/settings`, and similar
member surfaces, but it does not include `/professional` or `/professional/dashboard`.
The APIs still require auth, so this is not a direct PHI leak, but unauthenticated visitors
can render the professional shell and route-specific UI. It also creates inconsistent
security posture around the most compliance-sensitive product area.

Fix: add `/professional` and `/professional/dashboard` to the protected route predicate
and matcher, while keeping `/professional/invite/*` public.

## Medium Findings

### M1. Daily Autopilot plan still reads preference memory unscoped

Location: `app/api/autopilot/daily-plan/route.ts:107`

The route resolves an active profile and uses profile-scoped preferences/protocol/execution
memory, but calls `getAgentPreferenceMemory({ supabase, userId })` without passing
`healthProfileContext`. The helper falls back to `user_id`, so multi-profile users can get
daily plans influenced by another profile's learned preference memory.

Fix: pass `healthProfileContext` into `getAgentPreferenceMemory`.

### M2. Professional roster tables overflow horizontally on mobile

Locations:

- `app/professional/dashboard/professional-dashboard.module.css:446`
- `app/professional/dashboard/professional-dashboard.module.css:450`

Playwright detected mobile horizontal overflow for `/professional` and
`/professional/dashboard`. The table is `min-width: 620px` inside a scroller; it is usable,
but the first viewport feels clipped and spreadsheet-like on a phone.

Fix: switch roster/consent/staff tables to stacked rows or card rows under the mobile
breakpoint.

### M3. Professional invite invalid/unauthenticated state can look stuck

Locations:

- `app/professional/invite/[inviteToken]/ProfessionalInviteClient.tsx:33`
- `app/professional/invite/[inviteToken]/ProfessionalInviteClient.tsx:92`
- `app/api/professional/invitations/[inviteToken]/route.ts:15`

The invalid test invite screenshot stayed on a sparse "Opening secure invitation..." card
for the capture window. The client has unauthorized/error states, but in practice the first
paint on mobile is a tall empty card with no immediate recovery affordance. This is a UX
high for invite conversion, though not a security issue.

Fix: render a compact skeleton with a timeout/fallback action, and make invalid-token and
unauthenticated states visually explicit with a sign-in button and support path.

### M4. Development CSP blocks Next dev eval and HMR

Evidence: every local Playwright route logged `eval() is not supported` plus HMR websocket
handshake errors under `npm run dev`.

This did not affect production build, but it makes local visual audit logs noisy and can
hide real console failures.

Fix: loosen CSP only in development for Next dev tooling, or run visual audits against
`next start` production mode.

### M5. `legal_basis = other` remains semantically undefined

Location: `lib/professional/workflow.ts:78`

Even beyond the high-sensitive-data bypass, `other` has no required explanation field,
review state, or policy workflow. For a clinic product, "other" should not be a free pass.

Fix: require a `legal_basis_note`/document for `other`, expose it in audit logs, and block
it for sensitive classes unless reviewed.

### M6. Wearable connection update timestamps are too broad

Locations:

- `app/api/wearables/oura/sync/route.ts:80`
- `app/api/wearables/whoop/sync/route.ts:83`

`last_synced_at` updates every connected row for that provider/user. Once profile-scoped
connections exist this must target the exact connection row, or it will report the wrong
profile as synced.

### M7. Professional invite API requires auth even for invite metadata

Location: `app/api/professional/invitations/[inviteToken]/route.ts:15`

This is defensible for privacy, but it means recipients cannot see organization name,
sender, or high-level "what is this?" context before signing in. The UI should compensate
with clearer unauthenticated copy.

### M8. Eval suite flags low biological-sex differentiation

Evidence: `npm run test:eval` logs `sex changed biological age in 2/45 varied profiles`.

This is a product intelligence gap rather than a correctness failure. The clinical
intelligence evals are sex-aware, but the biological-age engine still barely changes across
sex variants.

## Low Findings

- The two new migration files are untracked locally; they have been pushed remotely but
  should be added to git.
- `semantic_memories` profile RPCs are service-role only now, which is good, but keep an
  eval for that grant because it is an easy regression.
- Rate limit proxy handling is improved by trusted-proxy gating, but production depends on
  correct `VERCEL`/`TRUST_PROXY_HEADERS` env assumptions.
- `unsafe-inline` remains in CSP for script/style; currently pragmatic, but still worth
  tightening with nonces/hashes later.
- The professional dashboard first viewport uses placeholder `---` values heavily when no
  organization is configured; a clearer empty state would feel easier.
- `waitlist` decorative arcs intentionally overflow off-canvas; harmless, but automated
  visual checks flag them.
- Dev visual audit should prefer production server mode to avoid false console noise.

## Visual Audit

Coverage: 39 routes × desktop light, desktop dark, mobile light, mobile dark. No route showed
a framework overlay or broken blank app shell except the professional invite's sparse loading
state. No mobile hero heading overflow was reproduced. No global light/dark theme split was
reproduced on resources pages.

Confirmed visual issues:

- **High:** professional invite can sit on a tall, sparse loading card with no recovery
  action on mobile and desktop.
- **Medium:** professional roster table overflows horizontally on mobile.
- **Medium:** professional dashboard empty organization state is visually heavy and
  placeholder-dense.
- **Medium:** prior AeonCommandOrb overlap cluster still deserves a focused authenticated
  run with the orb enabled; this pass disabled it to isolate page layouts.
- **Low:** waitlist decorative arcs trigger horizontal-overflow metrics but appear intentional.

Clean in this unauthenticated/rendered pass:

home, about, assessment, companion, concierge-success, dashboard shell, data-sources, demo,
digital-twin, future-self invalid-share state, life-autopilot, life-os, login, memory,
network, onboarding, ops, optimization, physician-export, physician-share invalid-share
state, plan, pricing, privacy, report, resources, resource article, articles, biomarkers,
biomarker detail, resource category, guides, settings, success, terms, waitlist.

## Fixed Since Prior Audit

- Automatic memory heuristic fallback now runs through the subject-safety filter.
- Profile-scoped memory write routes are covered by evals.
- Sensitive treatment/contract professional access requires documented basis.
- Biological context rejects contradictory states and marks notes as untrusted evidence.
- Daily-coach cron avoids the previous serial per-profile frozen checks and bounds source
  queries.
- Typed-memory Supabase migration is applied remotely and verified.

## Priority Order

1. Fix wearable connection/profile scoping. This is the most concrete remaining data
   integrity/PHI issue.
2. Close sensitive consent `other` legal-basis bypass in both route logic and DB constraint.
3. Protect `/professional` and `/professional/dashboard` in `proxy.ts`.
4. Pass `healthProfileContext` into daily-plan agent preference memory.
5. Improve professional invite loading/unauthorized/error states.
6. Convert professional mobile tables to stacked cards.
7. Run an authenticated visual pass with the AeonCommandOrb enabled.

