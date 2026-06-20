# Multi-Profile Architecture Audit

## Decision

Aeonvera should separate three identities before family accounts are added:

- Login user: the authenticated Supabase user who can sign in, receive notifications, own devices, and perform actions.
- Billing workspace: the account/subscription container that owns Stripe state, plan limits, and member seats.
- Health profile: the person/body whose labs, wearables, plans, reports, memories, and clinical insights are being tracked.

The current app mostly uses `user_id` for all three. That works for one person, but it will become ambiguous as soon as an Elite or Sovereign customer adds a spouse, parent, child, or client profile.

## Plan Entitlement

- Core: 1 health profile.
- Elite: up to 4 health profiles. This supports couples and families without making the feature feel Sovereign-only.
- Sovereign: up to 10 health profiles. This supports a larger private health circle and concierge use cases.

The app-level entitlement now lives in `lib/auth/permissions.ts` as `PLAN_HEALTH_PROFILE_LIMITS` and `getHealthProfileLimit`.

## Foundation Added

The first additive database foundation lives in `supabase/migrations/20260619120000_workspace_health_profiles.sql`.

It creates:

- `workspaces`
- `workspace_members`
- `health_profiles`
- `health_profile_access`
- private RLS helpers under `app_private`
- RLS policies and explicit authenticated grants
- a backfill that creates one workspace, one owner membership, one primary health profile, and one owner profile-access row per existing user/profile

The migration intentionally does not remove or rename existing `user_id` columns. Existing routes can keep working while route-by-route migrations move health-subject reads to the new active profile context.

The first app-side billing bridge lives in `lib/auth/workspaceSubscription.ts`. Central feature/usage gates now prefer workspace subscription state when the new tables are present, then fall back to the existing `profiles.plan` and `profiles.subscription_status` fields. This starts moving billing ownership to the workspace without breaking the current single-user app.

Local limitation: the app compiles, but this environment does not have the Supabase CLI, `psql`, or a local Postgres server installed, so the migration still needs to be applied/tested against a Supabase database before deployment.

## Current Table Classification

