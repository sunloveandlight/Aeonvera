import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildExecutionSummary, getExecutionWindow } from "@/lib/execution/executionSummary";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const window = getExecutionWindow();
    const [outcomeRes, calendarRes] = await Promise.all([
      safeQuery(() =>
        admin
          .from("intervention_outcomes")
          .select("domain,action,outcome,success,notes,measured_at,created_at")
          .eq("user_id", user.id)
          .gte("created_at", window.startIso)
          .order("created_at", { ascending: false })
          .limit(80)
      ),
      safeQuery(() =>
        admin
          .from("calendar_events")
          .select("action,action_scope,recurrence,scheduled_for,status,created_at")
          .eq("user_id", user.id)
          .gte("scheduled_for", window.startIso)
          .order("scheduled_for", { ascending: false })
          .limit(80)
      ),
    ]);

    return NextResponse.json({
      execution: buildExecutionSummary({
        calendarEvents: calendarRes.data || [],
        outcomes: outcomeRes.data || [],
      }),
      migrationRequired:
        outcomeRes.missingTable === true || calendarRes.missingTable === true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load execution summary.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const {
    data: { user: bearerUser },
  } = await admin.auth.getUser(token);

  return bearerUser;
}

async function safeQuery<T>(
  query: () => PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>
) {
  const result = await query();

  if (result.error) {
    if (isMissingTableError(result.error)) {
      return { data: null, missingTable: true };
    }

    throw new Error(result.error.message || "Execution query failed.");
  }

  return { data: result.data, missingTable: false };
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("schema cache") ||
    error.message?.includes("intervention_outcomes") ||
    error.message?.includes("calendar_events")
  );
}
