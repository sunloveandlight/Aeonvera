import { NextResponse } from "next/server";
import { runCoachPipeline } from "@/lib/coach/runCoachPipeline";

/**
 * Aeonvera Daily Automation Job
 * -----------------------------
 * This runs without user interaction.
 *
 * Purpose:
 * - Scan all users
 * - Run health intelligence
 * - Generate alerts proactively
 *
 * This is the first step toward "AI that contacts users first"
 */

export async function GET() {
  try {
    // 1. Fetch all users with health data
    // NOTE: In V1 we assume metrics table contains all user_ids
    const supabase = (await import("@/lib/supabase/admin")).supabase;

    const { data: users, error } = await supabase
      .from("metrics")
      .select("user_id");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    // 2. Extract unique user IDs
    const uniqueUsers = [...new Set(users.map((u) => u.user_id))];

    let processed = 0;

    // 3. Run coach pipeline for each user
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}