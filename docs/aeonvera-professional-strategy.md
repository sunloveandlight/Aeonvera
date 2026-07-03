# Aeonvera Professional Strategy

Date: 2026-07-03

## Core Direction

Aeonvera Professional should be a consent-based organization portal for clinics,
sports teams, performance medicine groups, and concierge health teams.

The product should not be framed as "organizations can access all medical
information." It should be framed as professional access to health intelligence
that is scoped, consented, auditable, revocable, and role-based.

## Key Product Principle

The patient, athlete, or member should remain central to access control.

Organizations may manage rosters, but they should not silently accumulate medical
records on people who never agreed. This is especially important for sports teams,
where coaches and management should not automatically see full medical data.

## Two Data Ownership Models

### A. Member-Owned, Org-Delegated Access

Each person owns their Aeonvera health profile and grants a clinic, clinician,
team, trainer, or coach access.

This is closest to the existing care-network model:

- member owns profile
- professional receives scoped access
- access can expire
- access can be revoked
- roles can define what the professional sees

This is lower-liability and highly trust-aligned, but it requires every member to
have an account and actively consent.

### B. Org-Owned Roster

The clinic or team creates and manages profiles for its roster. Members may not
initially have logins.

This is closer to what clinics and sports teams often expect operationally, but
it carries much heavier compliance and consent burden.

Aeonvera should support this reality, but every roster profile should have:

- explicit consent status
- provenance of who created it
- legal basis or authorization record
- ability for the member to claim the profile
- clear access rules
- audit history

## Recommended Model

Use a hybrid model:

- Clinics: org-owned roster with formal consent and BAA-ready posture.
- Sports teams: org-managed roster with athlete claim/consent path.
- Coaches/team staff: limited performance/readiness views by default.
- Medical/performance staff: broader access only when explicitly authorized.

## Architecture Direction

Do not create a totally separate clinic/team data model.

Reuse existing primitives:

- `workspaces`
- `workspace_members`
- `health_profiles`
- `health_profile_access`

Extend them with:

- workspace type: `personal` vs `organization`
- organization subtype: `clinic`, `sports_team`, `performance_group`, etc.
- richer staff roles
- profile assignments
- consent records
- mandatory audit logs
- organization billing and entitlements

An organization is essentially a workspace with many health profiles and staff
members.

## Access Model

Use a two-layer model:

1. Workspace role controls what someone can do in the organization.
2. Per-profile assignment controls whose data they can access.

Example roles:

- `org_admin`: manage roster, staff, billing, settings
- `clinician`: view assigned clinical profiles
- `trainer`: view assigned performance/recovery profiles
- `coach`: view limited readiness/performance summaries only
- `front_desk`: scheduling/intake, no clinical data by default
- `auditor`: read audit/compliance logs
- `read_only`: limited read access

Staff should not automatically see the entire roster unless explicitly intended.

## Launch-Blocking Requirements

Before launching Aeonvera Professional with real clinics or teams:

1. Finish profile-scoping across clinical read paths.
2. Create first-class consent records.
3. Add mandatory audit logging for every staff read of member data.
4. Build a single server-side access guard for staff/profile access.
5. Keep sports-team access more limited than clinic access.
6. Separate B2B billing from consumer Core/Elite/Sovereign plans.
7. Prepare BAA/compliance posture for clinics.
8. Run a focused security review or pen test on cross-profile access.

## Product Surface

Public marketing / intake:

- `/professional`
- `/professional/clinics`
- `/professional/sports-teams`
- `/professional/security`
- `/professional/apply`

Professional app portal:

- roster dashboard
- member profile detail
- assigned staff
- consent status
- clinical summary
- labs and biomarkers
- wearable/recovery summary
- physician/team export packet
- audit log
- staff management
- billing

## Go-To-Market

Do not launch this as self-serve initially.

This should be invite-only and sales-assisted:

- design partner clinics
- design partner sports/performance teams
- contracts
- BAAs where needed
- manual onboarding
- high-touch support

Consumer subscription tiers should remain separate from organization plans.

B2B pricing should likely be:

- platform fee
- staff seats
- active roster/member count
- optional concierge/onboarding fees

## Positioning

Possible product name:

Aeonvera Professional

Positioning:

> Consent-based health intelligence infrastructure for clinics and performance
> teams.

Safer phrasing:

> Aeonvera Professional lets clinics and performance teams manage consent-based
> access to member health intelligence, biomarker trends, wearable signals, and
> physician-ready summaries.

Avoid:

> Teams can access all member medical information.

## Strategic Takeaway

This can become a major pillar of Aeonvera, but it should be treated as
enterprise health infrastructure, not just a bigger dashboard.

The hardest parts are consent, auditability, staff access boundaries, and
profile-scoped data integrity. The UI comes after those foundations are safe.
