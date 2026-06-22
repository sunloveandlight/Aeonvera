import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getRequestedHealthProfileId,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type ConciergeRequestRow = {
  id: string;
  status: string;
  package_tier: string;
  requested_scope: string[];
  created_at: string;
  updated_at: string;
};

const DEFAULT_SCOPE = [
  "lab_intake",
  "wearable_setup",
  "clinician_export",
  "first_30_day_protocol",
];

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("concierge_onboarding_requests")
      .select("id, status, package_tier, requested_scope, created_at, updated_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      request: data ? serializeConciergeRequest(data as ConciergeRequestRow) : null,
    });
  } catch (error) {
    console.error("Could not load concierge request:", error);
    return NextResponse.json({ error: "Could not load concierge request." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "concierge-onboarding-request", 8, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: auth.user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });
    const workspaceId = await getWorkspaceId(admin, auth.user.id);
    const contactEmail = sanitizeEmail(body.contactEmail) || auth.user.email || null;
    const requestedScope = sanitizeScope(body.requestedScope);

    const { data, error } = await admin
      .from("concierge_onboarding_requests")
      .insert({
        contact_email: contactEmail,
        health_profile_id: healthProfileContext.healthProfileId,
        notes: sanitizeNotes(body.notes),
        requested_scope: requestedScope.length ? requestedScope : DEFAULT_SCOPE,
        source: "plan_page",
        user_id: auth.user.id,
        workspace_id: workspaceId,
      })
      .select("id, status, package_tier, requested_scope, created_at, updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      request: serializeConciergeRequest(data as ConciergeRequestRow),
    });
  } catch (error) {
    console.error("Could not create concierge request:", error);
    return NextResponse.json({ error: "Could not create concierge request." }, { status: 500 });
  }
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
    };
  }

  return { response: null, user };
}

async function getWorkspaceId(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const { data } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return typeof data?.workspace_id === "string" ? data.workspace_id : null;
}

function sanitizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function sanitizeNotes(value: unknown) {
  if (typeof value !== "string") return null;
  const notes = value.trim();
  return notes ? notes.slice(0, 1000) : null;
}

function sanitizeScope(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => DEFAULT_SCOPE.includes(item));
}

function serializeConciergeRequest(row: ConciergeRequestRow) {
  return {
    createdAt: row.created_at,
    id: row.id,
    packageTier: row.package_tier,
    requestedScope: row.requested_scope,
    status: row.status,
    updatedAt: row.updated_at,
  };
}
