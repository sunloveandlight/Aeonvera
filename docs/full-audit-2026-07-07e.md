# Aeonvera — Full Code Audit #6 (2026-07-07): every layer

Run against the working tree (incl. the WIP memory/biological-context feature, now partly
hardened). 16 finder streams, adversarial verification of every high. Also verified: eval
harness green (17 guards) and `tsc --noEmit` clean.

| Critical | High | Medium | Low |
|---|---|---|---|
| **0** | **2** | ~14 | ~34 |

**Trend: 6 highs (audit #5) → 2 highs.** The memory feature is being hardened as it's built
(the `requireProfileWriteAccess` gate landed, more PHI-grant audit sites added). What remains
is one real leak in the new memory path, a perf hotspot, and a persistent governance gap.

---

## 🟠 HIGH (2)

### H1. Auto-memory's heuristic path bypasses the third-party safety filter → stores someone else's PHI as yours
`lib/memory/automaticMemory.ts:92-94, 150-153, 294-306` (verified)
The new feature added `isSafeSubjectMemory` to block third-party facts — but it's applied **only to the LLM-normalized candidates**, never to the heuristic `fallback`. The clinical regex matches `diagnosed with`, `testosterone`, `pregnant`, `hrt`, `estrogen`, `allergy to` *anywhere* in the message, so **"my wife was diagnosed with cancer"** gets stored as the *current user's own* durable clinical memory — then flows into the agent's clinical brief. It fires unconditionally and **always** when `OPENAI_API_KEY` is unset (fallback-only path). This is exactly the cross-subject leakage the guard exists to prevent.
**Fix:** run every candidate (heuristic + LLM) through `isSafeSubjectMemory` before storing — filter `fallback` at all three return sites, or inside `extractHeuristicCandidates`.

### H2. Daily-coach cron serial N+1 (up to 3 queries/profile before any work)
`app/api/cron/daily-coach/route.ts:216` (verified)
`buildProfileWorkItems` awaits `isHealthProfileFrozenById` inside a `for` loop; each call is 3 sequential round-trips with no workspace memoization, and the `health_states` source query has **no `.limit()`** so the set grows unbounded with the user base. Thousands of serial round-trips before the coach loop starts → real risk of blowing Vercel execution limits at scale.
**Fix:** collect distinct profile ids, resolve entitlements per distinct workspace with a couple of `.in()` queries, compute frozen locally.

---

## 🟡 MEDIUM — clustered in the new WIP + professional governance

### Memory / biological-context WIP
- **Automatic memory adds a blocking OpenAI round-trip to *every* agent/voice response** (latency on the hot path) — `personalHealthAgent.ts:464+`.
- **Autopilot daily-plan reads agent preferences unscoped** (`getAgentPreferenceMemory({userId})` without the profile filter) → cross-profile mixing while the rest of the plan is profile-scoped — `daily-plan/route.ts:108`.
- **Clinical follow-up answers scoped only by `user_id`** → cross-profile writes for multi-profile users — `clinicalFollowUpResponses.ts:66`.

### Professional consent governance (persistent)
- **Org admin can self-grant staff access to sensitive PHI** (labs_sensitive, mental_health) under `treatment`/`contract`/`other` legal basis **with no member action and no document** (`consents/route.ts:77`, `workflow.ts:901`). This is the same "consent isn't really consent" gap, now via the non-`patient_consent` bases.
- **Invite acceptance can overwrite an existing member's role** (owner/admin downgrade) — `workflow.ts:751`.
- **Audit-log write failure throws *after* the mutation committed** → unaudited PHI action + 500 on a succeeded write — `workflow.ts:1549`.
- **Seat limit (`max_health_profiles`) still unenforced**; lists **truncate at 250** with no pagination and misreport roster count.
- **Cron wearable-sync fabricates an owner profile context**, bypassing freeze/revocation checks — `wearable-sync:141`.

### Perf
Agent context re-fetched up to 2× more per request; report/coach/health-profiles run independent queries sequentially.

## 🟢 LOW highlights (new-feature + recurring)
- **Biological-context notes are injected into the agent prompt as trusted "Pinned biological context"** (self prompt-injection) and **accept clinically contradictory combos** (e.g., male + pregnant) with no validation — `biologicalContext.ts:199,265`.
- **No endpoint to remove/deactivate staff** (departed/compromised staff can't be cut off); **auditor role locked out of the audit API** despite RLS granting it.
- Professional PHI-read endpoint is still a **scaffold returning stubs** (verify before enabling real PHI).
- Persistent: CSP `unsafe-inline`, X-Forwarded-For rate-limit key, push PATCH toggles all devices, professional pages not middleware-protected, off-brand `--pro-*` CSS, dead code (`buildClinicalIntelligence`, `requiredUpgrade`, `getHealthProfileLimit`, 160-line `CanonicalMetricDefinitions`), `requireUser` duplicated across 9 routes.

---

## What I think
The direction is clearly right — **6 → 2 highs**, and the memory feature is visibly being hardened as it's built rather than shipped raw. The one high that matters is **H1**: the third-party filter is on the LLM path but not the heuristic fallback, so the leak still fires (and always fires with no OpenAI key). It's a one-function fix — apply the guard to every candidate — and it closes the last big memory-safety hole. H2 is perf-only but will bite at scale.

The stubborn theme is **professional consent governance**: `patient_consent` is now member-verified, but an admin can still self-attest sensitive-PHI access under `treatment`/`contract`. Until that's closed, "consent-based" is only half true. And the WIP biological-context needs input validation + untrusted-text handling before it feeds the model.

Engine quality is now **guarded**: the eval harness (`npm run test:eval`, 17 checks green) locks the audit's unit bugs shut and measures the sex-differentiation gap (still ~2/45 in bio-age). Grow it to cover memory recall next.

Nothing here is critical; the codebase is in its healthiest state across the six audits. Priority: **H1 (memory leak) → professional consent bases → H2 (cron perf) → the WIP validation/latency items.**

*Findings JSON: `scratchpad/code_findings_v6.json`.*