| Table | Current owner column | Future scope | Notes |
| --- | --- | --- | --- |
| `profiles` | `user_id` | Split: login user + workspace billing + primary health profile | Currently stores onboarding/profile fields and Stripe/plan state. This is the main ownership knot. |
| `wearable_connections` | `user_id` | Health-subject scoped, with login-user connector metadata later | A wearable belongs to a health profile. The user who connected it should be auditable separately. |
| `wearable_metrics` | `user_id` | Health-subject scoped | Raw biometric data should move to `health_profile_id`. |
| `health_metrics` | `user_id` | Health-subject scoped | Normalized biometric state should move to `health_profile_id`. |
| `health_states` | `user_id` | Health-subject scoped | Current health state should move to `health_profile_id`. |
| `health_alerts` | `user_id` | Health-subject scoped | Alerts are about a body, but may also need actor/delivery ownership. |
| `lab_biomarkers` | `user_id` | Health-subject scoped | Labs are health-profile data. |
| `biological_age_history` | `user_id` | Health-subject scoped | Biological age is about the tracked person. |
| `clinical_insights` | `user_id` | Health-subject scoped | Clinical insight belongs to the profile being analyzed. |
| `optimization_intakes` | `user_id` | Health-subject scoped | Intake answers describe a health profile. |
| `optimization_protocols` | `user_id` | Health-subject scoped | Protocols are assigned to a health profile. |
| `future_self_scenarios` | `user_id` | Health-subject scoped | Scenario can remain shareable/public, but owner should become profile access based. |
| `intervention_outcomes` | `user_id` | Health-subject scoped | Outcome data should move to `health_profile_id`; actor can be stored separately if needed. |
| `daily_execution_plans` | `user_id` | Health-subject scoped | Daily plan is for a health profile. |
| `autopilot_preferences` | `user_id` | Mixed: health-subject preferences with login-user controls | Health goals are profile scoped; notification/automation controls may be actor scoped. |
| `calendar_connections` | `user_id` | Login-user scoped first, optionally health-profile linked | A Google account belongs to the signed-in actor, but events can be attached to a selected health profile. |
| `calendar_events` | `user_id` | Health-subject scoped plus actor/source metadata | The event may be for a health profile even if created through a login user's calendar. |
| `agent_preferences` | `user_id` | Mixed, probably health-subject scoped | Preference meaning decides scope: coaching style for the person vs UI preference for the actor. |
| `coach_memory_profiles` | `user_id` | Health-subject scoped | Memory profile should follow the person being coached. |
| `semantic_memories` | `user_id` | Health-subject scoped, with actor/source metadata | Memories should not bleed across family members. |
| `user_personality_state` | `user_id` | Health-subject scoped | The current name says user, but the data is coaching/personality state for a profile. |
| `life_os_domain_profiles` | `user_id` | Health-subject scoped | Domain scores describe a health/life profile. |
| `life_os_priorities` | `user_id` | Health-subject scoped | Priorities describe the tracked person. |
| `physician_share_links` | `user_id` | Health-subject scoped, created-by login user | The link grants access to a health profile export/view. |
| `care_network_memberships` | `owner_user_id` | Health-profile access scoped | This should become profile/workspace access rather than owner user only. |
| `notification_preferences` | `user_id` | Login-user scoped | Preferences describe where and how a signed-in actor is notified. |
| `push_subscriptions` | `user_id` | Login-user/device scoped | Device tokens belong to the signed-in user. |
| `notification_deliveries` | `user_id` | Login-user scoped with optional health profile reference | Delivery is to an actor/device; content may reference a profile. |
| `usage_events` | `user_id` | Billing/workspace scoped plus actor/profile dimensions | Usage should count against workspace plan limits, while preserving actor and health profile. |
| `stripe_events` | none/user references in migration context | Billing/workspace scoped | Stripe event processing should attach to workspace/customer, not health profile. |
| `command_orb_action_events` | `user_id` | Audit/event scoped | Keep actor user; add workspace/profile context when available. |
| `behavior_events` | `user_id` | Audit/event scoped with profile context | Behavior can be caused by an actor but interpreted for a health profile. |
| `aeonvera_events` | `user_id` | Audit/event scoped with profile context | Same pattern as behavior events. |
| `conversation_events` | `user_id` | Audit/event scoped with profile context | Conversation actor and subject can differ in family accounts. |
| `coach_outputs` | `user_id` | Audit/event plus health-subject output | Store actor/delivery separately from profile being coached. |
| `behavior_feedback_events` | `user_id` | Audit/event scoped with profile context | Needs both actor and health profile. |
| `behavior_learning_events` | `user_id` | Audit/event scoped with profile context | Needs both actor and health profile. |
| `kernel_cooldown_state` | `user_id` | Mixed: actor/workspace throttle | Decide per meter whether cooldown is per actor, workspace, or health profile. |
| `kernel_execution_log` | `user_id` | Audit/event scoped | Should preserve actor, workspace, health profile, and job context. |

## Query Inventory

The codebase has many direct `user_id` filters. The highest-risk files are:

| File | Approximate direct `user_id`/`owner_user_id` touches | Migration concern |
| --- | ---: | --- |
| `lib/agent/personalHealthAgent.ts` | 18 | Central context loader; must use active health profile before multi-profile launch. |
| `app/api/digital-twin/timeline/route.ts` | 17 | Longitudinal health timeline should be profile scoped. |
| `app/api/agent/realtime/route.ts` | 16 | Realtime context should not mix family member data. |
| `lib/autopilot/morningAutopilot.ts` | 11 | Daily planning and deliveries need actor/profile split. |
| `lib/coach/runCoachPipeline.ts` | 11 | Coach pipeline must be profile scoped. |
| `lib/digital-twin/physicianExportBundle.ts` | 10 | Export bundle must be profile scoped and permission checked. |
| `app/api/autopilot/daily-plan/route.ts` | 10 | Plan read/write must use current health profile. |
| `app/api/agent/planner/route.ts` | 9 | Planner context combines membership, profile, and care network. |
| `app/api/autopilot/preferences/route.ts` | 9 | Mixed actor/profile preference handling needs a clean split. |
| `app/dashboard/page.tsx` | 8 | Dashboard needs active profile context before family switching. |
| `app/api/longevity/report/route.ts` | 8 | Reports are health-profile scoped. |
| `app/api/optimization/protocol/route.ts` | 8 | Protocol generation should be profile scoped. |

