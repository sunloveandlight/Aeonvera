import { expect, test } from "@playwright/test";

import {
  computeProfessionalAccessDecision,
  type ProfessionalAssignment,
  type ProfessionalConsent,
} from "@/lib/professional/access";
import {
  defaultDataClassesForRole,
  sanitizeOrganizationSubtype,
  sanitizeProfessionalDataClassList,
  sanitizeStaffRole,
} from "@/lib/professional/workflow";

const now = new Date("2026-07-03T12:00:00.000Z");

const coachAssignment: ProfessionalAssignment = {
  data_classes: ["identity", "readiness", "performance"],
  id: "assignment-coach",
  role: "coach",
  starts_at: "2026-07-01T00:00:00.000Z",
};

const coachConsent: ProfessionalConsent = {
  allowed_roles: ["coach"],
  data_classes: ["identity", "readiness", "performance"],
  id: "consent-coach",
  starts_at: "2026-07-01T00:00:00.000Z",
};

function baseDecision(overrides: Partial<Parameters<typeof computeProfessionalAccessDecision>[0]> = {}) {
  return computeProfessionalAccessDecision({
    action: "view",
    assignments: [coachAssignment],
    consents: [coachConsent],
    memberRole: "coach",
    now,
    profileActive: true,
    profileWorkspaceMatches: true,
    requestedDataClasses: ["readiness"],
    workspaceActive: true,
    workspaceType: "organization",
    ...overrides,
  });
}

test.describe("Aeonvera Professional access decisions", () => {
  test("allows a coach to read consented readiness data", () => {
    const decision = baseDecision();

    expect(decision).toEqual(
      expect.objectContaining({
        accessDecision: "allowed",
        allowed: true,
        allowedDataClasses: ["readiness"],
        assignmentId: "assignment-coach",
        consentId: "consent-coach",
        role: "coach",
      })
    );
    expect(decision.redactedDataClasses).toEqual([]);
  });

  test("redacts clinical data from a coach even when the coach can see readiness", () => {
    const decision = baseDecision({
      requestedDataClasses: ["readiness", "labs_basic", "mental_health"],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.accessDecision).toBe("redacted");
    expect(decision.allowedDataClasses).toEqual(["readiness"]);
    expect(decision.redactedDataClasses).toEqual(["labs_basic", "mental_health"]);
  });

  test("denies profile data without matching consent", () => {
    const decision = baseDecision({
      consents: [{
        ...coachConsent,
        allowed_roles: ["trainer"],
      }],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.accessDecision).toBe("denied");
    expect(decision.allowedDataClasses).toEqual([]);
  });

  test("denies expired assignments", () => {
    const decision = baseDecision({
      assignments: [{
        ...coachAssignment,
        expires_at: "2026-07-02T00:00:00.000Z",
      }],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.accessDecision).toBe("denied");
  });

  test("allows organization admins to manage roster identity without clinical access", () => {
    const allowed = baseDecision({
      assignments: [],
      consents: [],
      memberRole: "org_admin",
      requestedDataClasses: ["identity", "administrative"],
    });
    const deniedClinical = baseDecision({
      assignments: [],
      consents: [],
      memberRole: "org_admin",
      requestedDataClasses: ["labs_basic"],
    });

    expect(allowed.allowed).toBe(true);
    expect(allowed.allowedDataClasses).toEqual(["identity", "administrative"]);
    expect(deniedClinical.allowed).toBe(false);
  });

  test("denies access when the profile belongs to a different organization", () => {
    const decision = baseDecision({ profileWorkspaceMatches: false });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("Health profile");
  });

  test("sanitizes Professional workflow inputs", () => {
    expect(sanitizeOrganizationSubtype("clinic")).toBe("clinic");
    expect(sanitizeOrganizationSubtype("random")).toBeNull();
    expect(sanitizeStaffRole("coach")).toBe("coach");
    expect(sanitizeStaffRole("owner")).toBeNull();
    expect(sanitizeProfessionalDataClassList([
      "readiness",
      "readiness",
      "labs_basic",
      "unknown",
    ])).toEqual(["readiness", "labs_basic"]);
  });

  test("uses conservative default data classes by role", () => {
    expect(defaultDataClassesForRole("coach")).toEqual([
      "identity",
      "readiness",
      "performance",
    ]);
    expect(defaultDataClassesForRole("front_desk")).toEqual([
      "identity",
      "administrative",
    ]);
    expect(defaultDataClassesForRole("auditor")).toEqual([]);
  });
});
