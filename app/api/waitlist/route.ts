import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, rateLimitRequest } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "waitlist-signup", 10, 60_000);
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const email = sanitizeEmail(body.email);

    if (!email) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const firstName = sanitizeText(body.firstName, 80);
    const sourcePath = sanitizeText(body.sourcePath, 240) || "/waitlist";
    const userAgent = sanitizeText(request.headers.get("user-agent"), 500);
    const referrer = sanitizeText(request.headers.get("referer"), 500);
    const ipAddress = getClientIp(request);

    const { data: existing, error: existingError } = await admin
      .from("waitlist")
      .select("id")
      .eq("email", email)
      .maybeSingle<{ id: string }>();

    if (existingError) throw existingError;

    if (existing?.id) {
      const { error } = await admin
        .from("waitlist")
        .update({
          first_name: firstName,
          last_seen_at: new Date().toISOString(),
          referrer,
          source_path: sourcePath,
          user_agent: userAgent,
        })
        .eq("id", existing.id);

      if (error) throw error;

      return NextResponse.json({ ok: true });
    }

    const { error } = await admin.from("waitlist").insert({
      email,
      first_name: firstName,
      ip_address: ipAddress,
      referrer,
      source_path: sourcePath,
      user_agent: userAgent,
    });

    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Could not create waitlist signup:", error);
    return NextResponse.json(
      { error: "Could not join the list. Please try again." },
      { status: 500 }
    );
  }
}

function sanitizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}