Other direct touches exist across labs, clinical follow-ups, semantic memory, wearable sync, calendar, notifications, Stripe routes, onboarding, report pages, care network, physician shares, and Life OS. The migration should not be done by random replacement. Each touch needs to be assigned one of these meanings:

- Keep as login-user `user_id`.
- Change to `health_profile_id`.
- Change to `workspace_id`.
- Keep actor `user_id` and add `health_profile_id`/`workspace_id`.

Full direct-touch inventory from `.eq("user_id", ...)`, `.eq("owner_user_id", ...)`, and `user_id:` writes:

| File | Touches |
| --- | ---: |
| `lib/agent/personalHealthAgent.ts` | 18 |
| `app/api/digital-twin/timeline/route.ts` | 17 |
| `app/api/agent/realtime/route.ts` | 16 |
| `lib/autopilot/morningAutopilot.ts` | 11 |
| `lib/coach/runCoachPipeline.ts` | 11 |
| `lib/digital-twin/physicianExportBundle.ts` | 10 |
| `app/api/autopilot/daily-plan/route.ts` | 10 |
| `app/api/agent/planner/route.ts` | 9 |
| `app/api/autopilot/preferences/route.ts` | 9 |
| `app/dashboard/page.tsx` | 8 |
| `app/api/longevity/report/route.ts` | 8 |
| `app/api/optimization/protocol/route.ts` | 8 |
| `lib/memory/semanticMemory.ts` | 7 |
| `app/api/care-network/invitations/route.ts` | 7 |
| `app/api/notifications/preferences/route.ts` | 7 |
| `lib/data/proactiveDataSourceFollowUps.ts` | 6 |
| `lib/memory/coachMemoryProfile.ts` | 6 |
| `lib/wearables/ingestWearableMetrics.ts` | 5 |
| `lib/clinical/clinicalFollowUpResponses.ts` | 5 |
| `app/api/stripe/checkout/route.ts` | 5 |
| `app/assessment/AssessmentPageClient.tsx` | 5 |
| `app/api/health/state/route.ts` | 5 |
| `app/api/longevity/future-self/scenarios/route.ts` | 5 |
| `app/api/longevity/modalities/route.ts` | 5 |
| `app/api/digital-twin/outcomes/route.ts` | 5 |
| `lib/longevity/refreshBiologicalAge.ts` | 4 |
| `lib/coach/dailyIntelligenceBrief.ts` | 4 |
| `app/api/physician-share-links/route.ts` | 4 |
| `app/api/longevity/biological-age/route.ts` | 4 |
| `app/onboarding/page.tsx` | 3 |
| `lib/notifications/coachDelivery.ts` | 3 |
| `app/data-sources/page.tsx` | 3 |
| `lib/clinical/clinicalIntelligence.ts` | 3 |
| `app/report/page.tsx` | 3 |
| `lib/longevity/biologicalAgeImprovementLoop.ts` | 3 |
| `lib/usage/tierUsage.ts` | 3 |
| `lib/memory/conversationMemoryFusionEngine.ts` | 3 |
| `lib/agent/agentCommandRouter.ts` | 3 |
| `app/api/notifications/push-subscriptions/route.ts` | 3 |
| `lib/personality/adaptivePersonalityEngine.ts` | 3 |
| `app/api/notifications/test-coach/route.ts` | 3 |
| `app/api/life-os/priorities/route.ts` | 3 |
| `lib/wearables/oauth.ts` | 2 |
| `lib/clinical/proactiveClinicalFollowUps.ts` | 2 |
| `lib/execution/aeonveraExecutionEngine.ts` | 2 |
| `app/api/stripe/sync-subscription/route.ts` | 2 |
| `lib/calendar/google.ts` | 2 |
| `app/api/cron/wearable-sync/route.ts` | 2 |
| `lib/auth/ensureProfile.ts` | 2 |
| `app/api/memory/semantic/route.ts` | 2 |
| `app/api/calendar/google/events/route.ts` | 2 |
| `app/api/agent/activity/route.ts` | 2 |
| `app/api/execution/summary/route.ts` | 2 |
| `app/api/longevity/simulator/route.ts` | 2 |
| `app/login/page.tsx` | 1 |
| `lib/notifications/push.ts` | 1 |
| `components/layout/AeonCommandOrb.tsx` | 1 |
| `app/api/stripe/customer-portal/route.ts` | 1 |
| `app/api/stripe/webhook/route.ts` | 1 |
| `lib/labs/latestLabInputs.ts` | 1 |
| `lib/auth/getUserSubscription.ts` | 1 |
| `lib/labs/loadLabTrendsForUser.ts` | 1 |
| `lib/agent/agentPreferenceMemory.ts` | 1 |
| `app/success/page.tsx` | 1 |
| `app/HomePageClient.tsx` | 1 |
| `app/api/care-network/[inviteToken]/route.ts` | 1 |
| `app/optimization/page.tsx` | 1 |
| `app/api/notifications/deliveries/route.ts` | 1 |
| `app/optimization/OptimizationPageClient.tsx` | 1 |
| `app/api/labs/import/route.ts` | 1 |
| `app/api/calendar/google/status/route.ts` | 1 |
| `app/api/agent/preferences/route.ts` | 1 |
| `app/api/life-os/trajectory/route.ts` | 1 |
| `app/api/optimization/protocols/route.ts` | 1 |
| `app/api/wearables/connections/route.ts` | 1 |
| `app/api/clinical/insights/route.ts` | 1 |
| `app/api/wearables/oura/sync/route.ts` | 1 |
| `app/api/physician-share/[shareToken]/route.ts` | 1 |
| `app/api/wearables/whoop/sync/route.ts` | 1 |
| `app/api/digital-twin/export/route.ts` | 1 |

