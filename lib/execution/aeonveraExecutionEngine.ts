/**
 * Aeonvera — Execution Layer Engine (STEP 33)
 * ------------------------------------------
 * Turns decisions into real system actions
 */

import { supabase } from "@/lib/supabase/client";

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
    await storeEvent(userId, item);

    if (shouldNotify(item)) {
      await triggerNotification(userId, item);
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
async function storeEvent(userId: string, item: ExecutionItem) {
  const { error } = await supabase.from("behavior_events").insert({
    user_id: userId,
    type: item.type,
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
 * NOTIFICATION SIMULATION LAYER
 * (Replace later with real push/email/SMS system)
 * =========================
 */
async function triggerNotification(userId: string, item: ExecutionItem) {
  console.log("[NOTIFY]", {
    userId,
    title: `${item.domain.toUpperCase()} ALERT`,
    message: item.reason,
    action: item.action,
  });

  // placeholder for:
  // - push notifications
  // - email system
  // - SMS
  // - in-app feed
}