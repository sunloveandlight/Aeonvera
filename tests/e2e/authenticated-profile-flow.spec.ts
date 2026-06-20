import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

type QaContext = {
  email: string;
  inviteeEmail: string;
  inviteePassword: string;
  inviteeUserId: string;
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
  test.setTimeout(150_000);

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
      await cleanupQaUser(admin, qa.inviteeUserId);
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
    await settle(page);
    const emailInput = page.getByRole("textbox", { name: "Email" });
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    await emailInput.fill(qa.email);
    await passwordInput.fill(qa.password);
    await expect(emailInput).toHaveValue(qa.email);
    await expect(passwordInput).toHaveValue(qa.password);

    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 45_000, waitUntil: "domcontentloaded" }),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);
    await settle(page);
    await expect(page.locator("body")).not.toContainText(
      /Hydration failed|Runtime Error|Application error/i
    );

    const householdProfileName = `QA Family ${Date.now()}`;
    const childProfileName = `QA Child ${Date.now()}`;
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.getByLabel("New profile name").waitFor({ timeout: 30_000 });
    await expect(page.getByText(/1 of 10 profiles used/i)).toBeVisible();
    await expect(page.getByText(/9 remaining/i)).toBeVisible();

    await page.goto("/ops", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Workspace diagnostics." })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Sovereign").first()).toBeVisible();
    await expect(page.getByText("Core").last()).toBeVisible();
    await expect(page.getByText("Elite").last()).toBeVisible();
    await expect(page.getByText("Sovereign").last()).toBeVisible();

    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.getByLabel("New profile name").waitFor({ timeout: 30_000 });

    await createProfileViaUi(page, householdProfileName, "family");
    await expect(page.getByText("Profile created.")).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: new RegExp(householdProfileName) }).first()
    ).toBeVisible();
    await expect(page.getByText(/2 of 10 profiles used/i)).toBeVisible();
    await expect(page.getByText(/8 remaining/i)).toBeVisible();

    await createProfileViaUi(page, childProfileName, "child");
    await expect(page.getByRole("button", { name: new RegExp(childProfileName) })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/3 of 10 profiles used/i)).toBeVisible();
    await expect(page.getByText(/7 remaining/i)).toBeVisible();

    const workspaceAccessPanel = page.locator("section.executive-panel").filter({ hasText: "Workspace" });
    await expect(
      workspaceAccessPanel.getByRole("button", { name: new RegExp(childProfileName) })
    ).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });

    await page.getByLabel("Member email").fill(qa.inviteeEmail);
    await page.getByLabel("Workspace role").selectOption("viewer");
    await page.getByLabel("Profile role").selectOption("viewer");
    await page.getByRole("button", { name: "Grant access" }).click();

    await expect(page.getByText("Access granted.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(qa.inviteeEmail)).toBeVisible();
    await expect(page.getByText(householdProfileName).last()).toBeVisible();
    await expect(page.getByText(childProfileName).last()).toBeVisible();

    const membersResponse = await page.request.get("/api/workspace-members");
    await expectOk(membersResponse, "/api/workspace-members");
    const membersPayload = await membersResponse.json();
    expect(membersPayload.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: qa.inviteeEmail,
          profileAccess: expect.arrayContaining([
            expect.objectContaining({ healthProfileId: qa.primaryHealthProfileId, role: "viewer" }),
          ]),
          role: "viewer",
        }),
      ])
    );

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
        expect.objectContaining({ displayName: childProfileName, relationship: "child" }),
      ])
    );
    const householdProfile = healthProfiles.profiles.find(
      (profile: { displayName?: string }) => profile.displayName === householdProfileName
    );
    const childProfile = healthProfiles.profiles.find(
      (profile: { displayName?: string }) => profile.displayName === childProfileName
    );
    expect(householdProfile?.id).toBeTruthy();
    expect(childProfile?.id).toBeTruthy();
    expect(healthProfiles.profileLimit).toEqual(
      expect.objectContaining({ maxHealthProfiles: 10 })
    );
    expect(healthProfiles.remainingProfiles).toBe(7);

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
    ]) {
      await expectOk(await page.request.get(pathName), pathName);
    }

    const { error: workspaceDowngradeError } = await admin
      .from("workspaces")
      .update({
        max_health_profiles: 1,
        plan: "core",
        subscription_status: "active",
      })
      .eq("id", qa.workspaceId);
    expect(workspaceDowngradeError).toBeNull();

    const { error: profileDowngradeError } = await admin
      .from("profiles")
      .update({
        plan: "core",
        subscription_status: "active",
      })
      .eq("user_id", qa.userId);
    expect(profileDowngradeError).toBeNull();

    await expectOk(
      await page.request.post("/api/health-profiles/active", {
        data: { healthProfileId: childProfile.id },
      }),
      "/api/health-profiles/active frozen profile"
    );

    const downgradedProfilesResponse = await page.request.get("/api/health-profiles");
    await expectOk(downgradedProfilesResponse, "/api/health-profiles downgraded");
    const downgradedProfiles = await downgradedProfilesResponse.json();
    expect(downgradedProfiles.profileLimit).toEqual(
      expect.objectContaining({ maxHealthProfiles: 1 })
    );
    expect(downgradedProfiles.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: qa.primaryHealthProfileId, isFrozen: false }),
        expect.objectContaining({ id: childProfile.id, isFrozen: true }),
      ])
    );

    const frozenProfileUpdate = await page.request.patch("/api/health-profiles", {
      data: {
        displayName: `${childProfileName} edited`,
        id: childProfile.id,
      },
    });
    expect(frozenProfileUpdate.status()).toBe(423);

    const frozenPreferencesUpdate = await page.request.post("/api/notifications/preferences", {
      data: {
        email_enabled: false,
        push_enabled: false,
        quiet_hours_start: "23:00",
        quiet_hours_end: "06:00",
        timezone: "UTC",
      },
    });
    expect(frozenPreferencesUpdate.status()).toBe(423);

    await expectOk(
      await page.request.post("/api/health-profiles/active", {
        data: { healthProfileId: qa.primaryHealthProfileId },
      }),
      "/api/health-profiles/active primary after downgrade"
    );

    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/$/, { timeout: 30_000 }).catch(() => {});

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("textbox", { name: "Email" }).fill(qa.inviteeEmail);
    await page.getByRole("textbox", { name: "Password" }).fill(qa.inviteePassword);
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 45_000, waitUntil: "domcontentloaded" }),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);
    await settle(page);

    const inviteeProfilesResponse = await page.request.get("/api/health-profiles");
    await expectOk(inviteeProfilesResponse, "/api/health-profiles as invitee");
    const inviteeProfiles = await inviteeProfilesResponse.json();
    expect(inviteeProfiles.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: qa.primaryHealthProfileId, role: "viewer" }),
        expect.objectContaining({ displayName: householdProfileName, role: "viewer" }),
        expect.objectContaining({ displayName: childProfileName, role: "viewer" }),
      ])
    );
    expect(inviteeProfiles.profiles).toHaveLength(3);

    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/3 of 1 profiles used/i)).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: new RegExp(householdProfileName) }).first()
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Grant access" })).toBeDisabled();

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
    if (text.includes("TypeError: Failed to fetch") && text.includes("supabase_auth-js")) return;
    if (text.includes("Failed to load resource") && text.includes("403")) return;
    if (text.includes("Failed to load resource") && text.includes("404")) return;
    if (text.includes("Failed to load resource") && text.includes("ERR_CONNECTION_CLOSED")) return;
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

