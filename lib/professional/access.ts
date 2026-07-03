import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFESSIONAL_DATA_CLASSES = [
  "identity",
  "administrative",
  "readiness",
  "performance",
  "nutrition",
  "clinical_summary",
  "labs_basic",
  "labs_sensitive",
  "mental_health",
  "documents",
  "notes",
] as const;

export type ProfessionalDataClass = (typeof PROFESSIONAL_DATA_CLASSES)[number];

export type ProfessionalRole =
  | "owner"
  | "admin"
  | "org_admin"
  | "clinician"
  | "trainer"
  | "coach"
  | "front_desk"
  | "auditor"
  | "read_only";

export type ProfessionalAccessAction =
  | "view"
  | "export"
  | "download"
  | "update"
  | "assign"
  | "revoke"
  | "break_glass"
  | "authorize";

export type ProfessionalAccessDecision = {
  allowed: boolean;
  accessDecision: "allowed" | "denied" | "redacted";
  allowedDataClasses: ProfessionalDataClass[];
  redactedDataClasses: ProfessionalDataClass[];
  role: ProfessionalRole | null;
  consentId?: string;
  assignmentId?: string;
  reason?: string;
};

type WorkspaceRow = {
  status?: string | null;
  workspace_type?: string | null;
};

type WorkspaceMemberRow = {
  role?: string | null;
  status?: string | null;
};

type HealthProfileRow = {
  status?: string | null;
  workspace_id?: string | null;
};

export type ProfessionalAssignment = {
  id: string;
  role: ProfessionalRole;
  data_classes: string[] | null;
  starts_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
};

export type ProfessionalConsent = {
  id: string;
  allowed_roles: string[] | null;
  data_classes: string[] | null;
  starts_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
};

export type ComputeProfessionalAccessInput = {
  action: ProfessionalAccessAction;
  assignments: ProfessionalAssignment[];
  consents: ProfessionalConsent[];
  memberRole: ProfessionalRole | null;
  requestedDataClasses: ProfessionalDataClass[];
  now?: Date;
  workspaceActive: boolean;
  workspaceType: string | null;
  profileActive: boolean;
  profileWorkspaceMatches: boolean;
};

export type AuthorizeProfessionalAccessInput = {
  action: ProfessionalAccessAction;
  actorUserId: string;
  healthProfileId: string;
  requestedDataClasses: ProfessionalDataClass[];
  route?: string;
  supabase: SupabaseClient;
  workspaceId: string;
};

const ADMIN_ROLES = new Set<ProfessionalRole>(["owner", "admin", "org_admin"]);
const ADMIN_ROSTER_CLASSES = new Set<ProfessionalDataClass>(["identity", "administrative"]);

export function isProfessionalDataClass(value: string): value is ProfessionalDataClass {
  return (PROFESSIONAL_DATA_CLASSES as readonly string[]).includes(value);
}

export function normalizeProfessionalDataClasses(
  values: readonly string[]
): ProfessionalDataClass[] {
  return Array.from(new Set(values.filter(isProfessionalDataClass)));
}

export function computeProfessionalAccessDecision({
  action,
  assignments,
  consents,
  memberRole,
  now = new Date(),
  profileActive,
  profileWorkspaceMatches,
  requestedDataClasses,
  workspaceActive,
  workspaceType,
}: ComputeProfessionalAccessInput): ProfessionalAccessDecision {
  const requested = normalizeProfessionalDataClasses(requestedDataClasses);

  if (!requested.length) {
    return denied(memberRole, "No valid data classes requested.");
  }

  if (workspaceType !== "organization" || !workspaceActive) {
    return denied(memberRole, "Workspace is not an active organization.");
  }

  if (!profileActive || !profileWorkspaceMatches) {
    return denied(memberRole, "Health profile is not active in this organization.");
  }

  if (!memberRole) {
    return denied(null, "Actor is not an active organization member.");
  }

  if (ADMIN_ROLES.has(memberRole) && requested.every((item) => ADMIN_ROSTER_CLASSES.has(item))) {
    return {
      allowed: true,
      accessDecision: "allowed",
      allowedDataClasses: requested,
      redactedDataClasses: [],
      role: memberRole,
    };
  }

  if ((action === "assign" || action === "revoke") && ADMIN_ROLES.has(memberRole)) {
    return {
      allowed: true,
      accessDecision: "allowed",
      allowedDataClasses: requested,
      redactedDataClasses: [],
      role: memberRole,
    };
  }

  const activeAssignments = assignments.filter((assignment) => isActiveWindow(assignment, now));
  const activeConsents = consents.filter((consent) => isActiveWindow(consent, now));
  const allowed = new Set<ProfessionalDataClass>();
  let assignmentId: string | undefined;
  let consentId: string | undefined;

  for (const assignment of activeAssignments) {
    const assignmentClasses = normalizeProfessionalDataClasses(assignment.data_classes || []);

    for (const consent of activeConsents) {
      if (!(consent.allowed_roles || []).includes(assignment.role)) continue;

      const consentClasses = normalizeProfessionalDataClasses(consent.data_classes || []);
      const shared = requested.filter(
        (item) => assignmentClasses.includes(item) && consentClasses.includes(item)
      );

      if (shared.length) {
        assignmentId ||= assignment.id;
        consentId ||= consent.id;
        shared.forEach((item) => allowed.add(item));
      }
    }
  }

  const allowedDataClasses = requested.filter((item) => allowed.has(item));
  const redactedDataClasses = requested.filter((item) => !allowed.has(item));

  if (!allowedDataClasses.length) {
    return denied(memberRole, "No active assignment and consent covers the requested data classes.");
  }

  return {
    allowed: redactedDataClasses.length === 0,
    accessDecision: redactedDataClasses.length ? "redacted" : "allowed",
    allowedDataClasses,
    redactedDataClasses,
    role: memberRole,
    assignmentId,
    consentId,
  };
}

