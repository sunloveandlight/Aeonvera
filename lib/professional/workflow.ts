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

export const CONSENT_ALLOWED_ROLES = [
  "clinician",
  "trainer",
  "coach",
  "front_desk",
  "auditor",
  "read_only",
] as const satisfies readonly StaffRole[];

export type ConsentAllowedRole = (typeof CONSENT_ALLOWED_ROLES)[number];

const CLINICAL_CONSENT_CLASSES = new Set<ProfessionalDataClass>([
  "clinical_summary",
  "labs_basic",
  "labs_sensitive",
  "mental_health",
  "documents",
  "notes",
]);

const PERFORMANCE_CONSENT_CLASSES = new Set<ProfessionalDataClass>([
  "nutrition",
  "performance",
  "readiness",
]);

const ADMINISTRATIVE_CONSENT_CLASSES = new Set<ProfessionalDataClass>([
  "administrative",
  "identity",
]);

const DOCUMENTED_BASIS_DATA_CLASSES = new Set<ProfessionalDataClass>([
  ...CLINICAL_CONSENT_CLASSES,
]);

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
  user_id?: string | null;
  created_at?: string | null;
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

type ProfessionalConsentRow = {
  allowed_roles: string[] | null;
  capture_method?: string | null;
  created_at?: string | null;
  data_classes: string[] | null;
  expires_at?: string | null;
  health_profile_id: string;
  id: string;
  legal_basis?: string | null;
  purpose: string | null;
  revoked_at?: string | null;
  source_document_url?: string | null;
  starts_at?: string | null;
  subject_email?: string | null;
  workspace_id: string;
};

type ProfessionalAssignmentRow = {
  created_at?: string | null;
  data_classes: string[] | null;
  expires_at?: string | null;
  health_profile_id: string;
  id: string;
  revoked_at?: string | null;
  role: string | null;
  staff_user_id: string;
  starts_at?: string | null;
  workspace_id: string;
};

type ProfessionalAuditRow = {
  access_decision: string | null;
  action: string | null;
  actor_role: string | null;
  actor_user_id: string | null;
  assignment_id: string | null;
  consent_id: string | null;
  created_at?: string | null;
  data_classes: string[] | null;
  health_profile_id: string | null;
  id: string;
  route: string | null;
  workspace_id: string;
};

