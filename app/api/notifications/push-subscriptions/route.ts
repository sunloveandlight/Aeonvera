import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type PushPlatform = "web" | "ios" | "android";

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
    const platform = normalizePlatform(body.platform);

    if (!platform) {
      return NextResponse.json(
        { error: "platform must be web, ios, or android." },
        { status: 400 }
      );
    }

    const endpoint = body.endpoint || body.subscription?.endpoint || null;
    const token = body.token || null;

    if (!endpoint && !token) {
      return NextResponse.json(
        { error: "Missing push endpoint or device token." },
        { status: 400 }
      );
    }

    const keys = body.keys || body.subscription?.keys || {};
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("push_subscriptions")
      .insert({
        user_id: user.id,
        platform,
        endpoint,
        token,
        p256dh: keys.p256dh || null,
        auth: keys.auth || null,
        device_name: body.device_name || null,
        enabled: body.enabled !== false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subscription: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save push subscription.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizePlatform(value: unknown): PushPlatform | null {
  return value === "web" || value === "ios" || value === "android"
    ? value
    : null;
}
