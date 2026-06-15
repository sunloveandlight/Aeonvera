export const VOICE_OPTIONS = [
  { id: "marin", label: "Marin", tone: "Warm, calm, premium" },
  { id: "cedar", label: "Cedar", tone: "Grounded and steady" },
  { id: "alloy", label: "Alloy", tone: "Clear and neutral" },
  { id: "verse", label: "Verse", tone: "Expressive and conversational" },
  { id: "shimmer", label: "Shimmer", tone: "Bright and light" },
] as const;

export type VoiceId = (typeof VOICE_OPTIONS)[number]["id"];

export type CommandMessage = {
  content: string;
  role: "assistant" | "user";
};

export type ActionType =
  | "action_error"
  | "billing"
  | "checkout"
  | "create_care_invite"
  | "create_physician_share"
  | "generate_report"
  | "navigation"
  | "open_care_network"
  | "open_oura"
  | "plan_change"
  | "plan_options"
  | "prepare_today"
  | "simplify_plan"
  | "sync_oura";

export type ActionReceipt = {
  actionType: ActionType;
  createdAt: number;
  detail: string;
  id: string;
  title: string;
  tone: "caution" | "info" | "success";
};

export type ActivityEventRow = {
  action_type?: string;
  created_at?: string;
  detail?: string;
  id?: string;
  title?: string;
  tone?: string;
};

export type PlanId = "core" | "elite" | "sovereign";
export type CareRole = "coach" | "family" | "physician";

export type ControlIntent =
  | {
      type: "create_physician_share";
      expiresInDays?: number;
      includedSections?: string[];
      recipientEmail?: string;
      recipientLabel?: string;
    }
  | { type: "generate_report" }
  | {
      type: "manage_care_network";
      email?: string;
      expiresInDays?: number;
      memberName?: string;
      permissions?: string[];
      role?: CareRole;
    }
  | { type: "open_oura" }
  | { type: "prepare_today" }
  | { type: "simplify_plan" }
  | { type: "sync_oura" };

export type ConfirmationIntent = Extract<
  ControlIntent,
  { type: "create_physician_share" | "manage_care_network" }
>;

export type PlanIntent = {
  direction: "change" | "downgrade" | "upgrade";
  targetPlan: PlanId | null;
};

export type PlannerAction =
  | { kind: "answer"; text: string }
  | { intent: ControlIntent; kind: "control" }
  | { intent: PlanIntent; kind: "plan" }
  | { href: string; kind: "navigation"; label: string };

export type PlannerResult = {
  action?: PlannerAction | null;
  confidence?: number;
  handled?: boolean;
  message?: string;
  tool?: {
    confirmationRequired?: boolean;
    id?: string;
    label?: string;
    minimumPlan?: string;
    risk?: string;
  } | null;
};

export type PendingRealtimeAction =
  | { intent: ControlIntent; type: "control" }
  | { intent: ControlIntent; type: "execute_control" }
  | { intent: PlanIntent; type: "plan" }
  | { href: string; label: string; type: "navigation" };

export type RealtimeEvent = {
  error?: { message?: string };
  transcript?: string;
  type?: string;
};

export const DEFAULT_VOICE: VoiceId = "marin";

export const HIDDEN_ROUTES = [
  "/care-network/",
  "/future-self/",
  "/login",
  "/physician-share/",
  "/privacy",
  "/terms",
];

export const STARTER_PROMPTS = [
  "Prepare my highest-leverage plan for today",
  "Show me the next health signal that matters",
  "Help me upgrade or change my membership",
];

export const PLAN_ORDER: PlanId[] = ["core", "elite", "sovereign"];

export const PLAN_LABEL: Record<PlanId, string> = {
  core: "Core",
  elite: "Elite",
  sovereign: "Sovereign",
};

export const NAVIGATION_INTENTS = [
  {
    href: "/companion",
    label: "Ask Aeonvera",
    pattern: /\b(ask|companion|coach|chat|talk|voice)\b/i,
  },
  {
    href: "/dashboard",
    label: "Today",
    pattern: /\b(dashboard|home|overview|today|command center)\b/i,
  },
  {
    href: "/digital-twin",
    label: "Digital Twin",
    pattern: /\b(digital twin|twin|simulation|timeline|future model)\b/i,
  },
  {
    href: "/life-os",
    label: "Life OS",
    pattern: /\b(life os|life operating system|purpose|productivity|trajectory)\b/i,
  },
  {
    href: "/plan",
    label: "Your Plan",
    pattern: /\b(plan|subscription|usage|membership|tier)\b/i,
  },
  {
    href: "/pricing",
    label: "Pricing",
    pattern: /\b(upgrade|downgrade|pricing|price|sovereign|elite|core|billing)\b/i,
  },
  {
    href: "/data-sources",
    label: "Data Sources",
    pattern: /\b(oura|whoop|wearable|device|data source|connect)\b/i,
  },
  {
    href: "/physician-export",
    label: "Physician Export",
    pattern: /\b(doctor|physician|clinician|clinical export|medical share)\b/i,
  },
  {
    href: "/network",
    label: "Care Network",
    pattern: /\b(care network|family|coach invite|invite)\b/i,
  },
  {
    href: "/report",
    label: "Report",
    pattern: /\b(report|longevity report|biological age report)\b/i,
  },
];
