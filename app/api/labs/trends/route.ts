import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildLabTrends, type LabTrendRow } from "@/lib/labs/labTrends";

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
      .from("lab_biomarkers")
      .select("canonical_key, value, unit, measured_at")
      .eq("user_id", user.id)
      .order("measured_at", { ascending: false })
      .limit(180);

    if (error) {
      if (isMissingLabTable(error)) {
        return NextResponse.json({ trends: [] });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      trends: buildLabTrends((data || []) as LabTrendRow[]),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load lab trends.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isMissingLabTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("lab_biomarkers") ||
    error.message?.includes("schema cache")
  );
}
