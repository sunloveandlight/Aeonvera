/**
 * Aeonvera — Shared Coach Types (SINGLE SOURCE OF TRUTH)
 * ------------------------------------------------------
 * Fixes cross-engine type mismatches
 */

export type CoachIntensity = "low" | "medium" | "high" | "silent";

export type CoachMode =
  | "silent"
  | "dashboard"
  | "notification"
  | "conversation";

export type CoachTrigger = {
  shouldTrigger: boolean;
  intensity: CoachIntensity;
  mode: CoachMode;
  selectedInterventions: unknown[];
};
