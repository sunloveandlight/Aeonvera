import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildBiologicalAgeImprovementLoop } from "@/lib/longevity/biologicalAgeImprovementLoop";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loop = await buildBiologicalAgeImprovementLoop({
      supabase: getSupabaseAdmin(),
      userId: user.id,
    });

    return NextResponse.json({ loop });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load biological age improvement loop.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
