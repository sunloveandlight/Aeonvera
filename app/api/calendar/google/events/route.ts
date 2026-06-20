import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import {
  createGoogleCalendarEvent,
  getValidGoogleCalendarAccessToken,
} from "@/lib/calendar/google";
import {
  frozenHealthProfileResponse,
  getRequestedHealthProfileId,
  healthSubjectInsertFields,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type CalendarBody = {
  title?: string;
  description?: string;
  action?: string;
  actionScope?: "today" | "week" | "check_in" | "later";
  protocolId?: string;
  scheduledFor?: string;
  scheduledLocal?: string;
  durationMinutes?: number;
  recurrence?: "none" | "daily" | "weekly";
  timeZone?: string;
};

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "calendar-event-create", 30, 60_000);
    if (limited) return limited;

    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const subscription = await getUserPlanForUsage({ supabase: admin, userId: user.id });
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });
    if (healthProfileContext.isFrozen) return frozenHealthProfileResponse();

    if (!canAccess(subscription.plan, subscription.status, "autopilot_calendar")) {
      return NextResponse.json(
        {
          error: "Calendar execution is included in Elite and Sovereign.",
          upgrade: {
            minimumPlan: "elite",
            message:
              "Upgrade to Elite to let Aeonvera schedule and execute protocol actions.",
          },
        },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as CalendarBody;
    const title = sanitizeText(body.title || body.action, 140);
    const scheduledFor = normalizeScheduledFor(body.scheduledFor);

    if (!title) {
      return NextResponse.json({ error: "Calendar title is required." }, { status: 400 });
    }

    if (!scheduledFor) {
      return NextResponse.json(
        { error: "scheduledFor must be a valid future date." },
        { status: 400 }
      );
    }

    const connection = await getValidGoogleCalendarAccessToken({
      supabase: admin,
      userId: user.id,
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Connect Google Calendar before scheduling events." },
        { status: 409 }
      );
    }

    const recurrence = normalizeRecurrence(body.recurrence);
    const durationMinutes = normalizeDuration(body.durationMinutes);
    const description =
      sanitizeText(body.description, 800) ||
      "Scheduled from Aeonvera protocol execution.";

    const event = await createGoogleCalendarEvent({
      accessToken: connection.accessToken,
      calendarId: connection.calendarId,
      event: {
        title,
        description,
        scheduledFor,
        scheduledLocal: normalizeScheduledLocal(body.scheduledLocal),
        durationMinutes,
        recurrence,
        timeZone: body.timeZone || "UTC",
      },
    });

    const { data, error } = await admin
      .from("calendar_events")
      .insert({
        user_id: user.id,
        ...healthSubjectInsertFields(healthProfileContext),
        connection_id: connection.connectionId,
        protocol_id: sanitizeUuid(body.protocolId) || null,
        provider: "google",
        provider_event_id: event.id || null,
        calendar_id: connection.calendarId,
        title,
        description,
        action: sanitizeText(body.action, 240) || title,
        action_scope: normalizeActionScope(body.actionScope),
        scheduled_for: scheduledFor,
        duration_minutes: durationMinutes,
        recurrence,
        html_link: event.htmlLink || null,
        status: "scheduled",
        payload: {
          source: "aeonvera",
          google_event: event,
          scheduled_local: normalizeScheduledLocal(body.scheduledLocal),
          time_zone: body.timeZone || "UTC",
        },
      })
      .select("id,provider_event_id,html_link,scheduled_for,recurrence")
      .single();

    if (error) {
      throw error;
    }

    await admin.from("behavior_events").insert({
      user_id: user.id,
      ...healthSubjectInsertFields(healthProfileContext),
      type: "calendar_event",
      event_type: "google_calendar_event_scheduled",
      domain: "Execution",
      action: sanitizeText(body.action, 240) || title,
      outcome: "scheduled",
      payload: {
        protocol_id: sanitizeUuid(body.protocolId) || null,
        calendar_event_id: data.id,
        provider_event_id: event.id || null,
        action_scope: normalizeActionScope(body.actionScope),
        scheduled_for: scheduledFor,
        scheduled_local: normalizeScheduledLocal(body.scheduledLocal),
        time_zone: body.timeZone || "UTC",
        recurrence,
        source: "google_calendar",
      },
    });

    return NextResponse.json({ event: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not schedule calendar event.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const {
    data: { user: bearerUser },
  } = await admin.auth.getUser(token);

  return bearerUser;
}

function normalizeScheduledFor(value: unknown) {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() < Date.now() - 60_000) {
    return "";
  }
  return date.toISOString();
}

function normalizeScheduledLocal(value: unknown) {
  if (typeof value !== "string") return "";
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value) ? value : "";
}

function normalizeDuration(value: unknown) {
  const duration = Number(value);
  return Number.isFinite(duration) ? Math.max(10, Math.min(240, duration)) : 30;
}

function normalizeRecurrence(value: unknown) {
  return value === "daily" || value === "weekly" ? value : "none";
}

function normalizeActionScope(value: unknown) {
  return value === "today" || value === "week" || value === "check_in" || value === "later"
    ? value
    : null;
}

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function sanitizeUuid(value: unknown) {
  if (typeof value !== "string") return "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : "";
}
