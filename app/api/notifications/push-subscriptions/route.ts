import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type PushPlatform = "web" | "ios" | "android";

export async function GET() {
  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null,
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

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

    const existingQuery = admin
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .limit(1);

    const { data: existing } = endpoint
      ? await existingQuery.eq("endpoint", endpoint).maybeSingle()
      : await existingQuery.eq("token", token).maybeSingle();

    const payload = {
      user_id: user.id,
      platform,
      endpoint,
      token,
      p256dh: keys.p256dh || null,
      auth: keys.auth || null,
      device_name: body.device_name || null,
      enabled: body.enabled !== false,
      updated_at: new Date().toISOString(),
    };

    const result = existing?.id
      ? await admin
          .from("push_subscriptions")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .single()
      : await admin
          .from("push_subscriptions")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

    const { data, error } = result;

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

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("push_subscriptions")
      .update({
        enabled: body.enabled === true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subscriptions: data || [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update push subscriptions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizePlatform(value: unknown): PushPlatform | null {
  return value === "web" || value === "ios" || value === "android"
    ? value
    : null;
}

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return user;
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return null;
  }

  const admin = getSupabaseAdmin();
  const {
    data: { user: bearerUser },
  } = await admin.auth.getUser(token);

  return bearerUser;
}
