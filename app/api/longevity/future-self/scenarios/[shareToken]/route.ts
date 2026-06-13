import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitRequest } from "@/lib/security/rateLimit";

const SELECT_FIELDS =
  "id,title,description,scenario_ids,controls,projection,future_self,share_token,is_public,created_at,updated_at";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/longevity/future-self/scenarios/[shareToken]">
) {
  try {
    const rateLimited = rateLimitRequest(request, "future-self-share", 90, 60_000);
    if (rateLimited) return rateLimited;

    const { shareToken } = await context.params;

    if (!isUuid(shareToken)) {
      return NextResponse.json({ error: "Scenario not found." }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("future_self_scenarios")
      .select(SELECT_FIELDS)
      .eq("share_token", shareToken)
      .eq("is_public", true)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { error: "Future-self scenario sharing is not live yet." },
          { status: 503 }
        );
      }

      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "Scenario not found." }, { status: 404 });
    }

    return NextResponse.json({ scenario: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load shared scenario.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.message?.includes("future_self_scenarios") ||
    error.message?.includes("schema cache")
  );
}
