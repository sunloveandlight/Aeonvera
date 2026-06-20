import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchOuraMetrics } from "@/lib/wearables/oura";
import { fetchWhoopMetrics } from "@/lib/wearables/whoop";
import { ingestWearableMetrics } from "@/lib/wearables/ingestWearableMetrics";
import { getValidWearableAccessToken } from "@/lib/wearables/oauth";
import type { WearableOAuthProvider } from "@/lib/wearables/oauth";
import { canAccess } from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";

type ConnectionRow = {
  user_id: string;
  provider: WearableOAuthProvider;
};

export async function GET(request: NextRequest) {
  return syncWearables(request);
}

export async function POST(request: NextRequest) {
  return syncWearables(request);
}

async function syncWearables(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const auth = request.headers.get("authorization");

    if (!cronSecret) {
      return NextResponse.json(
        { error: "Cron not configured" },
        { status: 500 }
      );
    }

    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("wearable_connections")
      .select("user_id, provider")
      .eq("status", "connected");

    if (error) {
      console.error("[Wearable Cron] Connection query failed:", error);
      return NextResponse.json({ error: "Wearable cron sync failed." }, { status: 500 });
    }

    const window = getSyncWindow();
    const results = [];
    const failures = [];
    let skippedLocked = 0;

    for (const connection of (data || []) as ConnectionRow[]) {
      try {
        const subscription = await getUserPlanForUsage({
          supabase: admin,
          userId: connection.user_id,
        });

        if (!canAccess(subscription.plan, subscription.status, "elite_features")) {
          skippedLocked++;
          continue;
        }

        const accessToken = await getValidWearableAccessToken({
          supabase: admin,
          userId: connection.user_id,
          provider: connection.provider,
        });

        if (!accessToken) continue;

        const metrics =
          connection.provider === "oura"
            ? await fetchOuraMetrics({ accessToken, ...window })
            : await fetchWhoopMetrics({ accessToken, ...window });

        const result = await ingestWearableMetrics({
          supabase: admin,
          userId: connection.user_id,
          provider: connection.provider,
          metrics,
        });

        await admin
          .from("wearable_connections")
          .update({
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", connection.user_id)
          .eq("provider", connection.provider);

        results.push({
          provider: connection.provider,
          userId: connection.user_id,
          inserted: result.inserted,
          normalized: result.normalized,
          biologicalAge: result.biologicalAge?.result?.biologicalAge ?? null,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Wearable connection sync failed.";
        console.error("[Wearable Cron Connection Error]", {
          error: message,
          provider: connection.provider,
          userId: connection.user_id,
        });
        failures.push({
          error: message,
          provider: connection.provider,
          userId: connection.user_id,
        });
      }
    }

    return NextResponse.json({
      success: true,
      failed: failures.length,
      failures,
      synced: results.length,
      skippedLocked,
      results,
    });
  } catch (error) {
    console.error("[Wearable Cron] Sync failed:", error);
    return NextResponse.json({ error: "Wearable cron sync failed." }, { status: 500 });
  }
}

function getSyncWindow() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 2);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}
