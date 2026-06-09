import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseAppleHealthPayload } from "@/lib/wearables/apple";
import { ingestWearableMetrics } from "@/lib/wearables/ingestWearableMetrics";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const metrics = parseAppleHealthPayload(body);

    if (metrics.length === 0) {
      return NextResponse.json(
        { error: "No Apple Health metrics found in payload." },
        { status: 400 }
      );
    }

    const result = await ingestWearableMetrics({
      supabase: getSupabaseAdmin(),
      userId: user.id,
      provider: "apple",
      metrics,
    });

    return NextResponse.json({
      success: true,
      provider: "apple",
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Apple Health import failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
