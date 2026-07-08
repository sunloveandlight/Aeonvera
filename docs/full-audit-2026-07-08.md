# Aeonvera — Full Audit #7 (2026-07-08): code + visual, every layer & page

16 code finder streams (adversarial verification of every high) + visual audit of all 39
pages × 4 views (156 screenshots, incl. token-gated share pages + professional portal).
Also: eval harness green, `tsc --noEmit` clean, build clean.

| Layer | Critical | High | Med | Low |
|---|---|---|---|---|
| Code | **0** | 4 | ~10 | ~29 |
| Visual | 0 broken | **0** | 13 | 18 |

## Trend across 7 audits
Criticals: **2 → 0**, and held at 0 for five straight audits. Visual: **2 broken → 0 → 0**,
now **0 high** two runs running, 22/39 clean. The code highs no longer come from the
established app — they're all on the **newest, highest-stakes surfaces** (multi-profile,
Professional/PHI, memory), and they're getting *deeper* as those features mature.

---

## 🟠 Code HIGH (4) — all on the multi-profile / professional / memory PHI surfaces

### H1. Wearable sync writes one profile's device data onto a *different* active profile
`app/api/wearables/oura/sync/route.ts:57` (+ whoop) — verified
`wearable_connections` is keyed only `(user_id, provider)` and the token lookup ignores health-profile, but the interactive sync ingests into the **active-cookie** profile. So: connect Oura on profile A → switch active profile to B → sync → **A's Oura sleep/HRV lands on B's health record** and B's biological age. Worse, connecting the same provider on B **overwrites A's connection row**, silently re-pointing A's future cron syncs to B. (The cron path is correct — it uses the stored profile — which proves the interactive route is the wrong one.)
**Fix:** ingest into the connection's *own* `health_profile_id` (match cron), and add `health_profile_id` to the connection key so a switch can't clobber another profile.

### H2. Consent `legal_basis = "other"` bypasses *all* documentation/consent requirements
`app/api/professional/consents/route.ts:78` — verified
The documented-basis requirement (and the DB check constraint) only fire for `treatment`/`contract`. `legal_basis='other'` is unconstrained — so an org admin can POST a consent for `labs_sensitive`/`mental_health` with **no document, no member action, no in-app grant**, and the access engine never reads `legal_basis`. This is a clean hole straight through the consent gate.
**Fix:** require a documented source **or** in-app member grant for any *sensitive* data class regardless of `legal_basis`.

### H3. Auto-memory heuristic still mis-attributes third-party clinical status to the subject
`lib/memory/automaticMemory.ts:301` — verified
The `isSafeSubjectMemory` filter now runs (good — the prior leak is narrowed), but it's **heuristic**, and the extraction regex still lets some third-party clinical phrases through onto the user's own profile. The block isn't reliable.
**Fix:** don't rely on a regex to decide subject ownership — require explicit first-person attribution before storing anything `clinical`, and default-drop ambiguous cases.

### H4. Org admin can read/write roster PHI (biological context, memories) outside the consent + audit model
`lib/professional/workflow.ts:420` — verified
The new memory + biological-context data on roster profiles is reachable by org-admin paths that **don't go through the consent check or the audit log**, so an admin can see/modify a member's memories/biological context without a consent record and without leaving an audit trail — the exact governance the portal exists to enforce.

---

## 🟡 Notable code mediums
- **Wearable-sync cron writes to frozen/over-cap profiles** (entitlement bypass).
- **Admin-captured consent omits `subject_user_id`** → member can't see or revoke it via RLS.
- **No role/data-class compatibility check** when creating consents/assignments (a `coach` can be granted clinical labs).
- **Invite-accept grants happen before the atomic status claim** → duplicate consents on concurrent/retried accept.
- **Daily-plan reads the wrong subject's preference memory** (cross-profile mixing).
- **Bio-age history insert error swallowed** → route returns success on persistence failure.
- Perf: agent reloads its 16-query context up to 3× per request; several independent reads/writes run sequentially on the hot path.

## 🟢 Code lows (recurring)
CSP `unsafe-inline`; `/professional` pages absent from middleware protection; biological-context notes injected into the prompt as trusted "pinned context"; postpartum state not validated vs biological sex; auditor role locked out of the audit API; dead code (`buildClinicalIntelligence`, `requiredUpgrade`, `getHealthProfileLimit`, `CanonicalMetricDefinitions`); `requireUser` duplicated across routes.

---

## 🟠 Visual — 0 broken, 0 high (second run). One cluster dominates.

### The decorative AeonCommandOrb (fix once, clears most of the list)
Still overlapping content and/or washing to a smudge in light theme on: **life-autopilot** (over "Behavior Orchestration"), **network** (empty-state text), **onboarding** & **success** (the **consent checkbox** — on onboarding-dark it renders as a broken/cropped image), **optimization** (over the question heading), plus faint wash-out on **assessment, dashboard, concierge-success, memory**. This is ~half the medium+low list. One theme-aware, off-interactive-surfaces fix resolves it.

### Light-theme contrast
`about` hero captions, `physician-share` access-code input, `waitlist` "LONGEVITY LIBRARY" eyebrow, `physician-export` toggle chips, `success` consent-checkbox border — all faint on light.

### Empty-state / layout balance
`dashboard` "Your report" void + duplicated greeting; `physician-export` missing an "Optimization Protocols" empty line; `digital-twin` scenarios void; `plan` "Protected until upgrade" panel; **`pro-dashboard` roster drops STATUS/CONSENTS columns on mobile**; `pro-invite` mobile is a tall empty card; `onboarding` duplicated "Complete Setup" CTA.

## Clean (22/39): all marketing, all resources, all share pages, and companion/data-sources/life-os/ops/report/settings.

---

## What I think
Seven audits in, the codebase is in its **healthiest structural state** — 0 criticals for five straight runs, visual essentially done. The remaining code risk is concentrated and coherent: **the multi-profile + Professional + memory PHI surfaces are outrunning their guardrails.** Every high this round is "the right person has *some* access, but the scoping/consent/audit boundary is wrong" — wearable data crossing profiles, consent bypassable via `other`, memory attribution heuristic, org-admin PHI outside consent+audit. None is a mass breach, but for a clinic product these are the ones that matter.

The through-line for the fix: **one consistent PHI-scoping contract** — (a) ingest/read/write always keyed to the *resource's* profile, never the active cookie or login user; (b) sensitive-class access always requires a documented or member-granted consent *regardless of legal basis*; (c) every PHI read/write on a roster profile passes through the consent check **and** the audit log. Build that once and most of these highs collapse together — same way the orb fix collapses the visual list.

Priority: **H1 wearable cross-profile → H2 consent `other` → H4 org-admin PHI outside audit → H3 memory attribution → the orb.**

*Screenshots: `scratchpad/shots-v6`. Findings: `scratchpad/code_findings_v7.json`, `scratchpad/visual_findings_v7.json`.*
