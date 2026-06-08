import { NextResponse } from "next/server";
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
     * STEP 1: GET USERS FROM HEALTH STATES
     */
    const { data: users, error } = await supabase
      .from("health_states")
      .select("user_id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!users?.length) {
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

    /**
     * STEP 3: RUN COACH PIPELINE PER USER
     */
    for (const userId of uniqueUsers) {
      try {
        await runCoachPipeline(userId);
        processed++;
      } catch (err) {
        console.error(`Coach failed for user ${userId}`, err);
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      users: uniqueUsers.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}