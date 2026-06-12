import { NextResponse } from "next/server";
import { runMorningAutopilotBrief } from "@/lib/autopilot/morningAutopilot";
import { runCoachPipeline } from "@/lib/coach/runCoachPipeline";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Aeonvera Daily Automation Job
 * -----------------------------
 * Runs automatically via Vercel cron at 9am UTC daily.
 *
 * SECURITY: requires CRON_SECRET header to prevent
 * unauthorized triggering of the pipeline.
 */
export async function GET(req: Request) {
  /**
   * STEP 0 — VERIFY CRON SECRET
   * Add CRON_SECRET to your environment variables.
   * Vercel automatically sends this header for cron jobs
   * when configured in vercel.json.
   */
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET environment variable is not set.");
    return NextResponse.json(
      { error: "Cron not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    /**
     * STEP 1: GET USERS WITH HEALTH, PROTOCOL, OR AUTOPILOT CONTEXT
     */
    const [{ data: healthUsers, error }, { data: protocolUsers }, { data: autopilotUsers }] =
      await Promise.all([
        supabase
          .from("health_states")
          .select("user_id"),
        supabase
          .from("optimization_protocols")
          .select("user_id")
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("autopilot_preferences")
          .select("user_id")
          .limit(5000),
      ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = [
      ...(healthUsers || []),
      ...(protocolUsers || []),
      ...(autopilotUsers || []),
    ];

    if (!users.length) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    /**
     * STEP 2: DEDUPLICATE USERS
     */
    const uniqueUsers: string[] = [
      ...new Set(
        users
          .map((u) => u.user_id)
          .filter((id): id is string => typeof id === "string")
      ),
    ];

    let processed = 0;
    let autopilotPrepared = 0;
    let autopilotSkipped = 0;

    /**
     * STEP 3: RUN COACH PIPELINE PER USER
     */
    for (const userId of uniqueUsers) {
      try {
        await runCoachPipeline(userId);
      } catch (err) {
        console.error(`Coach failed for user ${userId}`, err);
      }

      try {
        const autopilot = await runMorningAutopilotBrief({ supabase, userId });
        if (autopilot.status === "prepared") {
          autopilotPrepared++;
        } else {
          autopilotSkipped++;
        }
      } catch (err) {
        autopilotSkipped++;
        console.error(`Morning Autopilot failed for user ${userId}`, err);
      }

      processed++;
    }

    return NextResponse.json({
      success: true,
      processed,
      users: uniqueUsers.length,
      autopilot_prepared: autopilotPrepared,
      autopilot_skipped: autopilotSkipped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
