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

## Data Classes and Minimum Necessary Access

Profile assignment alone is not enough. A staff member can be assigned to a
member while still seeing only the minimum data needed for their role.

Use explicit data classes:

- `identity`: name, age band, contact status, roster metadata
- `administrative`: consent state, scheduling, intake status, billing-safe metadata
- `readiness`: sleep, HRV, recovery, strain, resting heart rate, recent wearable signals
- `performance`: training load, activity score, steps, VO2 max, strength/cardio adherence
- `nutrition`: diet pattern, macros, supplements, hydration, nutrition goals
- `clinical_summary`: physician-ready summary, risks, diagnoses entered by the user
- `labs_basic`: common biomarkers and trend summaries
- `labs_sensitive`: reproductive hormones, infectious disease, genetic findings, mental-health-adjacent markers
- `mental_health`: stress, anxiety, mood, cognitive notes, therapy-related answers
- `documents`: uploaded PDFs, physician exports, lab reports
- `notes`: professional notes and care-team annotations

Default role scopes:

- `coach`: `identity`, `readiness`, `performance`
- `trainer`: `identity`, `readiness`, `performance`, limited `nutrition`
- `clinician`: assigned clinical data classes, including labs when consented
- `front_desk`: `identity`, `administrative`
- `org_admin`: roster/staff/billing, no clinical data by default
- `auditor`: audit records only

Sports teams should default to performance/readiness. Clinics can request broader
clinical access, but only through explicit consent and role assignment.

Every server-side read should pass through a single access function that answers:

- Is this staff user a member of this organization?
- Is the target health profile part of this organization?
- Is the staff user assigned to this profile or allowed roster-wide access?
- Which data classes are allowed for this staff/profile/context?
- Does active consent cover those data classes?
- Should any returned fields be redacted?

## Consent Object

Consent should be modeled as a first-class record, not a status string.

Suggested fields:

- `id`
- `workspace_id`
- `health_profile_id`
- `subject_user_id` nullable for org-created, unclaimed profiles
- `subject_email` nullable
- `granted_by_user_id` nullable
- `granted_by_guardian_id` nullable
- `captured_by_staff_user_id` nullable for out-of-band capture
- `capture_method`: `in_app`, `uploaded_form`, `esignature`, `imported_contract`, `guardian`
- `legal_basis`: `patient_consent`, `guardian_consent`, `treatment`, `contract`, `other`
- `data_classes`: array of approved classes
- `allowed_roles`: array of roles covered by consent
- `purpose`: `clinical_care`, `performance_support`, `team_operations`, `research`, `other`
- `starts_at`
- `expires_at` nullable
- `revoked_at` nullable
- `revoked_by_user_id` nullable
- `revocation_reason` nullable
- `source_document_url` nullable
- `source_document_hash` nullable
- `policy_version`
- `created_at`
- `updated_at`

Revocation should stop future access immediately. Previously viewed/exported data
should remain represented in audit logs, and exported documents should be traceable
to the consent/version that allowed them.

For login-less org-created members, consent provenance becomes the legal artifact:
who captured it, by what method, under which policy, and with which supporting
document or signature.

## Minors Policy

Aeonvera Professional should make an explicit launch decision on minors.

Recommended launch posture:

- Do not self-serve minors at launch.
- Allow minors only in approved pilot organizations.
- Require guardian consent before any staff access.
- Record guardian identity, relationship, capture method, and consent document.
- Give minor profiles a clear `minor` flag and stricter default redaction.
- Treat youth sports as a separate compliance workflow, not a normal roster import.

If minors are out of scope for launch, the product and contracts should say so.

## Break-Glass Access

Clinics may ask for emergency access outside normal assignment. Decide whether this
exists before launch.

Recommended approach:

- Do not include break-glass access in the first release unless a clinic pilot
  contract truly requires it.
- If included, require a reason, short expiration, elevated role, and automatic
  audit event.
- Notify organization admins and, where appropriate, the patient/member.
- Never allow break-glass to bypass consent for data classes that were never
  authorized unless the legal basis has been explicitly modeled.

## Audit Logging

Every professional access to member data should create an audit event.

Minimum event fields:

- `workspace_id`
- `actor_user_id`
- `actor_role`
- `health_profile_id`
- `action`: `view`, `export`, `download`, `update`, `assign`, `revoke`, `break_glass`
- `data_classes`
- `route` or server operation name
- `access_decision`: `allowed`, `denied`, `redacted`
- `consent_id` nullable
- `assignment_id` nullable
- `ip_hash`
- `user_agent_hash`
- `created_at`

Audit logs should be append-only from the application layer.

## Technical Schema Sketch

Extend existing tables rather than creating a parallel product.

Core additions:

- `workspaces.workspace_type`: `personal`, `organization`
- `workspaces.organization_subtype`: `clinic`, `sports_team`, `performance_group`, `concierge_practice`
- `workspace_members.role`: expanded professional roles
- `organization_profile_assignments`
- `organization_profile_consents`
- `organization_access_audit_events`
- `organization_break_glass_events` if break-glass ships
- `health_profile_data_class_overrides` only if needed for exceptional redaction

`organization_profile_assignments` should include:

- `workspace_id`
- `health_profile_id`
- `staff_user_id`
- `role`
- `data_classes`
- `starts_at`
- `expires_at`
- `revoked_at`
- `created_by_user_id`

The load-bearing migration remains full profile-scoping across all health data
tables. Any route that can read member data must be profile-scoped before
Professional ships.

## Server Access Guard

Build one server-side guard and make professional routes use it.

Conceptual API:

```ts
authorizeProfessionalProfileAccess({
  actorUserId,
  workspaceId,
  healthProfileId,
  requestedDataClasses,
  action,
})
```

It should return:

```ts
{
  allowed: boolean;
  redactedDataClasses: string[];
  allowedDataClasses: string[];
  role: string;
  consentId?: string;
  assignmentId?: string;
  reason?: string;
}
```

Do not let individual routes hand-roll role checks.

## Cross-Tenant Isolation Tests

Professional cannot launch without tests for both failure modes:

- Cross-org isolation: staff in Organization A cannot see Organization B roster,
  assignments, consents, audits, exports, or profiles.
- Intra-org isolation: staff in one org cannot see unassigned profiles or data
  classes outside their role/consent scope.

These should be tested at the API/RLS layer, not only in UI.

## Launch-Blocking Requirements

Before launching Aeonvera Professional with real clinics or teams:

1. Finish profile-scoping across clinical and wearable read paths.
2. Create first-class consent records with scopes, provenance, expiry, and revocation.
3. Add field/data-class redaction for minimum-necessary access.
4. Add mandatory audit logging for every staff read/export/update of member data.
5. Build a single server-side access guard for staff/profile/data-class access.
6. Decide and document the minors policy before any youth sports use.
7. Decide whether break-glass access exists; if yes, model it explicitly.
8. Keep sports-team access more limited than clinic access by default.
9. Separate B2B billing from consumer Core/Elite/Sovereign plans.
10. Prepare BAA/compliance posture for clinics.
11. Add cross-tenant and intra-org isolation tests.
12. Run a focused security review or pen test on Professional access paths.

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
