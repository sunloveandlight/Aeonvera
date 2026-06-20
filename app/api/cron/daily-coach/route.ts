import { NextResponse } from "next/server";
import { runMorningAutopilotBrief } from "@/lib/autopilot/morningAutopilot";
import { runCoachPipeline } from "@/lib/coach/runCoachPipeline";
import { runProactiveClinicalFollowUps } from "@/lib/clinical/proactiveClinicalFollowUps";
import { runProactiveDataSourceFollowUps } from "@/lib/data/proactiveDataSourceFollowUps";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createLegacyActiveHealthProfileContext,
  type ActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";

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
    const [
      { data: healthUsers, error },
      { data: protocolUsers },
      { data: autopilotUsers },
      { data: clinicalUsers, error: clinicalUsersError },
      { data: wearableUsers, error: wearableUsersError },
      { data: labUsers, error: labUsersError },
    ] =
      await Promise.all([
        supabase
          .from("health_states")
          .select("user_id,health_profile_id"),
        supabase
          .from("optimization_protocols")
          .select("user_id,health_profile_id")
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("autopilot_preferences")
          .select("user_id,health_profile_id")
          .limit(5000),
        supabase
          .from("clinical_insights")
          .select("user_id,health_profile_id")
          .in("concern_status", ["active", "unresolved", "monitoring"])
          .limit(5000),
        supabase
          .from("wearable_metrics")
          .select("user_id,health_profile_id")
          .limit(5000),
        supabase
          .from("lab_biomarkers")
          .select("user_id,health_profile_id")
          .limit(5000),
      ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = [
      ...(healthUsers || []),
      ...(protocolUsers || []),
      ...(autopilotUsers || []),
      ...(!clinicalUsersError ? clinicalUsers || [] : []),
      ...(!wearableUsersError ? wearableUsers || [] : []),
      ...(!labUsersError ? labUsers || [] : []),
    ];

    if (!users.length) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    /**
     * STEP 2: DEDUPLICATE USER/PROFILE WORK ITEMS
     */
    const workItems = buildProfileWorkItems(users);

    let processed = 0;
    let autopilotPrepared = 0;
    let autopilotSkipped = 0;
    let clinicalFollowUpsSent = 0;
    let clinicalFollowUpsSkipped = 0;
    let dataSourceFollowUpsSent = 0;
    let dataSourceFollowUpsSkipped = 0;

    /**
     * STEP 3: RUN COACH PIPELINE PER USER/PROFILE
     */
    for (const item of workItems) {
      const { userId, healthProfileContext } = item;
      try {
        await runCoachPipeline(userId, healthProfileContext);
      } catch (err) {
        console.error(`Coach failed for user ${userId}`, err);
      }

      try {
        const autopilot = await runMorningAutopilotBrief({
          supabase,
          userId,
          healthProfileContext,
        });
        if (autopilot.status === "prepared") {
          autopilotPrepared++;
        } else {
          autopilotSkipped++;
        }
      } catch (err) {
        autopilotSkipped++;
        console.error(`Morning Autopilot failed for user ${userId}`, err);
      }

      try {
        const clinicalFollowUp = await runProactiveClinicalFollowUps({
          supabase,
          userId,
          healthProfileContext,
        });
        if (clinicalFollowUp.status === "sent") {
          clinicalFollowUpsSent++;
        } else {
          clinicalFollowUpsSkipped++;
        }
      } catch (err) {
        clinicalFollowUpsSkipped++;
        console.error(`Clinical follow-up failed for user ${userId}`, err);
      }

      try {
        const dataSourceFollowUp = await runProactiveDataSourceFollowUps({
          supabase,
          userId,
          healthProfileContext,
        });
        if (dataSourceFollowUp.status === "sent") {
          dataSourceFollowUpsSent++;
        } else {
          dataSourceFollowUpsSkipped++;
        }
      } catch (err) {
        dataSourceFollowUpsSkipped++;
        console.error(`Data source follow-up failed for user ${userId}`, err);
      }

      processed++;
    }

    return NextResponse.json({
      success: true,
      processed,
      users: new Set(workItems.map((item) => item.userId)).size,
      profiles: workItems.length,
      autopilot_prepared: autopilotPrepared,
      autopilot_skipped: autopilotSkipped,
      clinical_followups_sent: clinicalFollowUpsSent,
      clinical_followups_skipped: clinicalFollowUpsSkipped,
      data_source_followups_sent: dataSourceFollowUpsSent,
      data_source_followups_skipped: dataSourceFollowUpsSkipped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildProfileWorkItems(
  rows: Array<{ user_id?: string | null; health_profile_id?: string | null }>
) {
  const items = new Map<
    string,
    { userId: string; healthProfileContext: ActiveHealthProfileContext }
  >();

  for (const row of rows) {
    if (!row.user_id) continue;
    const key = `${row.user_id}:${row.health_profile_id || "legacy"}`;
    if (items.has(key)) continue;

    items.set(key, {
      userId: row.user_id,
      healthProfileContext: row.health_profile_id
        ? {
            loginUserId: row.user_id,
            workspaceId: null,
            healthProfileId: row.health_profile_id,
            legacyUserId: row.user_id,
            mode: "health_profile",
            role: "owner",
          }
        : createLegacyActiveHealthProfileContext(row.user_id),
    });
  }

  return Array.from(items.values());
}
