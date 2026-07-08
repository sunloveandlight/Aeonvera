# Aeonvera — Full Audit #8 (2026-07-08) — PRODUCTION IS LIVE (run 2)

Audited against **live production** (`www.aeonvera.com`, real Supabase). Code: 16 finder
streams, adversarial verification of every high/critical. Visual: all 39 pages × 4 views
captured **from the live site** (156 screenshots).

| Layer | Critical | High | Med | Low |
|---|---|---|---|---|
| Code | **1** | 9 | ~14 | ~21 |
| Visual | 1 broken | 2 | 13 | 14 |

Severity is weighted for live impact. **Most code highs share ONE root cause** — fixing
`lib/professional/workflow.ts:421` collapses the critical + ~4 highs at once.

---

## 🔴 CRITICAL — fix before any real clinic/org is onboarded (live PHI exposure)

### C1. An org admin gets full owner read/write to a roster member's clinical PHI, bypassing consent + minimum-necessary + the audit log
`lib/professional/workflow.ts:421`
`createRosterProfile()` inserts a `health_profile_access` row for the creating admin with `role='owner'` — **structurally identical to a personal-profile owner row.** The consumer app's `resolveActiveHealthProfileContext()` resolves the active profile on `user_id + status='active'` alone, with **no `workspace_type='organization'` check.** So an org admin can set the active-profile cookie to a roster profile and hit **any of ~44 consumer routes** (`/api/memory/semantic`, `/api/health-profiles/biological-context`, `/api/labs/*`, `/api/longevity/biological-age`, `/api/clinical/insights`, `/api/agent/chat`…) to **read and write that member's clinical PHI** — including `labs_sensitive`/`mental_health`/memories — with **zero consent check and zero `organization_access_audit_events` entry.** Runs on the service-role client, so RLS doesn't stop it.

**Exposure:** live, but blast radius scales with *actual roster usage*. If no real clinics are onboarded yet, current exposure is low — treat as **fix-now, but likely not-yet-breached** if the portal is still internal.

**Fix (one place):** don't grant the admin a personal owner `health_profile_access` row on organization profiles — route roster PHI through the assignment+consent+audit path; and harden `resolveActiveHealthProfileContext` to refuse `workspace_type='organization'` profiles on consumer routes. Closes the highs below too.

---

## 🟠 HIGH (9) — grouped by root cause

**Same root as C1** (4 finders confirmed it): org admin reaches roster members' **memory + biological context** as owner, outside consent+audit.

**Physician-export mixes two people's data (live clinical-safety risk):**
- **The export headline "Biological age" shows the *exporting user's* value, not the exported profile's** (`physicianExportBundle.ts:99`) — a clinician viewing a share sees the **wrong person's** number.
- **A null-profile share link silently rebinds to the owner's arbitrary "first" health profile** (`physicianExportBundle.ts:76`).

**Wearable cross-profile PHI contamination** (`cron/wearable-sync/route.ts:73` + interactive sync): OAuth token fetched without profile scope → one profile's device data attributed to another (and profile-scoped connections may never sync).

**Auto-memory third-party attribution** (`automaticMemory.ts:307`): the heuristic still stores "my wife was diagnosed with cancer" as the *subject's own* durable clinical fact.

---

## 🟡 Notable mediums
- **Consent `legal_basis='other'` (+ performance/nutrition/administrative classes) escape the documented-basis requirement** — admin self-authorizes sensitive PHI, and the DB constraint omits `other` too.
- **Org admin/owner reads roster identity + administrative PHI with no consent record**.
- **No role↔data-class minimum-necessary mapping** (a `coach` can be granted clinical labs).
- **Lab import returns a false error + leaks an internal migration path** on insert failure.
- **Over-broad "table missing" detection swallows real DB errors** (memory).
- Pro lists truncate at 250 (no pagination); agent hot path runs I/O sequentially.

## 🟢 Lows (recurring)
Any authenticated user can self-create unlimited 250-seat pro orgs (no billing gate); CSP `unsafe-inline`; biological-context validation permits impossible sex/menstrual combos; push PATCH toggles all devices; dead code (`buildClinicalIntelligence`, `requiredUpgrade`, `getHealthProfileLimit`, `CanonicalMetricDefinitions`); pro dashboard forks the design system.

---

## 🟠 Visual (live) — 1 broken, 2 high

- **`/waitlist` 404s on production** ("This page drifted off."). Likely intentional (waitlist removed for launch) — but if any live marketing/email links to `/waitlist`, visitors hit a dead 404. **Decide: redirect `/waitlist` → home, or remove the links.**
- **`optimization` "Step 1" badge collides with the Priority heading** (overlaps "your" on desktop, clips to "St" on mobile).
- **Rest = the familiar cluster:** decorative **AeonCommandOrb** overlapping headings/consent-checkboxes + washing out in light (life-os, memory, network, onboarding, success, optimization); light-theme control contrast (access-code inputs, plan "Unlocked now" checkmarks, pro-dashboard checkboxes, optimization gauge). One orb fix + one light-theme control-contrast pass clears it.
- **23/39 pages clean** on production, incl. all marketing/resources/share pages.

---

## Bottom line — "you launched; now close the PHI boundary"
Structurally the site is strong (0 broken marketing, 23 clean pages, engines guarded by the eval harness). But launch raised the stakes on the least-finished surface — the professional/multi-profile PHI boundary. Every serious finding is one shape: **access is resolved by "which access row / which cookie," not by "is this the right person, with consent, on the record."**

**Immediate order:**
1. **C1** — roster→consumer owner-access bypass (one fix + resolver guard; closes ~5 findings). Before onboarding any real clinic.
2. **Physician-export wrong-profile bio-age** — a clinician seeing the wrong patient's number is clinical-safety on a live share feature.
3. **Wearable cross-profile + auto-memory attribution** — live PHI-integrity.
4. **Consent `other`/documented-basis hole**.
5. Visual: decide `/waitlist`, fix the optimization badge, then the orb.

Also confirm the consent/constraint migrations are actually applied to prod — a Vercel deploy doesn't run them.

*Screenshots (live): `scratchpad/shots-v7`. Findings: `scratchpad/code_findings_v8.json`, `scratchpad/visual_findings_v8.json`. (Note: a separate `docs/full-audit-2026-07-08-live.md` already existed and was left untouched.)*
