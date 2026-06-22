import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import fs from "node:fs";
import path from "node:path";

type QaUser = {
  email: string;
  password: string;
  userId: string;
  workspaceId: string;
  healthProfileId: string;
};

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const canRunSupabaseFlow = Boolean(supabaseUrl && supabaseAnonKey && serviceRoleKey);
const canRunStripeWebhookFlow = Boolean(stripeWebhookSecret);

test.describe("concierge payment hardening", () => {
  test.setTimeout(90_000);

  let admin: SupabaseClient | null = null;
  let qa: QaUser | null = null;

  test.beforeAll(() => {
    if (!canRunSupabaseFlow) return;

    admin = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  });

  test.afterEach(async () => {
    if (admin && qa) {
      await cleanupQaUser(admin, qa.userId);
      qa = null;
    }
  });

  test("blocks non-Sovereign users from concierge checkout", async ({ isMobile, page }) => {
    test.skip(isMobile, "Run the authenticated concierge gate once on desktop only.");
    test.skip(
      !canRunSupabaseFlow,
      "Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
    );

    qa = await seedQaUser(admin!, "core");
    await signIn(page, qa);

    const response = await page.request.post("/api/concierge/onboarding", {
      data: {
        contactEmail: qa.email,
        requestedScope: ["lab_intake", "wearable_setup"],
      },
    });
    const body = await response.json();

    expect(response.status()).toBe(403);
    expect(body).toEqual(
      expect.objectContaining({
        error: "Sovereign Concierge Onboarding requires an active Sovereign plan.",
        locked: true,
      })
    );
  });

  test("rejects unpaid concierge Stripe checkout events", async ({ request }) => {
    test.skip(!canRunStripeWebhookFlow, "Requires STRIPE_WEBHOOK_SECRET.");

    const payload = JSON.stringify({
      api_version: "2026-05-27.dahlia",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          amount_total: 500_000,
          currency: "usd",
          id: `cs_test_unpaid_${Date.now()}`,
          metadata: {
            concierge_request_id: crypto.randomUUID(),
            kind: "sovereign_concierge",
            user_id: crypto.randomUUID(),
          },
          mode: "payment",
          object: "checkout.session",
          payment_status: "unpaid",
        },
      },
      id: `evt_test_unpaid_concierge_${Date.now()}`,
      livemode: false,
      object: "event",
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "checkout.session.completed",
    });
    const stripe = new Stripe("sk_test_unused", { apiVersion: "2026-05-27.dahlia" });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: stripeWebhookSecret!,
    });

    const response = await request.post("/api/stripe/webhook", {
      data: payload,
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
    });

    expect(response.status()).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Webhook handler failed" });
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

async function signIn(page: Page, qa: QaUser) {
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
}

async function settle(page: Page) {
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

async function seedQaUser(admin: SupabaseClient, plan: "core" | "sovereign"): Promise<QaUser> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `qa+concierge-${plan}-${suffix}@aeonvera.test`;
  const password = `Aeonvera-QA-${suffix}!`;

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: {
      display_name: "QA Concierge",
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
      display_name: "QA Concierge",
      full_name: "QA Concierge",
      onboarding_completed: true,
      plan,
      subscription_status: "active",
      primary_goal: "Validate concierge payment gates",
    });

    const workspace = await insertReturningOne(admin, "workspaces", {
      owner_user_id: userId,
      name: "QA concierge workspace",
      plan,
      subscription_status: "active",
      max_health_profiles: plan === "sovereign" ? 10 : 1,
      status: "active",
    });
    const workspaceId = workspace.id;

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
      display_name: "QA Concierge Primary",
      relationship: "self",
      is_primary: true,
      status: "active",
    });

    await insertOrThrow(admin, "health_profile_access", {
      workspace_id: workspaceId,
      health_profile_id: healthProfile.id,
      user_id: userId,
      role: "owner",
      status: "active",
    });

    return {
      email,
      healthProfileId: healthProfile.id,
      password,
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
    ["concierge_onboarding_requests", "user_id"],
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
