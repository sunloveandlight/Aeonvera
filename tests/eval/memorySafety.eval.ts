// Memory/PHI safety invariants.
// These are intentionally small structural guards for high-risk boundaries:
// viewer-role profile members may read, but must not mutate profile memory or
// clinical follow-up state through the agent surfaces.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const agentSource = readFileSync("lib/agent/personalHealthAgent.ts", "utf8");
const automaticMemorySource = readFileSync("lib/memory/automaticMemory.ts", "utf8");
const biologicalContextSource = readFileSync("lib/health-profiles/biologicalContext.ts", "utf8");
const commandRouterSource = readFileSync("lib/agent/agentCommandRouter.ts", "utf8");
const followUpSource = readFileSync("lib/clinical/clinicalFollowUpResponses.ts", "utf8");
const professionalConsentRouteSource = readFileSync("app/api/professional/consents/route.ts", "utf8");
const professionalWorkflowSource = readFileSync("lib/professional/workflow.ts", "utf8");
const dailyCoachCronSource = readFileSync("app/api/cron/daily-coach/route.ts", "utf8");
const dailyPlanSource = readFileSync("app/api/autopilot/daily-plan/route.ts", "utf8");
const semanticMemorySource = readFileSync("lib/memory/semanticMemory.ts", "utf8");
const semanticMemoryRouteSource = readFileSync("app/api/memory/semantic/route.ts", "utf8");
const wearableOAuthSource = readFileSync("lib/wearables/oauth.ts", "utf8");
const ouraSyncSource = readFileSync("app/api/wearables/oura/sync/route.ts", "utf8");
const whoopSyncSource = readFileSync("app/api/wearables/whoop/sync/route.ts", "utf8");
const proxySource = readFileSync("proxy.ts", "utf8");
const activeHealthProfileSource = readFileSync("lib/health-profiles/activeHealthProfile.ts", "utf8");
const physicianExportBundleSource = readFileSync("lib/digital-twin/physicianExportBundle.ts", "utf8");
const profileWriteRoutes = [
  "app/api/agent/activity/route.ts",
  "app/api/autopilot/daily-plan/route.ts",
  "app/api/autopilot/preferences/route.ts",
  "app/api/calendar/google/events/route.ts",
  "app/api/concierge/onboarding/route.ts",
  "app/api/labs/import/route.ts",
  "app/api/longevity/biological-age/route.ts",
  "app/api/longevity/future-self/scenarios/route.ts",
  "app/api/longevity/report/route.ts",
  "app/api/notifications/preferences/route.ts",
  "app/api/notifications/test-coach/route.ts",
  "app/api/optimization/protocol/route.ts",
  "app/api/wearables/apple/import/route.ts",
  "app/api/wearables/oura/sync/route.ts",
  "app/api/wearables/whoop/sync/route.ts",
];
const memoryMigration = readFileSync(
  "supabase/migrations/20260707144240_typed_memory_biological_context.sql",
  "utf8"
);
const phiContractMigration = readFileSync(
  "supabase/migrations/20260708200414_profile_scoped_wearables_sensitive_phi_contract.sql",
  "utf8"
);
const professionalRosterIsolationMigration = readFileSync(
  "supabase/migrations/20260708204925_isolate_professional_roster_profiles_from_consumer_access.sql",
  "utf8"
);

