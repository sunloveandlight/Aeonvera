import type { Feature, Plan } from "@/lib/auth/permissions";

export type CommandOrbToolRisk = "low" | "medium" | "high";

export type CommandOrbTool = {
  confirmationRequired: boolean;
  description: string;
  feature?: Feature;
  id: CommandOrbToolId;
  label: string;
  minimumPlan: Plan;
  risk: CommandOrbToolRisk;
};

export const COMMAND_ORB_TOOLS = [
  {
    confirmationRequired: true,
    description: "Create a secure, expiring physician share link with selected clinical sections.",
    feature: "physician_exports",
    id: "create_physician_share_link",
    label: "Create physician share link",
    minimumPlan: "sovereign",
    risk: "high",
  },
  {
    confirmationRequired: true,
    description: "Invite a physician, coach, or family member into the user's care network.",
    feature: "physician_exports",
    id: "create_care_network_invite",
    label: "Create care-network invite",
    minimumPlan: "sovereign",
    risk: "high",
  },
  {
    confirmationRequired: false,
    description: "Sync Oura to refresh sleep, readiness, and recovery signals.",
    feature: "elite_features",
    id: "sync_oura",
    label: "Sync Oura",
    minimumPlan: "elite",
    risk: "medium",
  },
  {
    confirmationRequired: false,
    description: "Open the wearable source connection area.",
    feature: "elite_features",
    id: "connect_oura",
    label: "Connect Oura",
    minimumPlan: "elite",
    risk: "low",
  },
  {
    confirmationRequired: false,
    description: "Generate a longevity report from the user's available data.",
    id: "generate_longevity_report",
    label: "Generate longevity report",
    minimumPlan: "core",
    risk: "medium",
  },
  {
    confirmationRequired: false,
    description: "Prepare or refresh the user's daily execution plan.",
    feature: "autopilot_calendar",
    id: "prepare_daily_plan",
    label: "Prepare daily plan",
    minimumPlan: "elite",
    risk: "medium",
  },
  {
    confirmationRequired: false,
    description: "Reduce the daily plan to the highest-leverage actions.",
    feature: "autopilot_calendar",
    id: "simplify_daily_plan",
    label: "Simplify daily plan",
    minimumPlan: "elite",
    risk: "low",
  },
  {
    confirmationRequired: false,
    description: "Open Stripe billing management for an active subscription.",
    id: "open_billing",
    label: "Open billing",
    minimumPlan: "core",
    risk: "medium",
  },
  {
    confirmationRequired: false,
    description: "Open Stripe Checkout or billing management for a plan change.",
    id: "change_plan",
    label: "Change plan",
    minimumPlan: "core",
    risk: "medium",
  },
  {
    confirmationRequired: false,
    description: "Explain the current page and the most useful available actions.",
    id: "explain_current_page",
    label: "Explain current page",
    minimumPlan: "core",
    risk: "low",
  },
  {
    confirmationRequired: false,
    description: "Summarize what Aeonvera knows about the signed-in user.",
    id: "summarize_user_state",
    label: "Summarize user state",
    minimumPlan: "core",
    risk: "low",
  },
  {
    confirmationRequired: false,
    description: "Choose the highest-leverage next action from the user's current state.",
    id: "recommend_next_action",
    label: "Recommend next action",
    minimumPlan: "core",
    risk: "low",
  },
] as const satisfies readonly CommandOrbTool[];

export type CommandOrbToolId =
  | "change_plan"
  | "connect_oura"
  | "create_care_network_invite"
  | "create_physician_share_link"
  | "explain_current_page"
  | "generate_longevity_report"
  | "open_billing"
  | "prepare_daily_plan"
  | "recommend_next_action"
  | "simplify_daily_plan"
  | "summarize_user_state"
  | "sync_oura";

export function getCommandOrbTool(id: CommandOrbToolId) {
  return COMMAND_ORB_TOOLS.find((tool) => tool.id === id) || null;
}

export function getCommandOrbToolMeta(id: CommandOrbToolId) {
  const tool = getCommandOrbTool(id);
  if (!tool) return null;

  return {
    confirmationRequired: tool.confirmationRequired,
    id: tool.id,
    label: tool.label,
    minimumPlan: tool.minimumPlan,
    risk: tool.risk,
  };
}
