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
  "/pricing",
  "/privacy",
  "/terms",
];

export const STARTER_PROMPTS = [
  "Prepare my highest-leverage plan for today",
  "Show me the next health signal that matters",
  "Help me upgrade or change my membership",
];

export const ROUTE_CONTEXTS = [
  {
    match: "/dashboard",
    label: "Today",
    detail: "I can prepare your next step, simplify the day, or open the advanced health console.",
    prompts: [
      "What should I focus on today?",
      "Simplify today’s plan",
      "Refresh my latest health signal",
    ],
  },
  {
    match: "/digital-twin",
    label: "Digital Twin",
    detail: "I can explain recent signals, generate a report, or prepare a physician share.",
    prompts: [
      "Explain my newest model signal",
      "Create a physician share link",
      "Generate my latest report",
    ],
  },
  {
    match: "/pricing",
    label: "Membership",
    detail: "I can help compare plans, upgrade, downgrade, or open billing safely.",
    prompts: [
      "Help me choose the right plan",
      "Upgrade me to Sovereign",
      "Show me downgrade options",
    ],
  },
  {
    match: "/settings",
    label: "Settings",
    detail: "I can help with voice, privacy, connected data, notifications, and billing.",
    prompts: [
      "Change my voice",
      "Open my data sources",
      "Review privacy sharing",
    ],
  },
  {
    match: "/data-sources",
    label: "Data Sources",
    detail: "I can open Oura, sync wearables, or point out the highest-value missing source.",
    prompts: [
      "Sync my Oura data",
      "Open data sources",
      "What data is missing?",
    ],
  },
  {
    match: "/network",
    label: "Care Network",
    detail: "I can create care-network invites or explain who has access.",
    prompts: [
      "Invite my physician",
      "Create a coach invite",
      "Open care network",
    ],
  },
  {
    match: "/companion",
    label: "Ask",
    detail: "I can answer health questions, remember preferences, and move through Aeonvera.",
    prompts: [
      "What changed since last time?",
      "Prepare my plan",
      "Explain my next best move",
    ],
  },
  {
    match: "/plan",
    label: "Plan",
    detail: "I can simplify, explain, or move you to plan and billing controls.",
    prompts: [
      "Simplify my plan",
      "What should I do first?",
      "Change my membership",
    ],
  },
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
