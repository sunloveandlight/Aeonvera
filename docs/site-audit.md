# Site Audit Notes

Last updated: 2026-06-18

## Button And Control System

- Consolidated dashboard-style card controls under `av-control-card`.
- Verified signed-in routes across light/dark and desktop/mobile with a disposable Sovereign QA account.
- Latest authenticated visual audit: 16 routes x 2 themes x 2 viewport classes, 0 button/control issues, 0 protected-route redirects.
- Verification artifact: `/tmp/aeonvera-auth-audit-v9/audit.json`.

## Audit Decisions

### Marketing Layout Primitives

Marketing pages intentionally use bespoke landing, pricing, and narrow centered presentation layouts instead of the product `PageContainer` primitive.

Decision: do not force these pages into product layout primitives. Their Apple-style spacing, centered frames, and page-specific composition are intentional, and converting them would change the deliberate look that should be preserved.

Audit note: visible spacing inconsistencies such as hero padding drift and unexplained magic-number offsets should still be fixed locally when found.

### Report Accuracy Versus Completeness

The report currently uses `accuracyScore` while showing user-facing copy around profile completeness.

Decision: flag only. `accuracyScore` and profile completeness appear to represent different product concepts: estimate confidence/accuracy versus how much user input exists. Relabeling this without confirming product intent could make the report less accurate, not more.

Recommended follow-up: define the metric contract before changing labels:

- `accuracyScore`: confidence/accuracy of the biological age estimate.
- `completionPct` or equivalent: completion of assessment/profile input.

### Biological Age Hyphenation

The product uses both `biological age` and `biological-age`.

Decision: do not mass-change. The variation is grammatically defensible:

- `biological age` as a noun phrase.
- `biological-age` as a compound adjective before another noun.

Audit note: only fix clear inconsistencies where the phrase reads awkwardly or conflicts with nearby copy.
