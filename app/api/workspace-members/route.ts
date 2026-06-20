import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isHealthProfileFrozen } from "@/lib/health-profiles/profileEntitlements";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
type ProfileRole = "owner" | "editor" | "viewer";

type WorkspaceMemberRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
};

type HealthProfileRow = {
  id: string;
  display_name: string | null;
  relationship: string | null;
  is_primary: boolean | null;
  status: string | null;
};

type ProfileAccessRow = {
  health_profile_id: string;
  user_id: string;
  role: ProfileRole;
  status: string;
};

const WORKSPACE_ROLES = new Set(["admin", "member", "viewer"]);
const PROFILE_ROLES = new Set(["editor", "viewer"]);

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const admin = getSupabaseAdmin();
    const workspace = await getCurrentWorkspace(admin, auth.userId);

    if (!workspace) {
      return NextResponse.json({
        members: [],
        profiles: [],
        workspace: null,
      });
    }

    const [members, profiles] = await Promise.all([
      listMembers(admin, workspace.id),
      listWorkspaceProfiles(admin, workspace.id),
    ]);

    return NextResponse.json({
      members,
      profiles,
      workspace: {
        id: workspace.id,
        canManage: workspace.canManage,
        role: workspace.role,
      },
    });
  } catch (error) {
    console.error("Could not load workspace members:", error);
    return NextResponse.json({ error: "Could not load workspace members." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "workspace-member-grant", 20, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const workspaceRole = sanitizeWorkspaceRole(body.role);
    const profileRole = sanitizeProfileRole(body.profileRole);
    const healthProfileIds = sanitizeProfileIds(body.healthProfileIds);

    if (!email) {
      return NextResponse.json({ error: "Enter an account email." }, { status: 400 });
    }

    if (!healthProfileIds.length) {
      return NextResponse.json(
        { error: "Choose at least one health profile." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const workspace = await getCurrentWorkspace(admin, auth.userId);
    if (!workspace?.canManage) {
      return NextResponse.json(
        { error: "You need workspace admin access to grant access." },
        { status: 403 }
      );
    }

    const targetProfile = await findProfileByEmail(admin, email);
    if (!targetProfile?.user_id) {
      return NextResponse.json(
        { error: "Could not grant access to that account." },
        { status: 404 }
      );
    }

    if (targetProfile.user_id === auth.userId) {
      return NextResponse.json(
        { error: "That account already owns this workspace." },
        { status: 400 }
      );
    }

    const validProfileIds = await filterWorkspaceProfileIds(
      admin,
      workspace.id,
      healthProfileIds
    );
    if (!validProfileIds.length) {
      return NextResponse.json(
        { error: "Choose at least one profile from this workspace." },
        { status: 400 }
      );
    }

    const frozenProfileChecks = await Promise.all(
      validProfileIds.map((healthProfileId) =>
        isHealthProfileFrozen({
          healthProfileId,
          supabase: admin,
          workspaceId: workspace.id,
        })
      )
    );
    if (frozenProfileChecks.some(Boolean)) {
      return NextResponse.json(
        {
          error: "Frozen profiles are read-only on the current membership.",
          frozen: true,
        },
        { status: 423 }
      );
    }

    const timestamp = new Date().toISOString();
    const { error: memberError } = await admin
      .from("workspace_members")
      .upsert(
        {
          role: workspaceRole,
          status: "active",
          updated_at: timestamp,
          user_id: targetProfile.user_id,
          workspace_id: workspace.id,
        },
        { onConflict: "workspace_id,user_id" }
      );

    if (memberError) throw memberError;

    const accessRows = validProfileIds.map((healthProfileId) => ({
      health_profile_id: healthProfileId,
      role: profileRole,
      status: "active",
      updated_at: timestamp,
      user_id: targetProfile.user_id,
      workspace_id: workspace.id,
    }));

    const { error: accessError } = await admin
      .from("health_profile_access")
      .upsert(accessRows, { onConflict: "health_profile_id,user_id" });

    if (accessError) throw accessError;

    const members = await listMembers(admin, workspace.id);
    return NextResponse.json({
      member: members.find((member) => member.userId === targetProfile.user_id) || null,
      members,
    });
  } catch (error) {
    console.error("Could not grant workspace access:", error);
    return NextResponse.json({ error: "Could not grant workspace access." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "workspace-member-update", 40, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const targetUserId = typeof body.userId === "string" ? body.userId : "";
    const status = body.status === "removed" ? "removed" : "";

    if (!targetUserId || !status) {
      return NextResponse.json({ error: "Missing member update." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const workspace = await getCurrentWorkspace(admin, auth.userId);
    if (!workspace?.canManage) {
      return NextResponse.json(
        { error: "You need workspace admin access to update access." },
        { status: 403 }
      );
    }

    if (targetUserId === auth.userId) {
      return NextResponse.json(
        { error: "You cannot remove your own owner access here." },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const { error: memberError } = await admin
      .from("workspace_members")
      .update({ status, updated_at: timestamp })
      .eq("workspace_id", workspace.id)
      .eq("user_id", targetUserId);

    if (memberError) throw memberError;

    const { error: accessError } = await admin
      .from("health_profile_access")
      .update({ status, updated_at: timestamp })
      .eq("workspace_id", workspace.id)
      .eq("user_id", targetUserId);

    if (accessError) throw accessError;

    return NextResponse.json({ members: await listMembers(admin, workspace.id) });
  } catch (error) {
    console.error("Could not update workspace access:", error);
    return NextResponse.json({ error: "Could not update workspace access." }, { status: 500 });
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

async function getCurrentWorkspace(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const { data: membership, error: membershipError } = await admin
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ workspace_id: string; role: WorkspaceRole }>();

  if (membershipError) throw membershipError;
  if (!membership?.workspace_id) return null;

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id,status")
    .eq("id", membership.workspace_id)
    .eq("status", "active")
    .maybeSingle<{ id: string; status: string }>();

  if (workspaceError) throw workspaceError;
  if (!workspace) return null;

  return {
    canManage: membership.role === "owner" || membership.role === "admin",
    id: workspace.id,
    role: membership.role,
  };
}

async function listWorkspaceProfiles(
  admin: ReturnType<typeof getSupabaseAdmin>,
  workspaceId: string
) {
  const { data, error } = await admin
    .from("health_profiles")
    .select("id,display_name,relationship,is_primary,status")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<HealthProfileRow[]>();

  if (error) throw error;

  return (data || []).map((profile) => ({
    id: profile.id,
    displayName: profile.display_name || "Health profile",
    isPrimary: profile.is_primary === true,
    relationship: profile.relationship || "other",
    status: profile.status || "active",
  }));
}

async function listMembers(
  admin: ReturnType<typeof getSupabaseAdmin>,
  workspaceId: string
) {
  const { data: members, error: memberError } = await admin
    .from("workspace_members")
    .select("id,workspace_id,user_id,role,status,created_at,updated_at")
    .eq("workspace_id", workspaceId)
    .neq("status", "removed")
    .order("created_at", { ascending: true })
    .returns<WorkspaceMemberRow[]>();

  if (memberError) throw memberError;
  if (!members?.length) return [];

  const userIds = members.map((member) => member.user_id);
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("user_id,email,display_name,full_name")
    .in("user_id", userIds)
    .returns<ProfileRow[]>();

  if (profileError) throw profileError;

  const { data: accessRows, error: accessError } = await admin
    .from("health_profile_access")
    .select("health_profile_id,user_id,role,status")
    .eq("workspace_id", workspaceId)
    .in("user_id", userIds)
    .neq("status", "removed")
    .returns<ProfileAccessRow[]>();

  if (accessError) throw accessError;

  const profileByUser = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
  const accessByUser = new Map<string, ProfileAccessRow[]>();
  for (const access of accessRows || []) {
    const existing = accessByUser.get(access.user_id) || [];
    existing.push(access);
    accessByUser.set(access.user_id, existing);
  }

  return members.map((member) => {
    const profile = profileByUser.get(member.user_id);
    return {
      id: member.id,
      createdAt: member.created_at || "",
      displayName: profile?.display_name || profile?.full_name || "Workspace member",
      email: profile?.email || "",
      profileAccess: (accessByUser.get(member.user_id) || []).map((access) => ({
        healthProfileId: access.health_profile_id,
        role: access.role,
        status: access.status,
      })),
      role: member.role,
      status: member.status,
      updatedAt: member.updated_at || "",
      userId: member.user_id,
    };
  });
}

async function findProfileByEmail(
  admin: ReturnType<typeof getSupabaseAdmin>,
  email: string
) {
  const { data, error } = await admin
    .from("profiles")
    .select("user_id,email,display_name,full_name")
    .eq("email", email)
    .maybeSingle<ProfileRow>();

  if (error) throw error;
  return data;
}

async function filterWorkspaceProfileIds(
  admin: ReturnType<typeof getSupabaseAdmin>,
  workspaceId: string,
  healthProfileIds: string[]
) {
  const { data, error } = await admin
    .from("health_profiles")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .in("id", healthProfileIds)
    .returns<Array<{ id: string }>>();

  if (error) throw error;

  const allowed = new Set((data || []).map((profile) => profile.id));
  return healthProfileIds.filter((id) => allowed.has(id));
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function sanitizeWorkspaceRole(value: unknown): WorkspaceRole {
  if (typeof value !== "string") return "viewer";
  return WORKSPACE_ROLES.has(value) ? (value as WorkspaceRole) : "viewer";
}

function sanitizeProfileRole(value: unknown): ProfileRole {
  if (typeof value !== "string") return "viewer";
  return PROFILE_ROLES.has(value) ? (value as ProfileRole) : "viewer";
}

function sanitizeProfileIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))
  );
}
