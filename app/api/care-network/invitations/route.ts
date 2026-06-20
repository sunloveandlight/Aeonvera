import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess, type Plan, type SubscriptionStatus } from "@/lib/auth/permissions";
import {
  DEFAULT_PHYSICIAN_EXPORT_SECTIONS,
} from "@/lib/digital-twin/physicianExportBundle";
import {
  permissionsForCareRole,
  sanitizeCareRole,
  type CareNetworkRole,
} from "@/lib/care-network/rolePermissions";
import {
  createShareAccessCode,
  hashShareAccessCode,
} from "@/lib/security/shareAccess";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type CareNetworkRow = {
  accepted_at?: string | null;
  access_count?: number;
  created_at?: string;
  expires_at?: string;
  id: string;
  invite_token: string;
  last_accessed_at?: string | null;
  member_email?: string;
  member_name?: string | null;
  permissions?: string[];
  revoked_at?: string | null;
  role?: CareNetworkRole;
  status?: string;
};

type RoleRecommendation = {
  detail: string;
  priority: "high" | "medium" | "low";
  reason: string;
  role: CareNetworkRole;
  title: string;
};

const SELECT_FIELDS =
  "id,invite_token,member_email,member_name,role,status,permissions,expires_at,accepted_at,revoked_at,access_count,last_accessed_at,created_at,access_code_hash";

