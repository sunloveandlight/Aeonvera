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
const semanticMemorySource = readFileSync("lib/memory/semanticMemory.ts", "utf8");
const semanticMemoryRouteSource = readFileSync("app/api/memory/semantic/route.ts", "utf8");
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

test("sensitive treatment/contract professional access requires documented basis", () => {
  assert.match(professionalWorkflowSource, /requiresDocumentedProfessionalBasis/);
  assert.match(professionalConsentRouteSource, /requiresDocumentedProfessionalBasis/);
  assert.match(
    professionalConsentRouteSource,
    /Sensitive treatment or contract access requires a source document URL or hash/
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
