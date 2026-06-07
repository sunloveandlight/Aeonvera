import { NextResponse } from "next/server";
import { runCoachPipeline } from "@/lib/coach/runCoachPipeline";
import { supabase } from "@/lib/supabase/admin";

/**
 * Aeonvera Daily Automation Job
 * -----------------------------
 * Runs automatically and generates coaching alerts
 * for all users with health data.
 */
export async function GET() {
  try {
    /**
     * STEP 1: GET USERS FROM HEALTH STATES (NOT METRICS)
     * This ensures we only process users who have a computed health state.
     */
    const { data: users, error } = await supabase
      .from("health_states")
      .select("user_id");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!users?.length) {
      return NextResponse.json({
        success: true,
        processed: 0,
      });
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
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}