function functionBody(source: string, name: string) {
  const start = source.indexOf(`function ${name}`) >= 0
    ? source.indexOf(`function ${name}`)
    : source.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const nextFunction = source.indexOf("\nfunction ", start + 1);
  const nextAsyncFunction = source.indexOf("\nasync function ", start + 1);
  const candidates = [nextFunction, nextAsyncFunction].filter((index) => index > start);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

test("agent clinical insight storage requires profile write access", () => {
  const body = functionBody(agentSource, "storeClinicalInsight");
  assert.match(body, /requireProfileWriteAccess\(healthProfileContext\)/);
  assert.match(body, /catch\s*\{\s*return;\s*\}/s);
});

test("clinical follow-up answers require profile write access before mutation", () => {
  const body = functionBody(followUpSource, "recordClinicalFollowUpAnswer");
  assert.match(body, /requireProfileWriteAccess\(healthProfileContext\)/);
  assert.ok(
    body.indexOf("requireProfileWriteAccess(healthProfileContext)") <
      body.indexOf('.from("clinical_insights")'),
    "write access should be checked before clinical insight lookup/update"
  );
});

test("agent command preference learning requires profile write access", () => {
  const body = functionBody(commandRouterSource, "savePreferences");
  assert.match(body, /requireProfileWriteAccess\(healthProfileContext\)/);
  assert.ok(
    body.indexOf("requireProfileWriteAccess(healthProfileContext)") <
      body.indexOf('.from("agent_preferences")'),
    "write access should be checked before learned preferences are saved"
  );
});

test("automatic memory heuristic fallback runs through third-party subject filter", () => {
  const body = functionBody(automaticMemorySource, "extractAutomaticMemoryCandidates");
  assert.match(body, /safeAutomaticMemoryCandidates\(extractHeuristicCandidates\(question\)\)/);
  assert.ok(
    body.indexOf("safeAutomaticMemoryCandidates(extractHeuristicCandidates(question))") <
      body.indexOf("if (!openai) return fallback"),
    "fallback memories should be filtered before the no-OpenAI path returns"
  );
});

test("sensitive professional access requires documented basis unless granted in-app by member", () => {
  assert.match(professionalWorkflowSource, /requiresDocumentedProfessionalBasis/);
  assert.match(professionalConsentRouteSource, /requiresDocumentedProfessionalBasis/);
  assert.match(professionalWorkflowSource, /legalBasis !== "patient_consent" && legalBasis !== "guardian_consent"/);
  assert.match(
    professionalConsentRouteSource,
    /Sensitive professional access requires a source document URL or hash unless it is granted in-app by the member/
  );
  assert.doesNotMatch(phiContractMigration, /legal_basis in \('treatment', 'contract'\)/);
  assert.match(
    phiContractMigration,
    /legal_basis in \('patient_consent', 'guardian_consent'\)\s+and capture_method = 'in_app'\s+and granted_by_user_id is not null/s
  );
});

test("biological context rejects contradictory states and marks notes untrusted", () => {
  assert.match(biologicalContextSource, /class BiologicalContextValidationError/);
  assert.match(biologicalContextSource, /Pregnancy context conflicts with the selected biological sex/);
  assert.match(biologicalContextSource, /User-supplied notes \(untrusted evidence\)/);
});

test("daily coach cron avoids per-profile frozen checks and bounds source queries", () => {
  assert.doesNotMatch(dailyCoachCronSource, /isHealthProfileFrozenById/);
  assert.match(dailyCoachCronSource, /loadProfileEntitlementMap/);
  assert.match(dailyCoachCronSource, /DAILY_COACH_SOURCE_LIMIT/);
});

test("daily plan loads agent preferences in active health-profile scope", () => {
  assert.match(
    dailyPlanSource,
    /getAgentPreferenceMemory\(\{\s*healthProfileContext,\s*supabase: admin,\s*userId: user\.id\s*\}\)/
  );
});

test("wearable OAuth credentials and sync updates are profile-scoped", () => {
  assert.match(wearableOAuthSource, /onConflict: "user_id,health_profile_id,provider"/);
  assert.match(wearableOAuthSource, /health_profile_id: null/);
  assert.match(wearableOAuthSource, /query\.eq\("health_profile_id", healthProfileContext\.healthProfileId\)/);
  assert.match(wearableOAuthSource, /query\.is\("health_profile_id", null\)/);
  assert.match(ouraSyncSource, /getValidWearableAccessToken\(\{\s*healthProfileContext,/s);
  assert.match(whoopSyncSource, /getValidWearableAccessToken\(\{\s*healthProfileContext,/s);
  assert.match(ouraSyncSource, /connectionUpdate\.eq\("health_profile_id", healthProfileContext\.healthProfileId\)/);
  assert.match(whoopSyncSource, /connectionUpdate\.eq\("health_profile_id", healthProfileContext\.healthProfileId\)/);
  assert.match(
    phiContractMigration,
    /create unique index wearable_connections_user_profile_provider_unique\s+on public\.wearable_connections \(user_id, health_profile_id, provider\)\s+nulls not distinct;/s
  );
});

test("professional workspace pages are protected while invite links stay public", () => {
  assert.match(proxySource, /const isProfessionalInvitePage = pathname\.startsWith\("\/professional\/invite\/"\)/);
  assert.match(proxySource, /const isProfessionalLandingPage = pathname === "\/professional"/);
  assert.match(proxySource, /pathname\.startsWith\("\/professional"\)/);
  assert.match(proxySource, /"\/professional\/:path\*"/);
  assert.ok(
    proxySource.indexOf("if (isProfessionalInvitePage || isProfessionalLandingPage || isResourcePage)") <
      proxySource.indexOf('pathname.startsWith("/professional")'),
    "professional invite and landing bypass should run before protected professional route matching"
  );
});

test("profile-scoped write routes use the shared write-access guard", () => {
  for (const route of profileWriteRoutes) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /requireProfileWriteAccess/, `${route} should require write access`);
    assert.match(
      source,
      /healthProfileWriteAccessDeniedResponse/,
      `${route} should return the shared viewer-denied response`
    );
  }
});

test("profile-scoped semantic-memory vector RPC is service-role only", () => {
  assert.match(
    memoryMigration,
    /revoke execute on function public\.match_semantic_memories_for_health_profile\(uuid, extensions\.vector\(1536\), int, float\)\s+from public, anon, authenticated;/s
  );
  assert.match(
    memoryMigration,
    /grant execute on function public\.match_semantic_memories_for_health_profile\(uuid, extensions\.vector\(1536\), int, float\)\s+to service_role;/s
  );
});

test("recent/listed semantic memories exclude expired rows", () => {
  const recentBody = functionBody(semanticMemorySource, "listRecentSemanticMemories");
  assert.match(recentBody, /expires_at\.is\.null,expires_at\.gt\./);
  assert.match(semanticMemoryRouteSource, /expires_at\.is\.null,expires_at\.gt\./);
});

test("consumer active profile resolution only accepts personal workspace profiles", () => {
  const body = functionBody(activeHealthProfileSource, "resolveActiveHealthProfileContext");
  assert.match(body, /workspaces!inner\(workspace_type\)/);
  assert.match(body, /\.eq\("workspaces\.workspace_type", "personal"\)/);
});

test("professional roster profiles do not create consumer health-profile access rows", () => {
  const createBody = functionBody(professionalWorkflowSource, "createRosterProfile");
  const acceptBody = functionBody(professionalWorkflowSource, "acceptProfessionalInvitation");
  assert.doesNotMatch(createBody, /\.from\("health_profile_access"\)/);
  assert.doesNotMatch(acceptBody, /\.from\("health_profile_access"\)/);
});

test("database rejects organization roster profiles as consumer active profiles", () => {
  assert.match(professionalRosterIsolationMigration, /delete from public\.health_profile_access/);
  assert.match(professionalRosterIsolationMigration, /workspace\.workspace_type = 'organization'/);
  assert.match(professionalRosterIsolationMigration, /reject_organization_health_profile_access/);
  assert.match(
    professionalRosterIsolationMigration,
    /before insert or update of workspace_id, health_profile_id, user_id, status\s+on public\.health_profile_access/s
  );
  assert.match(
    professionalRosterIsolationMigration,
    /join public\.workspaces workspace\s+on workspace\.id = profile\.workspace_id/s
  );
});

test("physician export profile metadata follows the selected health profile", () => {
  assert.match(physicianExportBundleSource, /\.from\("health_profiles"\)/);
  assert.match(physicianExportBundleSource, /\.eq\("id", healthProfileContext\.healthProfileId\)/);
  assert.match(physicianExportBundleSource, /withProfileBiologicalAge/);
  assert.match(physicianExportBundleSource, /biologicalAgeHistory\[0\]\?\.biological_age/);
});

test("wearable cron token lookup is scoped to the connection's own profile", () => {
  const cron = readFileSync("app/api/cron/wearable-sync/route.ts", "utf8");
  assert.match(cron, /getValidWearableAccessToken\(\{\s*healthProfileContext,/s);
  assert.ok(
    cron.indexOf("resolveConnectionProfileContext(connection)") <
      cron.indexOf("getValidWearableAccessToken({"),
    "the connection's own profile must be resolved before the token lookup"
  );
  assert.match(cron, /syncedUpdate\.eq\("health_profile_id", connection\.health_profile_id\)/);
});

test("automatic memory drops clinical facts that reference another person", () => {
  const body = functionBody(automaticMemorySource, "isSafeSubjectMemory");
  assert.match(body, /candidate\.sensitivity === "clinical"/);
  assert.match(body, /relationNoun/);
  assert.match(body, /thirdPersonPronoun/);
});

test("documented-consent constraint covers all non-member-granted legal bases (incl. 'other')", () => {
  const mig = readFileSync(
    "supabase/migrations/20260708210000_documented_sensitive_consent_all_non_consent_bases.sql",
    "utf8"
  );
  assert.match(mig, /legal_basis not in \('patient_consent', 'guardian_consent'\)/);
  assert.match(mig, /labs_sensitive/);
  assert.match(mig, /mental_health/);
});
