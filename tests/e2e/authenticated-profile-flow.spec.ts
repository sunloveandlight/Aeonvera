import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

type QaContext = {
  email: string;
  password: string;
  userId: string;
  workspaceId: string;
  primaryHealthProfileId: string;
};

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRunAuthenticatedFlow = Boolean(supabaseUrl && supabaseAnonKey && serviceRoleKey);

test.describe("authenticated profile-scoped flow", () => {
  test.setTimeout(90_000);

  test.skip(
    !canRunAuthenticatedFlow,
    "Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
  );

  let admin: SupabaseClient;
  let qa: QaContext | null = null;

  test.beforeAll(() => {
    admin = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  });

  test.afterEach(async () => {
    if (qa) {
      await cleanupQaUser(admin, qa.userId);
      qa = null;
    }
  });

  test("creates a secondary health profile and uses profile-scoped APIs", async ({
    isMobile,
    page,
  }) => {
    test.skip(isMobile, "Run the remote authenticated QA flow once on desktop only.");

    qa = await seedQaUser(admin);
    const problems = collectRuntimeProblems(page);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("textbox", { name: "Email" }).fill(qa.email);
    await page.getByRole("textbox", { name: "Password" }).fill(qa.password);

    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 45_000 }),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);
    await settle(page);
    await expect(page.locator("body")).not.toContainText(
      /Hydration failed|Runtime Error|Application error/i
    );

    const householdProfileName = `QA Family ${Date.now()}`;
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.getByLabel("New profile name").waitFor({ timeout: 30_000 });
    await page.getByLabel("New profile name").fill(householdProfileName);
    await page.getByLabel("New profile relationship").selectOption("family");
    await page.locator("button").filter({ hasText: /^Add$/ }).last().click();

    await expect(page.getByText("Profile created.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(householdProfileName)).toBeVisible();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await settle(page);
    await expect(page.getByLabel("Active health profile").first()).toBeVisible({
      timeout: 30_000,
    });

    await expectOk(
      await page.request.post("/api/health-profiles/active", {
        data: { healthProfileId: qa.primaryHealthProfileId },
      }),
      "/api/health-profiles/active"
    );

    const healthProfilesResponse = await page.request.get("/api/health-profiles");
    await expectOk(healthProfilesResponse, "/api/health-profiles");
    const healthProfiles = await healthProfilesResponse.json();
    expect(healthProfiles.activeProfileId).toBe(qa.primaryHealthProfileId);
    expect(healthProfiles.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: qa.primaryHealthProfileId, isPrimary: true }),
        expect.objectContaining({ displayName: householdProfileName, relationship: "family" }),
      ])
    );

    const priorityResponse = await page.request.post("/api/life-os/priorities", {
      data: {
        desiredOutcome: "Keep QA profile-scoped Life OS data isolated.",
        domain: "sleep",
        horizonDays: 90,
        nextAction: "Review the authenticated profile smoke test.",
        priority: 4,
        title: "Protect profile-scoped QA flow",
      },
    });
    await expectOk(priorityResponse, "/api/life-os/priorities");
    const priorityPayload = await priorityResponse.json();
    expect(priorityPayload.priority).toEqual(
      expect.objectContaining({
        domain: "sleep",
        title: "Protect profile-scoped QA flow",
      })
    );

    const preferencesResponse = await page.request.post("/api/notifications/preferences", {
      data: {
        email_enabled: true,
        push_enabled: false,
        quiet_hours_start: "22:00",
        quiet_hours_end: "07:00",
        timezone: "UTC",
      },
    });
    await expectOk(preferencesResponse, "/api/notifications/preferences");
    const preferencesPayload = await preferencesResponse.json();
    expect(preferencesPayload.preferences).toEqual(
      expect.objectContaining({
        email_enabled: true,
        push_enabled: false,
        health_profile_id: qa.primaryHealthProfileId,
      })
    );

    for (const pathName of [
      "/api/notifications/deliveries",
      "/api/life-os/priorities",
      "/api/life-os/trajectory",
      "/api/coach/memory",
      "/api/coach/daily-brief",
    ]) {
      await expectOk(await page.request.get(pathName), pathName);
    }

    expect(problems).toEqual([]);
  });
});

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .replace(/\\n/g, "\n");
  }
}

function collectRuntimeProblems(page: Page) {
  const problems: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("/_next/webpack-hmr")) return;
    problems.push(`console: ${text}`);
  });

  page.on("pageerror", (error) => {
    problems.push(`pageerror: ${error.message}`);
  });

  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/") && response.status() >= 500) {
      problems.push(`api ${response.status()}: ${url.pathname}`);
    }
  });

  return problems;
}

