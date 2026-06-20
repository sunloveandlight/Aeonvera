import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_HEALTH_PROFILE_COOKIE } from "@/lib/health-profiles/activeHealthProfile";
import { isSubscriptionValid, type SubscriptionStatus } from "@/lib/auth/permissions";
import {
  getWorkspaceProfileEntitlements,
  isHealthProfileFrozen,
} from "@/lib/health-profiles/profileEntitlements";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type AccessRow = {
  health_profile_id: string;
  role: "owner" | "editor" | "viewer";
  workspace_id: string;
};

type HealthProfileRow = {
  id: string;
  workspace_id: string;
  display_name: string | null;
  relationship: string | null;
  is_primary: boolean | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const RELATIONSHIPS = new Set([
  "self",
  "partner",
  "child",
  "parent",
  "family",
  "client",
  "other",
]);

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const admin = getSupabaseAdmin();
    const profiles = await listProfiles(admin, auth.userId);
    const profileLimit = await getWorkspaceProfileLimit(admin, auth.userId);
    const activeProfileId = request.cookies.get(ACTIVE_HEALTH_PROFILE_COOKIE)?.value || null;

    return NextResponse.json({
      activeProfileId: profiles.some((profile) => profile.id === activeProfileId)
        ? activeProfileId
        : profiles.find((profile) => profile.isPrimary)?.id || profiles[0]?.id || null,
      profileLimit,
      profiles,
      remainingProfiles: Math.max(profileLimit.maxHealthProfiles - profiles.length, 0),
    });
  } catch (error) {
    console.error("Could not load health profiles:", error);
    return NextResponse.json({ error: "Could not load health profiles." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "health-profile-create", 20, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const displayName = sanitizeText(body.displayName, 80) || "New profile";
    const relationship = sanitizeRelationship(body.relationship);
    const admin = getSupabaseAdmin();
    const workspace = await getManagedWorkspace(admin, auth.userId);

    if (!workspace) {
      return NextResponse.json(
        { error: "You need workspace admin access to create a profile." },
        { status: 403 }
      );
    }

    if (!isSubscriptionValid(workspace.subscriptionStatus)) {
      return NextResponse.json(
        { error: "An active membership is required to create profiles." },
        { status: 402 }
      );
    }

    const { count, error: countError } = await admin
      .from("health_profiles")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("status", "active");

    if (countError) throw countError;

    if ((count || 0) >= workspace.maxHealthProfiles) {
      return NextResponse.json(
        {
          error: "This membership has reached its included health profile limit.",
          maxHealthProfiles: workspace.maxHealthProfiles,
        },
        { status: 403 }
      );
    }

    const { data: profile, error: insertError } = await admin
      .from("health_profiles")
      .insert({
        workspace_id: workspace.id,
        created_by_user_id: auth.userId,
        display_name: displayName,
        relationship,
        is_primary: false,
        status: "active",
      })
      .select("id,workspace_id,display_name,relationship,is_primary,status,created_at,updated_at")
      .single<HealthProfileRow>();

    if (insertError) throw insertError;

    const { error: accessError } = await admin.from("health_profile_access").insert({
      workspace_id: workspace.id,
      health_profile_id: profile.id,
      user_id: auth.userId,
      role: "owner",
      status: "active",
    });

    if (accessError) throw accessError;

    return NextResponse.json(
      {
        profile: formatProfile(profile, {
          health_profile_id: profile.id,
          role: "owner",
          workspace_id: workspace.id,
        }),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Could not create health profile:", error);
    return NextResponse.json({ error: "Could not create health profile." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "health-profile-update", 60, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const profileId = typeof body.id === "string" ? body.id : "";
    if (!profileId) {
      return NextResponse.json({ error: "Missing profile id." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const access = await getProfileAccess(admin, auth.userId, profileId);
    if (!access || (access.role !== "owner" && access.role !== "editor")) {
      return NextResponse.json(
        { error: "You do not have permission to update this profile." },
        { status: 403 }
      );
    }

    const frozen = await isHealthProfileFrozen({
      healthProfileId: profileId,
      supabase: admin,
      workspaceId: access.workspace_id,
    });
    if (frozen) {
      return NextResponse.json(
        {
          error: "This health profile is frozen on the current membership.",
          frozen: true,
        },
        { status: 423 }
      );
    }

    const patch: Record<string, string> = {};
    const displayName = sanitizeText(body.displayName, 80);
    const relationship = sanitizeRelationship(body.relationship);
    const status = body.status === "archived" || body.status === "active" ? body.status : null;

    if (displayName) patch.display_name = displayName;
    if (relationship) patch.relationship = relationship;
    if (status) patch.status = status;

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "No supported profile fields supplied." }, { status: 400 });
    }

    const { data, error } = await admin
      .from("health_profiles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", profileId)
      .eq("workspace_id", access.workspace_id)
      .select("id,workspace_id,display_name,relationship,is_primary,status,created_at,updated_at")
      .single<HealthProfileRow>();

    if (error) throw error;

    return NextResponse.json({ profile: formatProfile(data, access) });
  } catch (error) {
    console.error("Could not update health profile:", error);
    return NextResponse.json({ error: "Could not update health profile." }, { status: 500 });
  }
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
    };
  }

  return { response: null, userId: user.id };
}

async function listProfiles(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const { data: accessRows, error: accessError } = await admin
    .from("health_profile_access")
    .select("workspace_id,health_profile_id,role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .returns<AccessRow[]>();

  if (accessError) throw accessError;
  if (!accessRows?.length) return [];

  const profileIds = accessRows.map((row) => row.health_profile_id);
  const { data: profiles, error: profileError } = await admin
    .from("health_profiles")
    .select("id,workspace_id,display_name,relationship,is_primary,status,created_at,updated_at")
    .in("id", profileIds)
    .eq("status", "active")
    .returns<HealthProfileRow[]>();

  if (profileError) throw profileError;

  const accessByProfile = new Map(accessRows.map((row) => [row.health_profile_id, row]));
  const entitlementByWorkspace = new Map<
    string,
    Awaited<ReturnType<typeof getWorkspaceProfileEntitlements>>
  >();

  for (const row of accessRows) {
    if (entitlementByWorkspace.has(row.workspace_id)) continue;
    entitlementByWorkspace.set(
      row.workspace_id,
      await getWorkspaceProfileEntitlements({
        supabase: admin,
        workspaceId: row.workspace_id,
      })
    );
  }

  return (profiles || [])
    .map((profile) => {
      const access = accessByProfile.get(profile.id);
      const entitlements = access?.workspace_id
        ? entitlementByWorkspace.get(access.workspace_id)
        : null;
      return formatProfile(
        profile,
        access,
        entitlements ? !entitlements.writableProfileIds.has(profile.id) : false
      );
    })
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.createdAt.localeCompare(b.createdAt));
}

async function getManagedWorkspace(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const { data: membership, error: membershipError } = await admin
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle<{ workspace_id: string; role: string }>();

  if (membershipError) throw membershipError;
  if (!membership?.workspace_id) return null;

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id,max_health_profiles,subscription_status")
    .eq("id", membership.workspace_id)
    .eq("status", "active")
    .maybeSingle<{
      id: string;
      max_health_profiles: number;
      subscription_status: SubscriptionStatus | null;
    }>();

  if (workspaceError) throw workspaceError;
  if (!workspace) return null;

  return {
    id: workspace.id,
    maxHealthProfiles: workspace.max_health_profiles || 1,
    subscriptionStatus: workspace.subscription_status || null,
  };
}

async function getWorkspaceProfileLimit(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const workspace = await getManagedWorkspace(admin, userId);

  return {
    maxHealthProfiles: workspace?.maxHealthProfiles || 1,
  };
}

async function getProfileAccess(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  profileId: string
) {
  const { data, error } = await admin
    .from("health_profile_access")
    .select("workspace_id,health_profile_id,role")
    .eq("user_id", userId)
    .eq("health_profile_id", profileId)
    .eq("status", "active")
    .maybeSingle<AccessRow>();

  if (error) throw error;
  return data;
}

function formatProfile(profile: HealthProfileRow, access?: AccessRow | null, isFrozen = false) {
  return {
    id: profile.id,
    workspaceId: profile.workspace_id,
    displayName: profile.display_name || "Health profile",
    relationship: profile.relationship || "other",
    isPrimary: profile.is_primary === true,
    status: profile.status || "active",
    role: access?.role || "viewer",
    isFrozen,
    createdAt: profile.created_at || "",
    updatedAt: profile.updated_at || "",
  };
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function sanitizeRelationship(value: unknown) {
  if (typeof value !== "string") return "other";
  return RELATIONSHIPS.has(value) ? value : "other";
}
