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

const DAILY_COACH_CONCURRENCY = 5;
const DAILY_COACH_SOURCE_LIMIT = 5000;

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
          .select("user_id,health_profile_id")
          .limit(DAILY_COACH_SOURCE_LIMIT),
        supabase
          .from("optimization_protocols")
          .select("user_id,health_profile_id")
          .order("created_at", { ascending: false })
          .limit(DAILY_COACH_SOURCE_LIMIT),
        supabase
          .from("autopilot_preferences")
          .select("user_id,health_profile_id")
          .limit(DAILY_COACH_SOURCE_LIMIT),
        supabase
          .from("clinical_insights")
          .select("user_id,health_profile_id")
          .in("concern_status", ["active", "unresolved", "monitoring"])
          .limit(DAILY_COACH_SOURCE_LIMIT),
        supabase
          .from("wearable_metrics")
          .select("user_id,health_profile_id")
          .limit(DAILY_COACH_SOURCE_LIMIT),
        supabase
          .from("lab_biomarkers")
          .select("user_id,health_profile_id")
          .limit(DAILY_COACH_SOURCE_LIMIT),
      ]);

    if (error) {
      console.error("[Cron] Health user query failed:", error);
      return NextResponse.json({ error: "Daily coach job failed." }, { status: 500 });
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
    const workItems = await buildProfileWorkItems(users, supabase);

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
    for (let index = 0; index < workItems.length; index += DAILY_COACH_CONCURRENCY) {
      const batch = workItems.slice(index, index + DAILY_COACH_CONCURRENCY);

      await Promise.all(
        batch.map(async (item) => {
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
        })
      );
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
    console.error("[Cron] Daily coach job failed:", err);
    return NextResponse.json({ error: "Daily coach job failed." }, { status: 500 });
  }
}

async function buildProfileWorkItems(
  rows: Array<{ user_id?: string | null; health_profile_id?: string | null }>,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const items = new Map<
    string,
    { userId: string; healthProfileContext: ActiveHealthProfileContext }
  >();
  const profileIds = Array.from(
    new Set(
      rows
        .map((row) => row.health_profile_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const profileEntitlements = await loadProfileEntitlementMap(profileIds, supabase);

  for (const row of rows) {
    if (!row.user_id) continue;
    const key = `${row.user_id}:${row.health_profile_id || "legacy"}`;
    if (items.has(key)) continue;

    const profileAccess = row.health_profile_id
      ? profileEntitlements.get(row.health_profile_id)
      : null;
    if (row.health_profile_id && !profileAccess?.writable) {
      continue;
    }

    items.set(key, {
      userId: row.user_id,
      healthProfileContext: row.health_profile_id
        ? {
            loginUserId: row.user_id,
            workspaceId: profileAccess?.workspaceId || null,
            healthProfileId: row.health_profile_id,
            legacyUserId: row.user_id,
            mode: "health_profile",
            role: "owner",
            isFrozen: false,
          }
        : createLegacyActiveHealthProfileContext(row.user_id),
    });
  }

  return Array.from(items.values());
}

async function loadProfileEntitlementMap(
  profileIds: string[],
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const entitlementMap = new Map<string, { writable: boolean; workspaceId: string | null }>();
  if (!profileIds.length) return entitlementMap;

  const { data: profiles, error: profilesError } = await supabase
    .from("health_profiles")
    .select("id,workspace_id,is_primary,created_at,status")
    .in("id", profileIds)
    .eq("status", "active");

  if (profilesError) throw profilesError;

  const workspaceIds = Array.from(
    new Set((profiles || []).map((profile) => profile.workspace_id).filter(Boolean))
  ) as string[];
  const { data: workspaces, error: workspacesError } = workspaceIds.length
    ? await supabase
        .from("workspaces")
        .select("id,max_health_profiles")
        .in("id", workspaceIds)
    : { data: [], error: null };

  if (workspacesError) throw workspacesError;

  const maxByWorkspace = new Map(
    (workspaces || []).map((workspace) => [
      workspace.id,
      Math.max(Number(workspace.max_health_profiles) || 1, 1),
    ])
  );
  const profilesByWorkspace = new Map<string, typeof profiles>();

  for (const profile of profiles || []) {
    if (!profile.workspace_id) {
      entitlementMap.set(profile.id, { writable: true, workspaceId: null });
      continue;
    }

    const list = profilesByWorkspace.get(profile.workspace_id) || [];
    list.push(profile);
    profilesByWorkspace.set(profile.workspace_id, list);
  }

  for (const [workspaceId, workspaceProfiles] of profilesByWorkspace) {
    const maxHealthProfiles = maxByWorkspace.get(workspaceId) || 1;
    const writableIds = new Set(
      [...workspaceProfiles]
        .sort((a, b) => {
          const primaryDelta = Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary));
          if (primaryDelta !== 0) return primaryDelta;
          return String(a.created_at || "").localeCompare(String(b.created_at || ""));
        })
        .slice(0, maxHealthProfiles)
        .map((profile) => profile.id)
    );

    for (const profile of workspaceProfiles) {
      entitlementMap.set(profile.id, {
        writable: writableIds.has(profile.id),
        workspaceId,
      });
    }
  }

  return entitlementMap;
}
