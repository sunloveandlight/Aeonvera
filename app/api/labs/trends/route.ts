import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadLabTrendsForUser } from "@/lib/labs/loadLabTrendsForUser";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      trends: await loadLabTrendsForUser(getSupabaseAdmin(), user.id),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load lab trends.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
