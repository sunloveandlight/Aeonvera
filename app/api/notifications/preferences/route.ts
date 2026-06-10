import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Preferences = {
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
  source?: "table" | "auth_metadata" | "sleep_schedule";
};

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
    const sleepSchedule = await deriveQuietHours(admin, user.id);
    const { data, error } = await admin
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      if (!isMissingPreferencesTable(error)) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        preferences: metadataPreferences(user, sleepSchedule),
      });
    }

    return NextResponse.json({
      preferences: data
        ? { ...data, source: "table" }
        : {
            user_id: user.id,
            email_enabled: true,
            push_enabled: false,
            quiet_hours_start: sleepSchedule.start,
            quiet_hours_end: sleepSchedule.end,
            timezone: "UTC",
            source: "sleep_schedule",
          },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load preferences.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    const admin = getSupabaseAdmin();
    const sleepSchedule = await deriveQuietHours(admin, user.id);
    const nextPreferences: Preferences = {
      user_id: user.id,
      email_enabled: Boolean(body.email_enabled),
      push_enabled: Boolean(body.push_enabled),
      quiet_hours_start: body.quiet_hours_start || sleepSchedule.start,
      quiet_hours_end: body.quiet_hours_end || sleepSchedule.end,
      timezone: body.timezone || "UTC",
    };

    const { data, error } = await admin
      .from("notification_preferences")
      .upsert(
        {
          ...nextPreferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      if (!isMissingPreferencesTable(error)) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata || {}),
          notification_preferences: nextPreferences,
        },
      });

      return NextResponse.json({
        preferences: { ...nextPreferences, source: "auth_metadata" },
      });
    }

    return NextResponse.json({ preferences: { ...data, source: "table" } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save preferences.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isMissingPreferencesTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("notification_preferences") ||
    error.message?.includes("schema cache")
  );
}

function metadataPreferences(
  user: {
    id: string;
    user_metadata?: { notification_preferences?: Partial<Preferences> };
  },
  sleepSchedule: { start: string; end: string }
): Preferences {
  const stored = user.user_metadata?.notification_preferences || {};

  return {
    user_id: user.id,
    email_enabled: stored.email_enabled !== false,
    push_enabled: stored.push_enabled === true,
    quiet_hours_start: stored.quiet_hours_start || sleepSchedule.start,
    quiet_hours_end: stored.quiet_hours_end || sleepSchedule.end,
    timezone: stored.timezone || "UTC",
    source: stored.quiet_hours_start ? "auth_metadata" : "sleep_schedule",
  };
}

async function deriveQuietHours(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const [{ data: state }, { data: assessment }] = await Promise.all([
    supabase
      .from("health_states")
      .select("baseline")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("longevity_assessments")
      .select("sleep_hours")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const sleepHours = Number(
    state?.baseline?.sleep_hours || assessment?.sleep_hours || 7.5
  );
  const duration = Number.isFinite(sleepHours)
    ? Math.min(10, Math.max(5, sleepHours + 1))
    : 8.5;
  const endHour = 7;
  const startHour = (24 + endHour - duration) % 24;

  return {
    start: formatHour(startHour),
    end: "07:00",
  };
}

function formatHour(hour: number) {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  return `${String(whole).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