export async function GET() {
  try {
    const auth = await requireNetworkAccess();
    if (auth.response) return auth.response;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("care_network_memberships")
      .select(SELECT_FIELDS)
      .eq("owner_user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(24);

    if (error) {
      if (isMissingNetworkTable(error)) {
        return NextResponse.json({
          invitations: [],
          migrationRequired: true,
          message:
            "Apply supabase/migrations/20260613130000_care_network_memberships.sql to enable care network invitations.",
        });
      }
      throw error;
    }

    const recommendations = await buildRoleRecommendations(admin, auth.userId);

    return NextResponse.json({
      invitations: mapInvitations(data || []),
      recommendations,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load care network invitations.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "care-network-invitation", 20, 60_000);
    if (limited) return limited;

    const auth = await requireNetworkAccess();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const role = sanitizeCareRole(body?.role);
    const memberEmail = sanitizeEmail(body?.memberEmail);

    if (!memberEmail) {
      return NextResponse.json({ error: "Enter a valid member email." }, { status: 400 });
    }

    const memberName =
      typeof body?.memberName === "string"
        ? body.memberName.trim().slice(0, 80) || null
        : null;
    const expiresInDays = clampDays(body?.expiresInDays);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const permissions = permissionsForCareRole({
      requested: body?.permissions,
      role,
    });
    const accessCode = createShareAccessCode();

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("care_network_memberships")
      .insert({
        access_code_hash: hashShareAccessCode(accessCode),
        owner_user_id: auth.userId,
        member_email: memberEmail,
        member_name: memberName,
        role,
        permissions,
        expires_at: expiresAt.toISOString(),
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      if (isMissingNetworkTable(error)) {
        return NextResponse.json(
          {
            error:
              "Apply supabase/migrations/20260613130000_care_network_memberships.sql in Supabase first.",
            migrationRequired: true,
          },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      invitation: {
        ...mapInvitation(data as CareNetworkRow),
        accessCode,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create invitation.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "care-network-invitation-update", 40, 60_000);
    if (limited) return limited;

    const auth = await requireNetworkAccess();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : "";

    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const action = typeof body?.action === "string" ? body.action : "revoke";
    const update =
      action === "extend"
        ? await extendInvitation({
            admin,
            expiresInDays: body?.expiresInDays,
            id,
            ownerUserId: auth.userId,
          })
        : await revokeInvitation({
            admin,
            id,
            ownerUserId: auth.userId,
          });
    const { data, error } = update;

    if (error) throw error;

    return NextResponse.json({ invitation: mapInvitation(data as CareNetworkRow) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not revoke invitation.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

async function revokeInvitation({
  admin,
  id,
  ownerUserId,
}: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  id: string;
  ownerUserId: string;
}) {
  return admin
    .from("care_network_memberships")
    .update({
      revoked_at: new Date().toISOString(),
      status: "revoked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select(SELECT_FIELDS)
    .single();
}

async function extendInvitation({
  admin,
  expiresInDays,
  id,
  ownerUserId,
}: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  expiresInDays: unknown;
  id: string;
  ownerUserId: string;
}) {
  const { data: existing, error: existingError } = await admin
    .from("care_network_memberships")
    .select("id,accepted_at,revoked_at")
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .single();

  if (existingError) return { data: null, error: existingError };
  if ((existing as Pick<CareNetworkRow, "revoked_at"> | null)?.revoked_at) {
    return {
      data: null,
      error: new Error("Revoked invitations cannot be extended. Create a new invitation instead."),
    };
  }

  const days = clampDays(expiresInDays);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const status = (existing as Pick<CareNetworkRow, "accepted_at"> | null)?.accepted_at
    ? "active"
    : "pending";

  return admin
    .from("care_network_memberships")
    .update({
      expires_at: expiresAt.toISOString(),
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select(SELECT_FIELDS)
    .single();
}

async function buildRoleRecommendations(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<RoleRecommendation[]> {
  const [labs, insights, protocols, outcomes, wearables, age] = await Promise.all([
    safeCount(admin, "lab_biomarkers", userId),
    safeCount(admin, "clinical_insights", userId),
    safeCount(admin, "optimization_protocols", userId),
    safeCount(admin, "intervention_outcomes", userId),
    safeCount(admin, "wearable_metrics", userId),
    safeCount(admin, "biological_age_history", userId),
  ]);

  const recommendations: RoleRecommendation[] = [];

  if (labs + insights > 0) {
    recommendations.push({
      role: "physician",
      title: "Physician review is ready",
      detail: "Your labs and clinical insights can now be packaged into a controlled medical review view.",
      reason: "Aeonvera found clinical-grade context worth sharing with a physician.",
      priority: "high",
    });
  }

  if (protocols + outcomes + wearables > 0) {
    recommendations.push({
      role: "coach",
      title: "Coach support would be useful",
      detail: "Your execution history can help a coach focus on adherence, recovery, and weekly course correction.",
      reason: "Aeonvera found protocol and behavior signals that benefit from human accountability.",
      priority: labs + insights > 0 ? "medium" : "high",
    });
  }

  if (age + protocols > 0) {
    recommendations.push({
      role: "family",
      title: "Family support can stay lightweight",
      detail: "Share high-level progress without exposing labs or deeper clinical notes.",
      reason: "Aeonvera found a safe support view for motivation without unnecessary medical detail.",
      priority: "low",
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      role: "physician",
      title: "Start with a physician-ready baseline",
      detail: "Invite a trusted clinician once labs, wearables, or biological age data are connected.",
      reason: "Aeonvera is preparing the network structure before deeper records arrive.",
      priority: "medium",
    });
  }

  return recommendations;
}

async function safeCount(
  admin: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  userId: string
) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) return 0;
  return count || 0;
}

async function requireNetworkAccess(): Promise<{
  response: NextResponse | null;
  userId: string;
}> {
  const supabaseUser = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: "",
    };
  }

  const admin = getSupabaseAdmin();
  const { data: entitlementProfile } = await admin
    .from("profiles")
    .select("plan,subscription_status")
    .eq("user_id", user.id)
    .maybeSingle();
  const entitlement = entitlementProfile as {
    plan?: Plan | null;
    subscription_status?: SubscriptionStatus | null;
  } | null;

  if (
    !canAccess(
      entitlement?.plan || null,
      entitlement?.subscription_status || null,
      "physician_exports"
    )
  ) {
    return {
      response: NextResponse.json(
        {
          error: "Care network roles are included in Sovereign.",
          upgrade: {
            minimumPlan: "sovereign",
            message: "Upgrade to Sovereign to invite physicians, coaches, and family.",
          },
        },
        { status: 403 }
      ),
      userId: "",
    };
  }

  return { response: null, userId: user.id };
}

function mapInvitations(rows: CareNetworkRow[]) {
  return rows.map(mapInvitation);
}

function mapInvitation(row: CareNetworkRow) {
  const expired = row.expires_at ? Date.parse(row.expires_at) < Date.now() : false;
  const status = row.revoked_at
    ? "revoked"
    : expired
      ? "expired"
      : row.accepted_at || row.status === "active"
        ? "active"
        : "pending";

  return {
    id: row.id,
    acceptedAt: row.accepted_at || null,
    accessCount: row.access_count || 0,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    inviteToken: row.invite_token,
    lastAccessedAt: row.last_accessed_at || null,
    memberEmail: row.member_email || "",
    memberName: row.member_name || null,
    permissions: permissionsForCareRole({
      requested: row.permissions || DEFAULT_PHYSICIAN_EXPORT_SECTIONS,
      role: row.role || "physician",
    }),
    requiresAccessCode: Boolean((row as CareNetworkRow & { access_code_hash?: string | null }).access_code_hash),
    revokedAt: row.revoked_at || null,
    role: row.role || "physician",
    status,
    url: `/care-network/${row.invite_token}`,
  };
}

function sanitizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized.slice(0, 160) : "";
}

function clampDays(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 14;
  return Math.max(1, Math.min(90, Math.round(numeric)));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isMissingNetworkTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("care_network_memberships") ||
    error.message?.includes("schema cache")
  );
}