async function settle(page: Page) {
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

async function expectOk(response: APIResponse, label: string) {
  const body = response.ok() ? "" : await response.text().catch(() => "");
  expect(response.ok(), `${label} returned ${response.status()} ${body}`).toBe(true);
}

async function seedQaUser(admin: SupabaseClient): Promise<QaContext> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `qa+profile-${suffix}@aeonvera.test`;
  const password = `Aeonvera-QA-${suffix}!`;

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: {
      display_name: "QA Profile Owner",
    },
  });

  if (userError || !userData.user) {
    throw new Error(userError?.message || "Could not create QA auth user.");
  }

  const userId = userData.user.id;

  try {
    await insertOrThrow(admin, "profiles", {
      user_id: userId,
      email,
      display_name: "QA Profile Owner",
      full_name: "QA Profile Owner",
      biological_age: 36.8,
      onboarding_completed: true,
      plan: "sovereign",
      subscription_status: "active",
      primary_goal: "Validate profile-scoped account flow",
    });

    const workspace = await insertReturningOne(admin, "workspaces", {
      owner_user_id: userId,
      name: "QA workspace",
      plan: "sovereign",
      subscription_status: "active",
      max_health_profiles: 10,
      status: "active",
    });
    const workspaceId = workspace.id as string;

    await insertOrThrow(admin, "workspace_members", {
      workspace_id: workspaceId,
      user_id: userId,
      role: "owner",
      status: "active",
    });

    const healthProfile = await insertReturningOne(admin, "health_profiles", {
      workspace_id: workspaceId,
      legacy_user_id: userId,
      created_by_user_id: userId,
      display_name: "QA Primary",
      relationship: "self",
      is_primary: true,
      status: "active",
    });
    const primaryHealthProfileId = healthProfile.id as string;

    await insertOrThrow(admin, "health_profile_access", {
      workspace_id: workspaceId,
      health_profile_id: primaryHealthProfileId,
      user_id: userId,
      role: "owner",
      status: "active",
    });

    await insertOrThrow(admin, "longevity_assessments", {
      user_id: userId,
      health_profile_id: primaryHealthProfileId,
      age: "37",
      sex: "female",
      height_cm: "170",
      weight_kg: "67",
      sleep_hours: "7.5",
      sleep_quality: "good",
      exercise_days: "4",
      strength_training: "3",
      diet_type: "Mediterranean",
      alcohol_use: "rare",
      smoking: "never",
      stress_level: "moderate",
      primary_goal: "healthy longevity",
      resting_hr: "62",
      hrv: "55",
      fasting_glucose: "88",
      recovery_quality: "good",
    });

    await insertOrThrow(admin, "health_states", {
      user_id: userId,
      health_profile_id: primaryHealthProfileId,
      baseline: {
        daily_steps: 8200,
        fasting_glucose: 88,
        heart_rate_variability: 55,
        resting_heart_rate: 62,
        sleep_hours: 7.5,
      },
      trends: {
        fasting_glucose: { changePercent: 0, direction: "stable" },
        recovery_score: { changePercent: 4, direction: "up" },
        sleep_hours: { changePercent: 2, direction: "up" },
      },
      risk_scores: {
        cardiovascular: 16,
        metabolic: 22,
        recovery: 18,
      },
      insights: ["Synthetic QA baseline loaded for profile isolation testing."],
      last_processed_at: new Date().toISOString(),
    });

    return {
      email,
      password,
      primaryHealthProfileId,
      userId,
      workspaceId,
    };
  } catch (error) {
    await cleanupQaUser(admin, userId);
    throw error;
  }
}

async function insertOrThrow(
  admin: SupabaseClient,
  table: string,
  payload: Record<string, unknown>
) {
  const { error } = await admin.from(table).insert(payload);
  if (error) throw new Error(`${table} insert failed: ${error.message}`);
}

async function insertReturningOne(
  admin: SupabaseClient,
  table: string,
  payload: Record<string, unknown>
) {
  const { data, error } = await admin.from(table).insert(payload).select("id").single();
  if (error || !data) {
    throw new Error(`${table} insert failed: ${error?.message || "No row returned."}`);
  }
  return data as { id: string };
}

async function cleanupQaUser(admin: SupabaseClient, userId: string) {
  const deletes: Array<[string, string]> = [
    ["life_os_priorities", "user_id"],
    ["notification_preferences", "user_id"],
    ["health_states", "user_id"],
    ["longevity_assessments", "user_id"],
    ["health_profile_access", "user_id"],
    ["health_profiles", "created_by_user_id"],
    ["workspace_members", "user_id"],
    ["workspaces", "owner_user_id"],
    ["profiles", "user_id"],
  ];

  for (const [table, column] of deletes) {
    await admin.from(table).delete().eq(column, userId);
  }

  await admin.auth.admin.deleteUser(userId);
}