## Target Tables

The long-term schema should add:

| Table | Purpose |
| --- | --- |
| `workspaces` | Billing/account container. Owns plan, subscription status, Stripe customer/subscription IDs, and profile limits. |
| `workspace_members` | Login users who can access a workspace, with roles such as owner/admin/member. |
| `health_profiles` | People being tracked. Belongs to a workspace; has display name, relationship, status, and primary flag. |
| `health_profile_access` | Maps workspace members or users to health profiles, with roles/permissions. |

Existing health data tables should gain `health_profile_id` first, backfilled from each user's primary profile. Existing `user_id` columns should remain temporarily for compatibility, then become `created_by_user_id`, `connected_by_user_id`, or be removed depending on table meaning.

## Current Helper Contract

`lib/health-profiles/activeHealthProfile.ts` now defines the app-level contract routes should migrate toward:

- `ActiveHealthProfileContext`
- `createLegacyActiveHealthProfileContext`
- `getHealthSubjectFilter`
- `ACTIVE_HEALTH_PROFILE_COOKIE`

Right now it intentionally falls back to the current single-user model. That lets us migrate routes one by one without changing behavior. When `health_profiles` exists, this helper should become the only place that resolves the active profile from cookie + workspace membership + RLS-visible access.

## RLS Pattern

Do not keep hand-writing `auth.uid() = user_id` for every future table. The eventual RLS model should use helper functions in a private schema, for example:

```sql
create schema if not exists app_private;

create function app_private.can_access_health_profile(target_health_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.health_profile_access hpa
    join public.workspace_members wm
      on wm.workspace_id = hpa.workspace_id
    where hpa.health_profile_id = target_health_profile_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and hpa.status = 'active'
  );
$$;
```

Keep security-definer helpers out of exposed schemas where possible, and only expose policies that call the helper. Existing policies can stay until the relevant table has `health_profile_id` and backfilled access rows.

## Migration Phases

1. Add workspace/profile tables and RLS helpers.
2. Backfill one workspace and one primary health profile per existing `profiles.user_id`.
3. Move Stripe/customer/subscription ownership from `profiles` to `workspaces`, keeping temporary mirrored reads until all routes are moved.
4. Add `health_profile_id` to health-subject tables and backfill from primary profiles.
5. Move high-risk context loaders first: agent, realtime, digital twin, dashboard, reports, coach pipeline, autopilot.
6. Update RLS policies table by table to call the helper function.
7. Add profile switcher UI and plan-limit enforcement only after storage and RLS are correct.
8. Remove legacy `user_id` health ownership once no queries depend on it.

## What Not To Do

- Do not replace every `user_id` with `health_profile_id` globally.
- Do not attach Stripe subscriptions to health profiles.
- Do not make family accounts Sovereign-only unless the product decision changes; Elite should support smaller households.
- Do not remove current RLS policies until replacement policies are verified.
- Do not use Supabase user metadata for plan/profile authorization.
