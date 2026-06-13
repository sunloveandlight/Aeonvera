import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess, type Plan, type SubscriptionStatus } from "@/lib/auth/permissions";
import {
  DEFAULT_PHYSICIAN_EXPORT_SECTIONS,
  normalizeSections,
} from "@/lib/digital-twin/physicianExportBundle";

type CareRole = "physician" | "coach" | "family";

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
  role?: CareRole;
  status?: string;
};

const ROLE_DEFAULT_PERMISSIONS: Record<CareRole, string[]> = {
  physician: [
    "snapshot",
    "biological_age",
    "labs",
    "protocols",
    "outcomes",
    "wearables",
    "clinical_insights",
  ],
  coach: ["snapshot", "protocols", "outcomes", "wearables"],
  family: ["snapshot", "biological_age", "protocols"],
};

const SELECT_FIELDS =
  "id,invite_token,member_email,member_name,role,status,permissions,expires_at,accepted_at,revoked_at,access_count,last_accessed_at,created_at";

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

    return NextResponse.json({ invitations: mapInvitations(data || []) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load care network invitations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireNetworkAccess();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const role = sanitizeRole(body?.role);
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
    const permissions = normalizeSections(
      Array.isArray(body?.permissions)
        ? body.permissions
        : ROLE_DEFAULT_PERMISSIONS[role]
    );

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("care_network_memberships")
      .insert({
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

    return NextResponse.json({ invitation: mapInvitation(data as CareNetworkRow) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create invitation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireNetworkAccess();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : "";

    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("care_network_memberships")
      .update({
        revoked_at: new Date().toISOString(),
        status: "revoked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("owner_user_id", auth.userId)
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;

    return NextResponse.json({ invitation: mapInvitation(data as CareNetworkRow) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not revoke invitation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
    permissions: normalizeSections(row.permissions || DEFAULT_PHYSICIAN_EXPORT_SECTIONS),
    revokedAt: row.revoked_at || null,
    role: row.role || "physician",
    status,
    url: `/care-network/${row.invite_token}`,
  };
}

function sanitizeRole(value: unknown): CareRole {
  return value === "coach" || value === "family" || value === "physician"
    ? value
    : "physician";
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