async function expectOk(
  response: Pick<APIResponse, "ok" | "status" | "text">,
  label: string
) {
  const body = response.ok() ? "" : await response.text().catch(() => "");
  expect(response.ok(), `${label} returned ${response.status()} ${body}`).toBe(true);
}

async function createProfileViaUi(page: Page, displayName: string, relationship: string) {
  await page.getByLabel("New profile name").fill(displayName);
  await page.getByLabel("New profile relationship").selectOption(relationship);

  const [response] = await Promise.all([
    page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return url.pathname === "/api/health-profiles" && candidate.request().method() === "POST";
    }),
    page.locator("button").filter({ hasText: /^Add$/ }).last().click(),
  ]);

  await expectOk(response, "/api/health-profiles create");
}

async function seedQaUser(admin: SupabaseClient): Promise<QaContext> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `qa+profile-${suffix}@aeonvera.test`;
  const inviteeEmail = `qa+profile-invitee-${suffix}@aeonvera.test`;
  const password = `Aeonvera-QA-${suffix}!`;
  const inviteePassword = `Aeonvera-Invitee-${suffix}!`;

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
  let inviteeUserId = "";

  try {
    const { data: inviteeData, error: inviteeError } = await admin.auth.admin.createUser({
      email: inviteeEmail,
      email_confirm: true,
      password: inviteePassword,
      user_metadata: {
        display_name: "QA Profile Invitee",
      },
    });

    if (inviteeError || !inviteeData.user) {
      throw new Error(inviteeError?.message || "Could not create QA invitee user.");
    }

    inviteeUserId = inviteeData.user.id;

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

    await insertOrThrow(admin, "profiles", {
      user_id: inviteeUserId,
      email: inviteeEmail,
      display_name: "QA Profile Invitee",
      full_name: "QA Profile Invitee",
      biological_age: 34.2,
      onboarding_completed: true,
      plan: "core",
      subscription_status: "active",
      primary_goal: "Validate shared profile access",
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
      inviteeEmail,
      inviteePassword,
      inviteeUserId,
      password,
      primaryHealthProfileId,
      userId,
      workspaceId,
    };
  } catch (error) {
    await cleanupQaUser(admin, userId);
    if (inviteeUserId) await cleanupQaUser(admin, inviteeUserId);
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
