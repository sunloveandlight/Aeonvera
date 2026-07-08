# Aeonvera Full Live Audit (2026-07-08)

Scope: live production site at `https://www.aeonvera.com`, current repo branch
`fix/phi-boundary-hardening` at `cedaae3`, plus production Supabase state checks.

Visual scope: 160 screenshots across 40 route families in desktop light, desktop dark,
mobile light, and mobile dark. Raw shots are in
`scratchpad/live-audit-2026-07-08-current/shots`.

Code scope: security, PHI scoping, profile isolation, wearable sync, consent/documentation
gates, share-token surfaces, cron/performance fixes, launch routing, and production build.

## Executive Summary

No new critical or high-severity code issue survived this pass.

The prior critical PHI bypass is closed in the deployed schema and in the app code:

- production migration `20260708204925` is applied;
- production has `0` organization-profile rows in `health_profile_access`;
- the consumer resolver only resolves personal-workspace profiles;
- the database trigger rejects future organization profile access rows.

The remaining issues are launch polish and defense-in-depth hardening:

| Area | Severity | Finding |
|---|---:|---|
| Code | Medium | Active-profile switch endpoint does not duplicate the resolver's `workspace_type = 'personal'` guard. Current DB trigger makes it safe, but the endpoint should match the central contract. |
| Database | Low/Medium | Two consent/PHI check constraints are `NOT VALID`. They enforce new writes, and production currently has no violating rows, but they should be validated when convenient. |
| Visual/Product | Medium | Footer/nav "For clinics" sends anonymous visitors to `/professional`, which redirects to login instead of a clinic-facing page. |
| Visual/Product | Low | `/waitlist` is a branded 404 in all four states. If any old links exist, redirect it to `/` or `/pricing`. |
| Visual | Low | `/about` image captions are nearly unreadable over the images in light mode, desktop and mobile. |
| Visual | Note | Homepage hero text intentionally overlays the hero image. It is not broken, but if image inspection is the priority, add a stronger readable gradient/safe zone. |

## Verification Performed

- `npm run test:eval` — 34/34 green.
- `PLAYWRIGHT_BASE_URL=https://www.aeonvera.com npx playwright test tests/e2e/launch-smoke.spec.ts --workers=1 --reporter=line` — 64 passed, 2 expected skips.
- `npm run lint` — clean.
- `npx tsc --noEmit` — clean.
- `npm run build` — clean on Next.js 16.2.9 / Turbopack.
- Live Supabase checks:
  - `20260708200414` applied: profile-scoped wearables.
  - `20260708204925` applied: roster isolation.
  - `20260708210000` applied: documented sensitive consent basis.
  - `org_hpa_rows = 0`.
  - `undocumented_sensitive_non_consent_consents = 0`.
  - `wearable_connections_without_profile = 0`.

## Code Findings

### Medium: Active-Profile Switch Endpoint Should Match Resolver Guard

File: `app/api/health-profiles/active/route.ts`

The resolver in `lib/health-profiles/activeHealthProfile.ts` now joins `workspaces` and filters
`workspace_type = 'personal'`, which is the correct fix for the professional roster isolation
bug.

The active-profile switch endpoint still verifies only:

- `health_profile_access.user_id = user.id`
- `health_profile_access.health_profile_id = requested id`
- `status = active`

Today this is not exploitable because migration `20260708204925` removed organization access
rows and installed a trigger that rejects future ones. Still, the endpoint should apply the same
personal-workspace join so every layer encodes the same invariant.

Recommended fix: join `workspaces!inner(workspace_type)` in the switch query and require
`workspaces.workspace_type = 'personal'`.

### Low/Medium: Validate `NOT VALID` Database Constraints

Files:

- `supabase/migrations/20260708200414_profile_scoped_wearables_sensitive_phi_contract.sql`
- `supabase/migrations/20260708210000_documented_sensitive_consent_all_non_consent_bases.sql`

The documented-sensitive-consent constraints are added `NOT VALID`. This is reasonable for a
hot production migration because PostgreSQL still enforces the check on new and updated rows.
Production also currently has zero violating rows.

Recommended follow-up: run `ALTER TABLE ... VALIDATE CONSTRAINT ...` during a quiet window so
schema state fully reflects the invariant.

### Confirmed Closed: Prior Highs

- Wearable cross-profile contamination: current OAuth, manual sync, cron sync, and ingestion all
  scope token lookup, connection update, and metric writes by `health_profile_id`.
- Auto-memory third-party attribution: clinical candidates now pass `isSafeSubjectMemory`, with
  relation-noun and third-person-pronoun default-drop behavior.
- Consent `legal_basis='other'` bypass: app-level validator and DB-level constraint now require a
  document/hash for sensitive non-member-granted bases.
- Professional roster PHI bypass: roster profiles no longer create consumer
  `health_profile_access`, resolver blocks organization profiles, DB trigger blocks regression.
- Physician export wrong-profile issue: share bundles now receive the shared profile id.
- Daily-coach cron N+1: source queries are bounded/parallel and profile entitlement lookup is batched.
- Share access-code gating: physician, care-network, and future-self share routes check access codes
  before returning payloads.

## Visual Findings

### Medium: `/professional` Is Not a Public Clinic Page

Anonymous `/professional` resolves to `/login` in all four visual states. This is intentional in
`app/professional/page.tsx` and `proxy.ts`, but the footer link is labeled "For clinics".

Impact: clinic prospects hit a sign-in page instead of a professional landing/onboarding surface.

Recommended fix: create a public `/professional` landing page and move the app dashboard to
`/professional/dashboard`, or relabel the footer link as "Clinic sign in".

### Low: `/waitlist` Is a 404

`/waitlist` returns 404 in desktop/mobile and light/dark. The 404 is branded and usable, but launch
traffic from old emails, search indexes, or cached links should not dead-end.

Recommended fix: add a redirect from `/waitlist` to `/` or `/pricing`.

### Low: `/about` Image Captions Are Swallowed By Images

The captions at the bottom of the two `/about` images are extremely low contrast in light mode,
especially on desktop. They sit directly on complex/dark image areas with no readable backing.

Recommended fix: add a subtle bottom gradient/scrim or move captions below the images.

### Note: Homepage Hero Image Is Intentionally Covered By Hero Copy

The automated covered-image detector flagged the homepage hero image in all four states because
the hero text and CTAs sit on top of it. The composition looks intentional and does not appear
broken. If the design goal is to let users inspect the image, add a larger safe zone or stronger
scrim; otherwise this is acceptable.

## Visual Metrics

- Pages captured: 160.
- Statuses: 156 x `200`, 4 x `404` (`/waitlist` only).
- Horizontal overflow: 0.
- Clipped text: 0.
- Covered `<img>` detections: homepage hero only.
- Clean route families by automation: 38/40.

Tokenized share pages (`/future-self/[token]`, `/physician-share/[token]`, and
`/care-network/[token]`) were code-audited, but this visual pass did not create live share tokens
and screenshot those exact token pages.

## Suggested Fix Order

1. Add the personal-workspace join to `app/api/health-profiles/active/route.ts`.
2. Decide `/professional`: public clinic landing page vs relabeled clinic sign-in.
3. Redirect `/waitlist`.
4. Fix `/about` caption contrast.
5. Validate the `NOT VALID` constraints in production.