export async function authorizeProfessionalProfileAccess({
  action,
  actorUserId,
  healthProfileId,
  requestedDataClasses,
  route,
  supabase,
  workspaceId,
}: AuthorizeProfessionalAccessInput): Promise<ProfessionalAccessDecision> {
  const now = new Date();
  const [workspaceResult, memberResult, profileResult, assignmentResult, consentResult] =
    await Promise.all([
      supabase
        .from("workspaces")
        .select("workspace_type,status")
        .eq("id", workspaceId)
        .maybeSingle<WorkspaceRow>(),
      supabase
        .from("workspace_members")
        .select("role,status")
        .eq("workspace_id", workspaceId)
        .eq("user_id", actorUserId)
        .maybeSingle<WorkspaceMemberRow>(),
      supabase
        .from("health_profiles")
        .select("workspace_id,status")
        .eq("id", healthProfileId)
        .maybeSingle<HealthProfileRow>(),
      supabase
        .from("organization_profile_assignments")
        .select("id,role,data_classes,starts_at,expires_at,revoked_at")
        .eq("workspace_id", workspaceId)
        .eq("health_profile_id", healthProfileId)
        .eq("staff_user_id", actorUserId),
      supabase
        .from("organization_profile_consents")
        .select("id,allowed_roles,data_classes,starts_at,expires_at,revoked_at")
        .eq("workspace_id", workspaceId)
        .eq("health_profile_id", healthProfileId),
    ]);

  const memberRole = normalizeRole(memberResult.data?.status === "active" ? memberResult.data.role : null);
  const decision = computeProfessionalAccessDecision({
    action,
    assignments: normalizeAssignments(assignmentResult.data || []),
    consents: normalizeConsents(consentResult.data || []),
    memberRole,
    now,
    profileActive: profileResult.data?.status === "active",
    profileWorkspaceMatches: profileResult.data?.workspace_id === workspaceId,
    requestedDataClasses,
    workspaceActive: workspaceResult.data?.status === "active",
    workspaceType: workspaceResult.data?.workspace_type || null,
  });

  const auditError = await recordProfessionalAccessAudit({
    action,
    actorRole: decision.role,
    actorUserId,
    assignmentId: decision.assignmentId,
    consentId: decision.consentId,
    dataClasses: decision.allowedDataClasses,
    decision: decision.accessDecision,
    healthProfileId,
    route,
    supabase,
    workspaceId,
  });

  if (auditError && decision.allowed) {
    return denied(decision.role, "Professional access audit could not be recorded.");
  }

  return decision;
}

async function recordProfessionalAccessAudit({
  action,
  actorRole,
  actorUserId,
  assignmentId,
  consentId,
  dataClasses,
  decision,
  healthProfileId,
  route,
  supabase,
  workspaceId,
}: {
  action: ProfessionalAccessAction;
  actorRole: ProfessionalRole | null;
  actorUserId: string;
  assignmentId?: string;
  consentId?: string;
  dataClasses: ProfessionalDataClass[];
  decision: ProfessionalAccessDecision["accessDecision"];
  healthProfileId: string;
  route?: string;
  supabase: SupabaseClient;
  workspaceId: string;
}) {
  const { error } = await supabase.from("organization_access_audit_events").insert({
    access_decision: decision,
    action,
    actor_role: actorRole,
    actor_user_id: actorUserId,
    assignment_id: assignmentId || null,
    consent_id: consentId || null,
    data_classes: dataClasses,
    health_profile_id: healthProfileId,
    route: route || null,
    workspace_id: workspaceId,
  });

  return error || null;
}

function denied(
  role: ProfessionalRole | null,
  reason: string
): ProfessionalAccessDecision {
  return {
    allowed: false,
    accessDecision: "denied",
    allowedDataClasses: [],
    redactedDataClasses: [],
    role,
    reason,
  };
}

function isActiveWindow(
  row: { starts_at?: string | null; expires_at?: string | null; revoked_at?: string | null },
  now: Date
) {
  if (row.revoked_at) return false;
  if (row.starts_at && new Date(row.starts_at) > now) return false;
  if (row.expires_at && new Date(row.expires_at) <= now) return false;
  return true;
}

function normalizeRole(value: string | null | undefined): ProfessionalRole | null {
  if (!value) return null;
  const roles: ProfessionalRole[] = [
    "owner",
    "admin",
    "org_admin",
    "clinician",
    "trainer",
    "coach",
    "front_desk",
    "auditor",
    "read_only",
  ];
  return roles.includes(value as ProfessionalRole) ? (value as ProfessionalRole) : null;
}

function normalizeAssignments(rows: unknown[]): ProfessionalAssignment[] {
  return rows
    .map((row) => row as Partial<ProfessionalAssignment>)
    .filter((row): row is ProfessionalAssignment => Boolean(row.id && normalizeRole(row.role)));
}

function normalizeConsents(rows: unknown[]): ProfessionalConsent[] {
  return rows
    .map((row) => row as Partial<ProfessionalConsent>)
    .filter((row): row is ProfessionalConsent => Boolean(row.id));
}
