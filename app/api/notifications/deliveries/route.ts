import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("notification_deliveries")
      .select("id, channel, status, title, message, payload, error, created_at, sent_at")
      .eq("user_id", user.id)
      .eq("channel", "in_app")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      if (isMissingNotificationTable(error)) {
        return NextResponse.json({ notifications: [] });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notifications: data || [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load notifications.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isMissingNotificationTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("notification_deliveries") ||
    error.message?.includes("schema cache")
  );
}
