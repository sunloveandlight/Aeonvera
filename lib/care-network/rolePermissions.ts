import {
  DEFAULT_PHYSICIAN_EXPORT_SECTIONS,
  normalizeSections,
  type PhysicianExportSection,
} from "@/lib/digital-twin/physicianExportBundle";

export type CareNetworkRole = "physician" | "coach" | "family";

export const CARE_ROLE_PERMISSIONS: Record<CareNetworkRole, PhysicianExportSection[]> = {
  physician: DEFAULT_PHYSICIAN_EXPORT_SECTIONS,
  coach: ["snapshot", "protocols", "outcomes", "wearables"],
  family: ["snapshot", "biological_age", "protocols"],
};

export function sanitizeCareRole(value: unknown): CareNetworkRole {
  return value === "coach" || value === "family" || value === "physician"
    ? value
    : "physician";
}

export function permissionsForCareRole({
  requested,
  role,
}: {
  requested: unknown;
  role: CareNetworkRole;
}) {
  const allowed = new Set(CARE_ROLE_PERMISSIONS[role]);
  const requestedSections = normalizeSections(
    Array.isArray(requested) ? requested : CARE_ROLE_PERMISSIONS[role]
  );
  const scoped = requestedSections.filter((section) => allowed.has(section));

  return scoped.length ? scoped : CARE_ROLE_PERMISSIONS[role];
}