type ProfessionalInvitationRow = {
  accepted_at?: string | null;
  accepted_by_user_id?: string | null;
  created_at?: string | null;
  data_classes: string[] | null;
  email: string;
  expires_at: string;
  health_profile_id: string | null;
  id: string;
  invite_token: string;
  invite_type: string;
  name: string | null;
  revoked_at?: string | null;
  role: string;
  status: string;
  workspace_id: string;
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

export function sanitizeConsentAllowedRole(value: unknown): ConsentAllowedRole | null {
  return typeof value === "string" && CONSENT_ALLOWED_ROLES.includes(value as ConsentAllowedRole)
    ? (value as ConsentAllowedRole)
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

export function consentAllowedRolesForDataClasses(
  dataClasses: readonly ProfessionalDataClass[]
): ConsentAllowedRole[] {
  const roles = new Set<ConsentAllowedRole>();

  for (const dataClass of dataClasses) {
    if (CLINICAL_CONSENT_CLASSES.has(dataClass)) roles.add("clinician");
    if (PERFORMANCE_CONSENT_CLASSES.has(dataClass)) {
      roles.add("trainer");
      roles.add("coach");
    }
    if (ADMINISTRATIVE_CONSENT_CLASSES.has(dataClass)) {
      roles.add("front_desk");
      roles.add("read_only");
    }
  }

  return Array.from(roles);
}

export function requiresDocumentedProfessionalBasis({
  dataClasses,
  legalBasis,
}: {
  dataClasses: readonly ProfessionalDataClass[];
  legalBasis: string;
}) {
  if (!dataClasses.some((dataClass) => DOCUMENTED_BASIS_DATA_CLASSES.has(dataClass))) {
    return false;
  }

  return legalBasis !== "patient_consent" && legalBasis !== "guardian_consent";
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

export async function listRosterProfiles({
  supabase,
  userId,
  workspaceId,
}: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { error: "You need organization admin access.", profiles: [] };

  const { data, error } = await supabase
    .from("health_profiles")
    .select("id,workspace_id,display_name,relationship,status,created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(250)
    .returns<HealthProfileRow[]>();

  if (error) throw error;

  return {
    error: null,
    profiles: (data || []).map((profile) => ({
      createdAt: profile.created_at || null,
      displayName: profile.display_name || "Roster member",
      id: profile.id,
      relationship: profile.relationship || "client",
      status: profile.status || "active",
      workspaceId: profile.workspace_id,
    })),
  };
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

export async function createProfessionalInvitation({
  dataClasses,
  email,
  expiresAt,
  healthProfileId,
  inviteType,
  name,
  role,
  supabase,
  userId,
  workspaceId,
}: {
  dataClasses?: ProfessionalDataClass[];
  email: string;
  expiresAt?: string | null;
  healthProfileId?: string | null;
  inviteType: "roster_member" | "staff";
  name?: string | null;
  role: StaffRole | "member";
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { error: "You need organization admin access.", invitation: null };

  if (inviteType === "staff" && role === "member") {
    return { error: "Choose a staff role for staff invitations.", invitation: null };
  }

  if (inviteType === "roster_member") {
    if (role !== "member") return { error: "Roster member invitations must use the member role.", invitation: null };
    if (!healthProfileId) return { error: "Choose a roster profile for the invitation.", invitation: null };
    if (!(await profileBelongsToWorkspace({ healthProfileId, supabase, workspaceId }))) {
      return { error: "Health profile is not in this organization.", invitation: null };
    }
  }

  const normalizedClasses =
    role === "member"
      ? normalizeProfessionalDataClasses(dataClasses?.length ? dataClasses : ["identity"])
      : normalizeProfessionalDataClasses(dataClasses?.length ? dataClasses : defaultDataClassesForRole(role));

  const { data: invitation, error } = await supabase
    .from("organization_invitations")
    .insert({
      created_by_user_id: userId,
      data_classes: normalizedClasses,
      email,
      expires_at: expiresAt || undefined,
      health_profile_id: inviteType === "roster_member" ? healthProfileId : null,
      invite_type: inviteType,
      name: name || null,
      role,
      workspace_id: workspaceId,
    })
    .select(
      "id,workspace_id,invite_token,invite_type,email,name,role,health_profile_id,data_classes,status,expires_at,accepted_at,accepted_by_user_id,revoked_at,created_at"
    )
    .single<ProfessionalInvitationRow>();

  if (error) throw error;

  await recordProfessionalWorkflowAudit({
    action: "authorize",
    actorRole: auth.role,
    dataClasses: normalizedClasses,
    healthProfileId: inviteType === "roster_member" ? healthProfileId : null,
    metadata: {
      email,
      inviteType,
      target: "invitation",
    },
    route: "/api/professional/invitations",
    supabase,
    userId,
    workspaceId,
  });

  return { error: null, invitation: mapProfessionalInvitation(invitation) };
}

export async function listProfessionalInvitations({
  healthProfileId,
  supabase,
  userId,
  workspaceId,
}: {
  healthProfileId?: string;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { error: "You need organization admin access.", invitations: [] };

  let query = supabase
    .from("organization_invitations")
    .select(
      "id,workspace_id,invite_token,invite_type,email,name,role,health_profile_id,data_classes,status,expires_at,accepted_at,accepted_by_user_id,revoked_at,created_at"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (healthProfileId) query = query.eq("health_profile_id", healthProfileId);

  const { data, error } = await query.returns<ProfessionalInvitationRow[]>();
  if (error) throw error;

  return {
    error: null,
    invitations: (data || []).map(mapProfessionalInvitation),
  };
}

export async function revokeProfessionalInvitation({
  invitationId,
  supabase,
  userId,
  workspaceId,
}: {
  invitationId: string;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { error: "You need organization admin access.", invitation: null };

  const timestamp = new Date().toISOString();
  const { data: invitation, error } = await supabase
    .from("organization_invitations")
    .update({
      revoked_at: timestamp,
      revoked_by_user_id: userId,
      status: "revoked",
      updated_at: timestamp,
    })
    .eq("id", invitationId)
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .select(
      "id,workspace_id,invite_token,invite_type,email,name,role,health_profile_id,data_classes,status,expires_at,accepted_at,accepted_by_user_id,revoked_at,created_at"
    )
    .maybeSingle<ProfessionalInvitationRow>();

  if (error) throw error;
  if (!invitation) return { error: "Invitation was not found or is no longer pending.", invitation: null };

  await recordProfessionalWorkflowAudit({
    action: "revoke",
    actorRole: auth.role,
    dataClasses: normalizeProfessionalDataClasses(invitation.data_classes || []),
    healthProfileId: invitation.health_profile_id,
    metadata: {
      email: invitation.email,
      inviteType: invitation.invite_type,
      target: "invitation",
    },
    route: "/api/professional/invitations",
    supabase,
    userId,
    workspaceId,
  });

  return { error: null, invitation: mapProfessionalInvitation(invitation) };
}

export async function readProfessionalInvitationByToken({
  inviteToken,
  supabase,
}: {
  inviteToken: string;
  supabase: SupabaseClient;
}) {
  const { data: invitation, error } = await supabase
    .from("organization_invitations")
    .select(
      "id,workspace_id,invite_token,invite_type,email,name,role,health_profile_id,data_classes,status,expires_at,accepted_at,accepted_by_user_id,revoked_at,created_at"
    )
    .eq("invite_token", inviteToken)
    .maybeSingle<ProfessionalInvitationRow>();

  if (error) throw error;
  if (!invitation) return { error: "Invitation was not found.", invitation: null, workspace: null };

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id,name,organization_subtype,owner_user_id,status,workspace_type,created_at")
    .eq("id", invitation.workspace_id)
    .maybeSingle<WorkspaceRow>();

  if (workspaceError) throw workspaceError;

  return {
    error: null,
    invitation: mapProfessionalInvitation(invitation),
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name || "Aeonvera organization",
          organizationSubtype: workspace.organization_subtype,
        }
      : null,
  };
}

export async function acceptProfessionalInvitation({
  consentDataClasses,
  inviteToken,
  supabase,
  userEmail,
  userId,
}: {
  consentDataClasses?: string[] | null;
  inviteToken: string;
  supabase: SupabaseClient;
  userEmail?: string | null;
  userId: string;
}) {
  const { data: invitation, error: loadError } = await supabase
    .from("organization_invitations")
    .select(
      "id,workspace_id,invite_token,invite_type,email,name,role,health_profile_id,data_classes,status,expires_at,accepted_at,accepted_by_user_id,revoked_at,created_at"
    )
    .eq("invite_token", inviteToken)
    .maybeSingle<ProfessionalInvitationRow>();

  if (loadError) throw loadError;
  if (!invitation) return { error: "Invitation was not found.", invitation: null };

  const status = getInvitationStatus(invitation);
  if (status === "accepted") return { error: "Invitation has already been accepted.", invitation: null };
  if (status === "revoked") return { error: "Invitation has been revoked.", invitation: null };
  if (status === "expired") return { error: "Invitation has expired.", invitation: null };

  const email = (userEmail || "").trim().toLowerCase();
  if (!email || email !== invitation.email.trim().toLowerCase()) {
    return { error: "Sign in with the email address this invitation was sent to.", invitation: null };
  }

  const timestamp = new Date().toISOString();
  if (invitation.invite_type === "staff") {
    await upsertWorkspaceMember({
      role: invitation.role,
      supabase,
      userId,
      workspaceId: invitation.workspace_id,
    });
  } else if (invitation.health_profile_id) {
    await upsertWorkspaceMember({
      role: "member",
      supabase,
      userId,
      workspaceId: invitation.workspace_id,
    });
    const { error: accessError } = await supabase.from("health_profile_access").upsert(
      {
        health_profile_id: invitation.health_profile_id,
        role: "viewer",
        status: "active",
        updated_at: timestamp,
        user_id: userId,
        workspace_id: invitation.workspace_id,
      },
      { onConflict: "health_profile_id,user_id" }
    );

    if (accessError) throw accessError;

    const requestedClasses = normalizeProfessionalDataClasses(consentDataClasses || []);
    const invitationClasses = normalizeProfessionalDataClasses(invitation.data_classes || []);
    const consentClasses = requestedClasses.filter((dataClass) =>
      invitationClasses.includes(dataClass)
    );
    const allowedRoles = consentAllowedRolesForDataClasses(consentClasses);

    if (consentClasses.length && allowedRoles.length) {
      const { error: consentError } = await supabase
        .from("organization_profile_consents")
        .insert({
          allowed_roles: allowedRoles,
          capture_method: "in_app",
          data_classes: consentClasses,
          granted_by_user_id: userId,
          health_profile_id: invitation.health_profile_id,
          legal_basis: "patient_consent",
          purpose: "team_operations",
          subject_email: invitation.email,
          subject_user_id: userId,
          workspace_id: invitation.workspace_id,
        });

      if (consentError) throw consentError;
    }
  }

  const { data: acceptedInvitation, error: acceptError } = await supabase
    .from("organization_invitations")
    .update({
      accepted_at: timestamp,
      accepted_by_user_id: userId,
      status: "accepted",
      updated_at: timestamp,
    })
    .eq("id", invitation.id)
    .eq("status", "pending")
    .select(
      "id,workspace_id,invite_token,invite_type,email,name,role,health_profile_id,data_classes,status,expires_at,accepted_at,accepted_by_user_id,revoked_at,created_at"
    )
    .maybeSingle<ProfessionalInvitationRow>();

  if (acceptError) throw acceptError;
  if (!acceptedInvitation) return { error: "Invitation is no longer pending.", invitation: null };

  await recordProfessionalWorkflowAudit({
    action: "authorize",
    actorRole: acceptedInvitation.role,
    dataClasses: normalizeProfessionalDataClasses(acceptedInvitation.data_classes || []),
    healthProfileId: acceptedInvitation.health_profile_id,
    metadata: {
      email: acceptedInvitation.email,
      inviteType: acceptedInvitation.invite_type,
      target: "invitation_acceptance",
    },
    route: "/api/professional/invitations/[inviteToken]",
    supabase,
    userId,
    workspaceId: acceptedInvitation.workspace_id,
  });

  return { error: null, invitation: mapProfessionalInvitation(acceptedInvitation) };
}

export async function listProfessionalStaff({
  supabase,
  userId,
  workspaceId,
}: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { error: "You need organization admin access.", staff: [] };

  const { data: members, error: memberError } = await supabase
    .from("workspace_members")
    .select("workspace_id,user_id,role,status,created_at")
    .eq("workspace_id", workspaceId)
    .neq("status", "removed")
    .order("created_at", { ascending: true })
    .limit(250)
    .returns<MembershipRow[]>();

  if (memberError) throw memberError;

  const userIds = Array.from(
    new Set((members || []).map((member) => member.user_id).filter(Boolean))
  ) as string[];
  const identityByUserId = new Map<string, ProfileIdentityRow>();

  if (userIds.length) {
    const { data: identities, error: identityError } = await supabase
      .from("profiles")
      .select("user_id,email,full_name")
      .in("user_id", userIds)
      .returns<ProfileIdentityRow[]>();

    if (identityError) throw identityError;
    for (const identity of identities || []) {
      if (identity.user_id) identityByUserId.set(identity.user_id, identity);
    }
  }

  return {
    error: null,
    staff: (members || []).map((member) => {
      const identity = member.user_id ? identityByUserId.get(member.user_id) : null;
      return {
        createdAt: member.created_at || null,
        email: identity?.email || null,
        name: identity?.full_name || null,
        role: member.role || "read_only",
        status: member.status || "active",
        userId: member.user_id || "",
        workspaceId: member.workspace_id || workspaceId,
      };
    }),
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

  await recordProfessionalWorkflowAudit({
    action: "authorize",
    actorRole: auth.role,
    consentId: consent.id,
    dataClasses: normalizeProfessionalDataClasses(consent.data_classes || []),
    healthProfileId: consent.health_profile_id,
    metadata: {
      allowedRoles: consent.allowed_roles || [],
      legalBasis,
      purpose,
      target: "consent",
    },
    route: "/api/professional/consents",
    supabase,
    userId,
    workspaceId,
  });

  return { consent, error: null };
}

export async function listProfessionalConsents({
  healthProfileId,
  supabase,
  userId,
  workspaceId,
}: {
  healthProfileId?: string;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { consents: [], error: "You need organization admin access." };

  let query = supabase
    .from("organization_profile_consents")
    .select(
      "id,workspace_id,health_profile_id,data_classes,allowed_roles,purpose,capture_method,legal_basis,subject_email,source_document_url,starts_at,expires_at,revoked_at,created_at"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (healthProfileId) query = query.eq("health_profile_id", healthProfileId);

  const { data, error } = await query.returns<ProfessionalConsentRow[]>();
  if (error) throw error;

  return {
    consents: (data || []).map((consent) => ({
      allowedRoles: consent.allowed_roles || [],
      captureMethod: consent.capture_method || null,
      createdAt: consent.created_at || null,
      dataClasses: consent.data_classes || [],
      expiresAt: consent.expires_at || null,
      healthProfileId: consent.health_profile_id,
      id: consent.id,
      legalBasis: consent.legal_basis || null,
      purpose: consent.purpose || "other",
      revokedAt: consent.revoked_at || null,
      sourceDocumentUrl: consent.source_document_url || null,
      startsAt: consent.starts_at || null,
      subjectEmail: consent.subject_email || null,
      workspaceId: consent.workspace_id,
    })),
    error: null,
  };
}

export async function revokeProfessionalConsent({
  consentId,
  reason,
  supabase,
  userId,
  workspaceId,
}: {
  consentId: string;
  reason?: string | null;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { consent: null, error: "You need organization admin access." };

  const { data: consent, error: loadError } = await supabase
    .from("organization_profile_consents")
    .select("id,workspace_id,health_profile_id,data_classes,allowed_roles,purpose,starts_at,expires_at,revoked_at")
    .eq("id", consentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle<ProfessionalConsentRow>();

  if (loadError) throw loadError;
  if (!consent) return { consent: null, error: "Consent was not found." };
  if (consent.revoked_at) return { consent: null, error: "Consent is already revoked." };

  const timestamp = new Date().toISOString();
  const { data: revokedConsent, error: revokeError } = await supabase
    .from("organization_profile_consents")
    .update({
      revoked_at: timestamp,
      revoked_by_user_id: userId,
      revocation_reason: reason || null,
      updated_at: timestamp,
    })
    .eq("id", consentId)
    .eq("workspace_id", workspaceId)
    .is("revoked_at", null)
    .select("id,workspace_id,health_profile_id,data_classes,allowed_roles,purpose,starts_at,expires_at,revoked_at")
    .maybeSingle<ProfessionalConsentRow>();

  if (revokeError) throw revokeError;
  if (!revokedConsent) return { consent: null, error: "Consent is already revoked." };

  await recordProfessionalWorkflowAudit({
    action: "revoke",
    actorRole: auth.role,
    consentId,
    dataClasses: normalizeProfessionalDataClasses(revokedConsent.data_classes || []),
    healthProfileId: revokedConsent.health_profile_id,
    metadata: {
      reason: reason || null,
      target: "consent",
    },
    route: "/api/professional/consents",
    supabase,
    userId,
    workspaceId,
  });

  return { consent: revokedConsent, error: null };
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
  if (existing) {
    await recordProfessionalWorkflowAudit({
      action: "assign",
      actorRole: auth.role,
      assignmentId: existing.id,
      dataClasses: normalizeProfessionalDataClasses(existing.data_classes || []),
      healthProfileId: existing.health_profile_id,
      metadata: {
        role: existing.role || role,
        staffUserId,
        target: "assignment",
        writeMode: "update_existing",
      },
      route: "/api/professional/assignments",
      supabase,
      userId,
      workspaceId,
    });
    return { assignment: existing, error: null };
  }

  const { data: assignment, error: insertError } = await supabase
    .from("organization_profile_assignments")
    .insert(assignmentPayload)
    .select("id,workspace_id,health_profile_id,staff_user_id,role,data_classes,starts_at,expires_at,revoked_at")
    .single();

  if (insertError) throw insertError;

  await recordProfessionalWorkflowAudit({
    action: "assign",
    actorRole: auth.role,
    assignmentId: assignment.id,
    dataClasses: normalizeProfessionalDataClasses(assignment.data_classes || []),
    healthProfileId: assignment.health_profile_id,
    metadata: {
      role: assignment.role || role,
      staffUserId,
      target: "assignment",
      writeMode: "insert",
    },
    route: "/api/professional/assignments",
    supabase,
    userId,
    workspaceId,
  });

  return { assignment, error: null };
}

export async function listProfessionalAssignments({
  healthProfileId,
  supabase,
  userId,
  workspaceId,
}: {
  healthProfileId?: string;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { assignments: [], error: "You need organization admin access." };

  let query = supabase
    .from("organization_profile_assignments")
    .select(
      "id,workspace_id,health_profile_id,staff_user_id,role,data_classes,starts_at,expires_at,revoked_at,created_at"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (healthProfileId) query = query.eq("health_profile_id", healthProfileId);

  const { data, error } = await query.returns<ProfessionalAssignmentRow[]>();
  if (error) throw error;

  return {
    assignments: (data || []).map((assignment) => ({
      createdAt: assignment.created_at || null,
      dataClasses: assignment.data_classes || [],
      expiresAt: assignment.expires_at || null,
      healthProfileId: assignment.health_profile_id,
      id: assignment.id,
      revokedAt: assignment.revoked_at || null,
      role: assignment.role || "read_only",
      staffUserId: assignment.staff_user_id,
      startsAt: assignment.starts_at || null,
      workspaceId: assignment.workspace_id,
    })),
    error: null,
  };
}

export async function revokeProfessionalAssignment({
  assignmentId,
  reason,
  supabase,
  userId,
  workspaceId,
}: {
  assignmentId: string;
  reason?: string | null;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { assignment: null, error: "You need organization admin access." };

  const { data: assignment, error: loadError } = await supabase
    .from("organization_profile_assignments")
    .select("id,workspace_id,health_profile_id,staff_user_id,role,data_classes,starts_at,expires_at,revoked_at")
    .eq("id", assignmentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle<ProfessionalAssignmentRow>();

  if (loadError) throw loadError;
  if (!assignment) return { assignment: null, error: "Assignment was not found." };
  if (assignment.revoked_at) return { assignment: null, error: "Assignment is already revoked." };

  const timestamp = new Date().toISOString();
  const { data: revokedAssignment, error: revokeError } = await supabase
    .from("organization_profile_assignments")
    .update({
      revoked_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", assignmentId)
    .eq("workspace_id", workspaceId)
    .is("revoked_at", null)
    .select("id,workspace_id,health_profile_id,staff_user_id,role,data_classes,starts_at,expires_at,revoked_at")
    .maybeSingle<ProfessionalAssignmentRow>();

  if (revokeError) throw revokeError;
  if (!revokedAssignment) return { assignment: null, error: "Assignment is already revoked." };

  await recordProfessionalWorkflowAudit({
    action: "revoke",
    actorRole: auth.role,
    assignmentId,
    dataClasses: normalizeProfessionalDataClasses(revokedAssignment.data_classes || []),
    healthProfileId: revokedAssignment.health_profile_id,
    metadata: {
      reason: reason || null,
      target: "assignment",
    },
    route: "/api/professional/assignments",
    supabase,
    userId,
    workspaceId,
  });

  return { assignment: revokedAssignment, error: null };
}

export async function listProfessionalAuditEvents({
  healthProfileId,
  supabase,
  userId,
  workspaceId,
}: {
  healthProfileId?: string;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const auth = await requireOrganizationAdmin({ supabase, userId, workspaceId });
  if (!auth.canManage) return { auditEvents: [], error: "You need organization admin access." };

  let query = supabase
    .from("organization_access_audit_events")
    .select(
      "id,workspace_id,actor_user_id,actor_role,health_profile_id,action,data_classes,route,access_decision,consent_id,assignment_id,created_at"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (healthProfileId) query = query.eq("health_profile_id", healthProfileId);

  const { data, error } = await query.returns<ProfessionalAuditRow[]>();
  if (error) throw error;

  return {
    auditEvents: (data || []).map((event) => ({
      accessDecision: event.access_decision || "denied",
      action: event.action || "view",
      actorRole: event.actor_role || null,
      actorUserId: event.actor_user_id || null,
      assignmentId: event.assignment_id || null,
      consentId: event.consent_id || null,
      createdAt: event.created_at || null,
      dataClasses: event.data_classes || [],
      healthProfileId: event.health_profile_id || null,
      id: event.id,
      route: event.route || null,
      workspaceId: event.workspace_id,
    })),
    error: null,
  };
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

async function upsertWorkspaceMember({
  role,
  supabase,
  userId,
  workspaceId,
}: {
  role: string;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const { error } = await supabase.from("workspace_members").upsert(
    {
      role,
      status: "active",
      updated_at: new Date().toISOString(),
      user_id: userId,
      workspace_id: workspaceId,
    },
    { onConflict: "workspace_id,user_id" }
  );

  if (error) throw error;
}

function mapProfessionalInvitation(invitation: ProfessionalInvitationRow) {
  const dataClasses = normalizeProfessionalDataClasses(invitation.data_classes || []);
  return {
    acceptedAt: invitation.accepted_at || null,
    acceptedByUserId: invitation.accepted_by_user_id || null,
    createdAt: invitation.created_at || null,
    consentRoles: consentAllowedRolesForDataClasses(dataClasses),
    dataClasses,
    email: invitation.email,
    expiresAt: invitation.expires_at,
    healthProfileId: invitation.health_profile_id,
    id: invitation.id,
    inviteToken: invitation.invite_token,
    inviteType: invitation.invite_type,
    name: invitation.name,
    revokedAt: invitation.revoked_at || null,
    role: invitation.role,
    status: getInvitationStatus(invitation),
    url: `/professional/invite/${invitation.invite_token}`,
    workspaceId: invitation.workspace_id,
  };
}

function getInvitationStatus(invitation: ProfessionalInvitationRow) {
  if (invitation.revoked_at || invitation.status === "revoked") return "revoked";
  if (invitation.accepted_at || invitation.status === "accepted") return "accepted";
  if (Date.parse(invitation.expires_at) < Date.now()) return "expired";
  return invitation.status || "pending";
}

async function recordProfessionalWorkflowAudit({
  action,
  actorRole,
  assignmentId,
  consentId,
  dataClasses,
  healthProfileId,
  metadata,
  route,
  supabase,
  userId,
  workspaceId,
}: {
  action: "assign" | "authorize" | "break_glass" | "download" | "export" | "revoke" | "update" | "view";
  actorRole?: string | null;
  assignmentId?: string | null;
  consentId?: string | null;
  dataClasses: ProfessionalDataClass[];
  healthProfileId?: string | null;
  metadata?: Record<string, unknown>;
  route: string;
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}) {
  const { error } = await supabase.from("organization_access_audit_events").insert({
    access_decision: "allowed",
    action,
    actor_role: actorRole || null,
    actor_user_id: userId,
    assignment_id: assignmentId || null,
    consent_id: consentId || null,
    data_classes: dataClasses,
    health_profile_id: healthProfileId || null,
    metadata: metadata || {},
    route,
    workspace_id: workspaceId,
  });

  if (error) throw error;
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
