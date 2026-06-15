import {
  NAVIGATION_INTENTS,
  PLAN_ORDER,
  type CareRole,
  type ConfirmationIntent,
  type ControlIntent,
  type PendingRealtimeAction,
  type PlanId,
  type PlanIntent,
  type PlannerAction,
} from "./config";

export function isPlannerAction(value: unknown): value is PlannerAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<PlannerAction>;

  if (action.kind === "control") {
    return isControlIntent(action.intent);
  }

  if (action.kind === "plan") {
    return isPlanIntent(action.intent);
  }

  if (action.kind === "navigation") {
    return (
      typeof action.href === "string" &&
      action.href.startsWith("/") &&
      typeof action.label === "string"
    );
  }

  if (action.kind === "answer") {
    return typeof action.text === "string";
  }

  return false;
}

export function isControlIntent(value: unknown): value is ControlIntent {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === "create_physician_share" ||
    type === "generate_report" ||
    type === "manage_care_network" ||
    type === "open_oura" ||
    type === "prepare_today" ||
    type === "simplify_plan" ||
    type === "sync_oura"
  );
}

export function isPlanIntent(value: unknown): value is PlanIntent {
  if (!value || typeof value !== "object") return false;
  const intent = value as { direction?: unknown; targetPlan?: unknown };
  return (
    (intent.direction === "change" ||
      intent.direction === "downgrade" ||
      intent.direction === "upgrade") &&
    (intent.targetPlan === null || asPlanId(intent.targetPlan) !== null)
  );
}

export function toPendingRealtimeAction(
  action: Exclude<PlannerAction, { kind: "answer" }>
): PendingRealtimeAction {
  if (action.kind === "control") return { intent: action.intent, type: "control" };
  if (action.kind === "plan") return { intent: action.intent, type: "plan" };
  return {
    href: action.href,
    label: action.label,
    type: "navigation",
  };
}

export function resolvePlanIntent(question: string): PlanIntent | null {
  const text = question.toLowerCase();
  const targetPlan = extractPlanTarget(text);
  const hasBillingIntent =
    /\b(upgrade|downgrade|change|switch|move|subscribe|subscription|billing|membership|plan)\b/.test(text);

  if (!hasBillingIntent && !targetPlan) return null;

  if (/\b(downgrade|lower|cheaper|reduce)\b/.test(text)) {
    return { direction: "downgrade", targetPlan };
  }

  if (/\b(upgrade|higher|sovereign|elite|executive|unlock)\b/.test(text)) {
    return { direction: "upgrade", targetPlan };
  }

  if (targetPlan) {
    return { direction: "change", targetPlan };
  }

  return null;
}

export function resolveControlIntent(question: string): ControlIntent | null {
  const text = question.toLowerCase();

  if (/\b(prepare|build|create|make|refresh)\b.*\b(today|daily|day)\b.*\b(plan|schedule)\b/.test(text)) {
    return { type: "prepare_today" };
  }

  if (/\b(simplify|lighter|less|too much|overwhelming|reduce)\b.*\b(plan|protocol|today|actions?)\b/.test(text)) {
    return { type: "simplify_plan" };
  }

  if (/\b(oura)\b.*\b(sync|refresh|update|pull|import)\b/.test(text)) {
    return { type: "sync_oura" };
  }

  if (/\b(oura)\b.*\b(connect|open|setup|set up)\b/.test(text)) {
    return { type: "open_oura" };
  }

  if (/\b(generate|create|build|make|refresh)\b.*\b(report|longevity report|health report)\b/.test(text)) {
    return { type: "generate_report" };
  }

  if (/\b(physician|doctor|clinician|medical)\b.*\b(share|link|export|send|create)\b/.test(text)) {
    return { type: "create_physician_share" };
  }

  if (/\b(care network|invite|family|coach|physician|doctor)\b.*\b(invite|network|share|access)\b/.test(text)) {
    return {
      email: extractEmail(question),
      role: extractCareRole(text),
      type: "manage_care_network",
    };
  }

  return null;
}

export function requiresConfirmation(intent: ControlIntent): intent is ConfirmationIntent {
  return intent.type === "create_physician_share" || (intent.type === "manage_care_network" && Boolean(intent.email));
}

export function confirmationPromptForIntent(intent: ConfirmationIntent) {
  if (intent.type === "create_physician_share") {
    const sections = intent.includedSections?.length
      ? ` with ${intent.includedSections.map((section) => section.replace(/_/g, " ")).join(", ")}`
      : "";
    const recipient = intent.recipientEmail
      ? ` for ${intent.recipientEmail}`
      : intent.recipientLabel
        ? ` for ${intent.recipientLabel}`
        : "";
    return `I can create a secure physician share link${recipient}${sections}. It expires in ${intent.expiresInDays || 14} days and includes an access code. Should I create it?`;
  }

  if (intent.email) {
    const permissions = intent.permissions?.length
      ? ` with ${intent.permissions.map((permission) => permission.replace(/_/g, " ")).join(", ")}`
      : "";
    return `I can invite ${intent.email} as a ${intent.role || "physician"}${permissions} using a secure ${intent.expiresInDays || 14}-day access link. Should I create the invite?`;
  }

  return "I can open Care Network now. If you want me to create an invite directly, include the person's email address.";
}

export function isConfirmationYes(value: string) {
  return /\b(yes|yeah|yep|confirm|approve|do it|go ahead|create it|send it)\b/i.test(value);
}

export function isConfirmationNo(value: string) {
  return /\b(no|nope|cancel|stop|don't|do not|not now)\b/i.test(value);
}

export function inferPlanTarget(direction: PlanIntent["direction"], currentPlan: PlanId | null) {
  if (!currentPlan) return direction === "downgrade" ? null : "core";

  const index = PLAN_ORDER.indexOf(currentPlan);
  if (direction === "downgrade") return PLAN_ORDER[Math.max(0, index - 1)] || null;
  if (direction === "upgrade") return PLAN_ORDER[Math.min(PLAN_ORDER.length - 1, index + 1)] || null;
  return null;
}

export function asPlanId(value: unknown): PlanId | null {
  return value === "core" || value === "elite" || value === "sovereign" ? value : null;
}

export function resolveNavigationIntent(question: string) {
  if (!/\b(open|show|take me|go to|navigate|bring me|where is|find|upgrade|downgrade)\b/i.test(question)) {
    return null;
  }

  return NAVIGATION_INTENTS.find((intent) => intent.pattern.test(question)) || null;
}

function extractPlanTarget(text: string): PlanId | null {
  if (/\bsovereign|soverign|soverigne|executive\b/.test(text)) return "sovereign";
  if (/\belite|optimization\b/.test(text)) return "elite";
  if (/\bcore|basic|starter|baseline\b/.test(text)) return "core";
  return null;
}

function extractCareRole(text: string): CareRole | undefined {
  if (/\b(coach|trainer|accountability)\b/.test(text)) return "coach";
  if (/\b(family|partner|spouse|wife|husband|parent|sibling)\b/.test(text)) return "family";
  if (/\b(doctor|physician|clinician|medical)\b/.test(text)) return "physician";
  return undefined;
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
}
