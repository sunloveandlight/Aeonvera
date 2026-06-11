import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("calendar_connections")
      .select("provider,status,calendar_id,connected_at,updated_at")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .maybeSingle();

    if (error) {
      if (isMissingCalendarTable(error)) {
        return NextResponse.json({
          connected: false,
          migrationRequired: true,
          message: "Apply the calendar execution migration to enable calendar sync.",
        });
      }

      throw error;
    }

    return NextResponse.json({
      connected: data?.status === "connected",
      connection: data || null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load calendar status.";
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

function isMissingCalendarTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("calendar_connections") ||
    error.message?.includes("schema cache")
  );
}
