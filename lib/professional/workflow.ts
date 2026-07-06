import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PROFESSIONAL_DATA_CLASSES,
  authorizeProfessionalProfileAccess,
  normalizeProfessionalDataClasses,
  type ProfessionalDataClass,
} from "@/lib/professional/access";

export const ORGANIZATION_SUBTYPES = [
  "clinic",
  "sports_team",
  "performance_group",
  "concierge_practice",
] as const;

export type OrganizationSubtype = (typeof ORGANIZATION_SUBTYPES)[number];

export const STAFF_ROLES = [
  "org_admin",
  "clinician",
  "trainer",
  "coach",
  "front_desk",
  "auditor",
  "read_only",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const CONSENT_CAPTURE_METHODS = [
  "in_app",
  "uploaded_form",
  "esignature",
  "imported_contract",
  "guardian",
] as const;

export const CONSENT_LEGAL_BASES = [
  "patient_consent",
  "guardian_consent",
  "treatment",
  "contract",
  "other",
] as const;

export const CONSENT_PURPOSES = [
  "clinical_care",
  "performance_support",
  "team_operations",
  "research",
  "other",
] as const;

type WorkspaceRow = {
  id: string;
  name: string | null;
  organization_subtype: string | null;
  owner_user_id: string | null;
  status: string | null;
  workspace_type: string | null;
  created_at?: string | null;
};

type MembershipRow = {
  role: string | null;
  status: string | null;
  workspace_id: string | null;
};

type HealthProfileRow = {
  id: string;
  display_name: string | null;
  relationship: string | null;
  status: string | null;
  workspace_id: string | null;
  created_at?: string | null;
};

type ProfileIdentityRow = {
  email: string | null;
  full_name: string | null;
  user_id: string | null;
};

export function sanitizeOrganizationSubtype(value: unknown): OrganizationSubtype | null {
  return typeof value === "string" && ORGANIZATION_SUBTYPES.includes(value as OrganizationSubtype)
    ? (value as OrganizationSubtype)
    : null;
}

export function sanitizeStaffRole(value: unknown): StaffRole | null {
  return typeof value === "string" && STAFF_ROLES.includes(value as StaffRole)
    ? (value as StaffRole)
    : null;
}

export function sanitizeProfessionalDataClassList(value: unknown): ProfessionalDataClass[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return normalizeProfessionalDataClasses(
    values
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
  );
}

export function defaultDataClassesForRole(role: StaffRole): ProfessionalDataClass[] {
  switch (role) {
    case "coach":
      return ["identity", "readiness", "performance"];
    case "trainer":
      return ["identity", "readiness", "performance", "nutrition"];
    case "clinician":
      return ["identity", "administrative", "clinical_summary", "labs_basic", "documents", "notes"];
    case "front_desk":
      return ["identity", "administrative"];
    case "auditor":
      return [];
    case "read_only":
      return ["identity"];
    case "org_admin":
      return ["identity", "administrative"];
  }
}

export async function requireOrganizationAdmin({
  supabase,
  userId,
  workspaceId,
}: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const [workspaceResult, memberResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id,name,organization_subtype,owner_user_id,status,workspace_type,created_at")
      .eq("id", workspaceId)
      .maybeSingle<WorkspaceRow>(),
    supabase
      .from("workspace_members")
      .select("workspace_id,role,status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle<MembershipRow>(),
  ]);

  if (workspaceResult.error) throw workspaceResult.error;
  if (memberResult.error) throw memberResult.error;

  const workspace = workspaceResult.data;
  const role = memberResult.data?.status === "active" ? memberResult.data.role : null;
  const canManage =
    workspace?.workspace_type === "organization" &&
    workspace.status === "active" &&
    (role === "owner" || role === "admin" || role === "org_admin");

  return {
    canManage,
    role,
    workspace: workspace || null,
  };
}

export async function listProfessionalOrganizations({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data: memberships, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id,role,status")
    .eq("user_id", userId)
    .eq("status", "active")
    .returns<MembershipRow[]>();

  if (membershipError) throw membershipError;
  const workspaceIds = Array.from(new Set((memberships || []).map((row) => row.workspace_id).filter(Boolean))) as string[];
  if (!workspaceIds.length) return [];

  const { data: workspaces, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id,name,organization_subtype,owner_user_id,status,workspace_type,created_at")
    .in("id", workspaceIds)
    .eq("workspace_type", "organization")
    .eq("status", "active")
    .returns<WorkspaceRow[]>();

  if (workspaceError) throw workspaceError;
  const membershipByWorkspace = new Map((memberships || []).map((row) => [row.workspace_id, row]));

  return (workspaces || []).map((workspace) => ({
    createdAt: workspace.created_at || null,
    id: workspace.id,
    name: workspace.name || "Aeonvera organization",
    organizationSubtype: workspace.organization_subtype,
    role: membershipByWorkspace.get(workspace.id)?.role || "read_only",
  }));
}

export async function createProfessionalOrganization({
  maxHealthProfiles = 250,
  name,
  subtype,
  supabase,
  userId,
}: {
  maxHealthProfiles?: number;
  name: string;
  subtype: OrganizationSubtype;
  supabase: SupabaseClient;
  userId: string;
}) {
  const timestamp = new Date().toISOString();
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      max_health_profiles: Math.max(1, Math.min(maxHealthProfiles, 5000)),
      name,
      organization_subtype: subtype,
      owner_user_id: userId,
      status: "active",
      updated_at: timestamp,
      workspace_type: "organization",
    })
    .select("id,name,organization_subtype,owner_user_id,status,workspace_type,created_at")
    .single<WorkspaceRow>();

  if (workspaceError) throw workspaceError;

  const { error: memberError } = await supabase.from("workspace_members").insert({
    role: "owner",
    status: "active",
    updated_at: timestamp,
    user_id: userId,
    workspace_id: workspace.id,
  });

  if (memberError) throw memberError;
  return workspace;
}

export async function createRosterProfile({
  displayName,
  relationship = "client",
  supabase,
  userId,
  workspaceId,
}: {
  displayName: string;
  relationship?: string;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { error: "You need organization admin access.", profile: null };

  const { data: profile, error } = await supabase
    .from("health_profiles")
    .insert({
      created_by_user_id: userId,
      display_name: displayName,
      is_primary: false,
      relationship,
      status: "active",
      workspace_id: workspaceId,
    })
    .select("id,workspace_id,display_name,relationship,status,created_at")
    .single<HealthProfileRow>();

  if (error) throw error;

  await supabase.from("health_profile_access").upsert(
    {
      health_profile_id: profile.id,
      role: "owner",
      status: "active",
      user_id: userId,
      workspace_id: workspaceId,
    },
    { onConflict: "health_profile_id,user_id" }
  );

  return { error: null, profile };
}

export async function addProfessionalStaff({
  email,
  role,
  supabase,
  userId,
  workspaceId,
}: {
  email: string;
  role: StaffRole;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { error: "You need organization admin access.", member: null };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id,email,full_name")
    .eq("email", email)
    .maybeSingle<ProfileIdentityRow>();

  if (profileError) throw profileError;
  if (!profile?.user_id) return { error: "Could not find an Aeonvera account for that email.", member: null };

  const { data: member, error: memberError } = await supabase
    .from("workspace_members")
    .upsert(
      {
        role,
        status: "active",
        updated_at: new Date().toISOString(),
        user_id: profile.user_id,
        workspace_id: workspaceId,
      },
      { onConflict: "workspace_id,user_id" }
    )
    .select("workspace_id,role,status")
    .single<MembershipRow>();

  if (memberError) throw memberError;

  return {
    error: null,
    member: {
      email: profile.email,
      name: profile.full_name,
      role: member.role,
      status: member.status,
      userId: profile.user_id,
      workspaceId: member.workspace_id,
    },
  };
}

export async function createProfessionalConsent({
  allowedRoles,
  captureMethod,
  dataClasses,
  expiresAt,
  legalBasis,
  purpose,
  sourceDocumentHash,
  sourceDocumentUrl,
  subjectEmail,
  supabase,
  userId,
  workspaceId,
  healthProfileId,
}: {
  allowedRoles: StaffRole[];
  captureMethod: string;
  dataClasses: ProfessionalDataClass[];
  expiresAt?: string | null;
  healthProfileId: string;
  legalBasis: string;
  purpose: string;
  sourceDocumentHash?: string | null;
  sourceDocumentUrl?: string | null;
  subjectEmail?: string | null;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { consent: null, error: "You need organization admin access." };
  if (!(await profileBelongsToWorkspace({ healthProfileId, supabase, workspaceId }))) {
    return { consent: null, error: "Health profile is not in this organization." };
  }

  const { data: consent, error } = await supabase
    .from("organization_profile_consents")
    .insert({
      allowed_roles: allowedRoles,
      captured_by_staff_user_id: userId,
      capture_method: captureMethod,
      data_classes: dataClasses,
      expires_at: expiresAt || null,
      health_profile_id: healthProfileId,
      legal_basis: legalBasis,
      purpose,
      source_document_hash: sourceDocumentHash || null,
      source_document_url: sourceDocumentUrl || null,
      subject_email: subjectEmail || null,
      workspace_id: workspaceId,
    })
    .select("id,workspace_id,health_profile_id,data_classes,allowed_roles,purpose,starts_at,expires_at,revoked_at")
    .single();

  if (error) throw error;
  return { consent, error: null };
}

export async function createProfessionalAssignment({
  dataClasses,
  expiresAt,
  healthProfileId,
  role,
  staffUserId,
  supabase,
  userId,
  workspaceId,
}: {
  dataClasses: ProfessionalDataClass[];
  expiresAt?: string | null;
  healthProfileId: string;
  role: StaffRole;
  staffUserId: string;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { assignment: null, error: "You need organization admin access." };
  if (!(await profileBelongsToWorkspace({ healthProfileId, supabase, workspaceId }))) {
    return { assignment: null, error: "Health profile is not in this organization." };
  }
  if (!(await activeMemberInWorkspace({ supabase, userId: staffUserId, workspaceId }))) {
    return { assignment: null, error: "Staff user is not an active member of this organization." };
  }

  const assignmentPayload = {
    created_by_user_id: userId,
    data_classes: dataClasses,
    expires_at: expiresAt || null,
    health_profile_id: healthProfileId,
    revoked_at: null,
    role,
    staff_user_id: staffUserId,
    updated_at: new Date().toISOString(),
    workspace_id: workspaceId,
  };

  const { data: existing, error: updateError } = await supabase
    .from("organization_profile_assignments")
    .update(assignmentPayload)
    .eq("workspace_id", workspaceId)
    .eq("health_profile_id", healthProfileId)
    .eq("staff_user_id", staffUserId)
    .eq("role", role)
    .is("revoked_at", null)
    .select("id,workspace_id,health_profile_id,staff_user_id,role,data_classes,starts_at,expires_at,revoked_at")
    .maybeSingle();

  if (updateError) throw updateError;
  if (existing) return { assignment: existing, error: null };

  const { data: assignment, error: insertError } = await supabase
    .from("organization_profile_assignments")
    .insert(assignmentPayload)
    .select("id,workspace_id,health_profile_id,staff_user_id,role,data_classes,starts_at,expires_at,revoked_at")
    .single();

  if (insertError) throw insertError;
  return { assignment, error: null };
}

export async function readProfessionalProfile({
  actorUserId,
  dataClasses,
  healthProfileId,
  route,
  supabase,
  workspaceId,
}: {
  actorUserId: string;
  dataClasses: ProfessionalDataClass[];
  healthProfileId: string;
  route?: string;
  supabase: SupabaseClient;
  workspaceId: string;
}) {
  const decision = await authorizeProfessionalProfileAccess({
    action: "view",
    actorUserId,
    healthProfileId,
    requestedDataClasses: dataClasses,
    route,
    supabase,
    workspaceId,
  });

  if (!decision.allowedDataClasses.length) {
    return { decision, profile: null };
  }

  const { data: profile, error } = await supabase
    .from("health_profiles")
    .select("id,workspace_id,display_name,relationship,status,created_at")
    .eq("id", healthProfileId)
    .eq("workspace_id", workspaceId)
    .maybeSingle<HealthProfileRow>();

  if (error) throw error;

  return {
    decision,
    profile: {
      id: profile?.id || healthProfileId,
      sections: buildProfileSections(profile, decision.allowedDataClasses),
      workspaceId,
    },
  };
}

export function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function sanitizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function isValidConsentValue<T extends readonly string[]>(
  values: T,
  value: string
): value is T[number] {
  return values.includes(value);
}

async function profileBelongsToWorkspace({
  healthProfileId,
  supabase,
  workspaceId,
}: {
  healthProfileId: string;
  supabase: SupabaseClient;
  workspaceId: string;
}) {
  const { data, error } = await supabase
    .from("health_profiles")
    .select("id")
    .eq("id", healthProfileId)
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  return Boolean(data?.id);
}

async function activeMemberInWorkspace({
  supabase,
  userId,
  workspaceId,
}: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle<{ user_id: string }>();

  if (error) throw error;
  return Boolean(data?.user_id);
}

function buildProfileSections(
  profile: HealthProfileRow | null,
  allowedDataClasses: ProfessionalDataClass[]
) {
  const sections: Record<string, unknown> = {};

  if (allowedDataClasses.includes("identity")) {
    sections.identity = {
      displayName: profile?.display_name || "Roster member",
      relationship: profile?.relationship || "client",
      status: profile?.status || "active",
    };
  }

  for (const dataClass of PROFESSIONAL_DATA_CLASSES) {
    if (dataClass === "identity") continue;
    if (!allowedDataClasses.includes(dataClass)) continue;
    sections[dataClass] = { available: true };
  }

  return sections;
}
