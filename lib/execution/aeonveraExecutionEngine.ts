import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ExecutionItem = {
  type: "immediate" | "proactive";
  domain: string;
  action: string;
  reason?: string;
  priority: number;
};

export type ExecutionResult = {
  executed: boolean;
  stored: boolean;
  notificationsTriggered: number;
};

/**
 * =========================
 * MAIN ENTRY
 * =========================
 */
export async function executeAeonveraActions(params: {
  userId: string;
  priorityQueue: ExecutionItem[];
}) {
  const { userId, priorityQueue } = params;
  const supabase = getSupabaseAdmin();

  let notificationsTriggered = 0;

  /**
   * STEP 1 — SORT BY PRIORITY
   */
  const sorted = [...priorityQueue].sort(
    (a, b) => b.priority - a.priority
  );

  /**
   * STEP 2 — EXECUTE EACH ITEM
   */
  for (const item of sorted) {
    await storeEvent(supabase, userId, item);

    if (shouldNotify(item)) {
      await triggerNotification(supabase, userId, item);
      notificationsTriggered++;
    }
  }

  return {
    executed: true,
    stored: true,
    notificationsTriggered,
  };
}

/**
 * =========================
 * STORE INTO SUPABASE EVENTS
 * =========================
 */
async function storeEvent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  item: ExecutionItem
) {
  const { error } = await supabase.from("behavior_events").insert({
    user_id: userId,
    type: item.type,
    event_type: item.type,
    domain: item.domain,
    action: item.action,
    reason: item.reason,
    priority: item.priority,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[Execution Store Error]", error.message);
  }
}

/**
 * =========================
 * NOTIFICATION RULE ENGINE
 * =========================
 */
function shouldNotify(item: ExecutionItem): boolean {
  /**
   * Only high priority or immediate actions trigger notifications
   */
  if (item.type === "immediate" && item.priority >= 8) return true;
  if (item.type === "proactive" && item.priority >= 85) return true;

  return false;
}

/**
 * =========================
 * IN-APP EXECUTION NOTIFICATION
 * =========================
 */
async function triggerNotification(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  item: ExecutionItem
) {
  const title = `${item.domain.toUpperCase()} ALERT`;
  const message = item.reason || item.action;

  const { error } = await supabase.from("notification_deliveries").insert({
    user_id: userId,
    channel: "in_app",
    status: "pending",
    title,
    message,
    payload: {
      domain: item.domain,
      action: item.action,
      priority: item.priority,
      type: item.type,
    },
  });

  if (error) {
    console.error("[Execution Notification Error]", error.message);
  }
}
