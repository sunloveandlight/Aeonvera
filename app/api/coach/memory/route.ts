import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadOrBuildCoachMemoryProfile } from "@/lib/memory/coachMemoryProfile";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memory = await loadOrBuildCoachMemoryProfile(getSupabaseAdmin(), user.id);

    return NextResponse.json({
      memory,
      migrationRequired: memory === null,
      message: memory
        ? "Coach memory profile is active."
        : "Apply the coach_memory_profiles migration to persist Phase 8 memory.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load coach memory profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
