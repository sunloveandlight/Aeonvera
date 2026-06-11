import { NextResponse } from "next/server";
import { buildDailyIntelligenceBrief } from "@/lib/coach/dailyIntelligenceBrief";
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

    const brief = await buildDailyIntelligenceBrief(getSupabaseAdmin(), user.id);

    return NextResponse.json({ brief });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not build daily intelligence brief.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
