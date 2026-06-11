import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const SELECT_FIELDS =
  "id,protocol,summary,focus_domains,status,created_at,updated_at";

export async function GET() {
  try {
    const supabaseUser = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("optimization_protocols")
      .select(SELECT_FIELDS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      if (isMissingProtocolTable(error)) {
        return NextResponse.json({
          protocols: [],
          migrationRequired: true,
          message:
            "Apply the optimization protocol Supabase migration to see protocol history.",
        });
      }

      throw error;
    }

    return NextResponse.json({ protocols: data || [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load protocol history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isMissingProtocolTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("optimization_protocols") ||
    error.message?.includes("schema cache")
  );
}
