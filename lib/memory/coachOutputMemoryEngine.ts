import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { JarvisMessage } from "@/lib/voice/jarvisResponseEngine";

export type CoachOutputRecord = {
  userId: string;
  mode: JarvisMessage["mode"];
  tone: JarvisMessage["tone"];
  message: string;
  actions: string[];
  source: "runtime" | "cron" | "assessment" | "system";
  createdAt: string;
};

/**
 * MAIN ENTRY
 */
export async function storeCoachOutput(record: CoachOutputRecord) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("coach_outputs").insert({
    user_id: record.userId,
    mode: record.mode,
    tone: record.tone,
    message: record.message,
    actions: record.actions,
    source: record.source,
    created_at: record.createdAt,
  });

  if (error) {
    console.error("Failed to store coach output:", error.message);
    return {
      status: "error",
      reason: "db_insert_failed",
    };
  }

  return {
    status: "stored",
  };
}