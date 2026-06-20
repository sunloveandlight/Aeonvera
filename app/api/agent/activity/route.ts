import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  frozenHealthProfilePayload,
  getHealthSubjectFilter,
  healthSubjectInsertFields,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

const ACTION_TYPES = [
  "action_error",
  "billing",
  "checkout",
  "create_care_invite",
  "create_physician_share",
  "generate_report",
  "navigation",
  "open_care_network",
  "open_oura",
  "plan_change",
  "plan_options",
  "prepare_today",
  "simplify_plan",
  "sync_oura",
] as const;

const TONES = ["success", "info", "caution"] as const;

type ActionType = (typeof ACTION_TYPES)[number];
type Tone = (typeof TONES)[number];

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
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
    });
    const healthFilter = getHealthSubjectFilter(healthProfileContext);
    const { data, error } = await admin
      .from("command_orb_action_events")
      .select("id,action_type,title,detail,tone,metadata,created_at")
      .eq(healthFilter.column, healthFilter.value)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      if (isMissingActivityTable(error)) {
        return NextResponse.json({ events: [], migrationRequired: true });
      }

      throw error;
    }

    return NextResponse.json({ events: data || [], migrationRequired: false });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Aeonvera activity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "agent-activity-write", 120, 60_000);
    if (limited) return limited;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const actionType = asActionType(body.actionType);
    const tone = asTone(body.tone);
    const title = cleanText(body.title, 80);
    const detail = cleanText(body.detail, 220);
    const metadata = isPlainObject(body.metadata) ? body.metadata : {};

    if (!actionType || !title || !detail) {
      return NextResponse.json({ error: "Invalid activity event." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
    });
    if (healthProfileContext.isFrozen) {
      return NextResponse.json(frozenHealthProfilePayload(), { status: 423 });
    }
    const { data, error } = await admin
      .from("command_orb_action_events")
      .insert({
        action_type: actionType,
        detail,
        metadata,
        source: "command_orb",
        title,
        tone,
        user_id: user.id,
        ...healthSubjectInsertFields(healthProfileContext),
      })
      .select("id,action_type,title,detail,tone,metadata,created_at")
      .single();

    if (error) {
      if (isMissingActivityTable(error)) {
        return NextResponse.json({ event: null, migrationRequired: true });
      }

      throw error;
    }

    return NextResponse.json({ event: data, migrationRequired: false });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save Aeonvera activity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function asActionType(value: unknown): ActionType | null {
  return typeof value === "string" && ACTION_TYPES.includes(value as ActionType)
    ? (value as ActionType)
    : null;
}

function asTone(value: unknown): Tone {
  return typeof value === "string" && TONES.includes(value as Tone)
    ? (value as Tone)
    : "info";
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingActivityTable(error: { message?: string; code?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("command_orb_action_events") ||
    error.message?.includes("schema cache")
  );
}
