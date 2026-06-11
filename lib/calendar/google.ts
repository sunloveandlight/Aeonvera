import type { SupabaseClient } from "@supabase/supabase-js";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

type CalendarConnectionRow = {
  id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  calendar_id: string | null;
};

type CalendarEventInput = {
  title: string;
  description?: string | null;
  scheduledFor: string;
  durationMinutes: number;
  recurrence?: "none" | "daily" | "weekly";
  timeZone?: string;
};

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars";
const DEFAULT_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function getGoogleCalendarOAuthConfig() {
  return {
    authorizeUrl: GOOGLE_AUTHORIZE_URL,
    tokenUrl: GOOGLE_TOKEN_URL,
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    scope: process.env.GOOGLE_CALENDAR_SCOPES || DEFAULT_SCOPE,
  };
}

export function buildGoogleCalendarRedirectUri(origin: string) {
  return `${origin}/api/calendar/google/callback`;
}

export function buildGoogleCalendarAuthorizeUrl({
  origin,
  state,
}: {
  origin: string;
  state: string;
}) {
  const config = getGoogleCalendarOAuthConfig();

  if (!config.clientId) {
    throw new Error("Missing GOOGLE_CALENDAR_CLIENT_ID.");
  }

  const url = new URL(config.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", buildGoogleCalendarRedirectUri(origin));
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return url;
}

export async function exchangeGoogleCalendarCode({
  origin,
  code,
}: {
  origin: string;
  code: string;
}) {
  const config = getGoogleCalendarOAuthConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error("Missing Google Calendar OAuth credentials.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: buildGoogleCalendarRedirectUri(origin),
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  return requestToken(config.tokenUrl, body);
}

export async function refreshGoogleCalendarToken(refreshToken: string) {
  const config = getGoogleCalendarOAuthConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error("Missing Google Calendar OAuth credentials.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  return requestToken(config.tokenUrl, body);
}

export async function saveGoogleCalendarConnection({
  supabase,
  userId,
  token,
}: {
  supabase: SupabaseClient;
  userId: string;
  token: TokenResponse;
}) {
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;

  const payload = {
    user_id: userId,
    provider: "google",
    access_token: token.access_token,
    refresh_token: token.refresh_token || undefined,
    token_type: token.token_type || "bearer",
    scope: token.scope || null,
    expires_at: expiresAt,
    status: "connected",
    calendar_id: "primary",
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("calendar_connections")
    .upsert(payload, { onConflict: "user_id,provider" });

  if (error) throw new Error(error.message);
}

export async function getValidGoogleCalendarAccessToken({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("calendar_connections")
    .select("id,access_token,refresh_token,expires_at,calendar_id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("status", "connected")
    .maybeSingle<CalendarConnectionRow>();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : null;
  const hasTime = expiresAt === null || expiresAt > Date.now() + 5 * 60 * 1000;

  if (hasTime) {
    return {
      accessToken: data.access_token,
      connectionId: data.id,
      calendarId: data.calendar_id || "primary",
    };
  }

  if (!data.refresh_token) {
    throw new Error("Google Calendar connection expired. Reconnect Google Calendar.");
  }

  const refreshed = await refreshGoogleCalendarToken(data.refresh_token);
  await saveGoogleCalendarConnection({ supabase, userId, token: refreshed });

  return {
    accessToken: refreshed.access_token,
    connectionId: data.id,
    calendarId: data.calendar_id || "primary",
  };
}

export async function createGoogleCalendarEvent({
  accessToken,
  calendarId = "primary",
  event,
}: {
  accessToken: string;
  calendarId?: string;
  event: CalendarEventInput;
}) {
  const scheduledFor = new Date(event.scheduledFor);
  const durationMinutes = Math.max(10, Math.min(240, event.durationMinutes || 30));
  const end = new Date(scheduledFor.getTime() + durationMinutes * 60 * 1000);
  const body: Record<string, unknown> = {
    summary: event.title,
    description: event.description || "Scheduled by Aeonvera.",
    start: {
      dateTime: scheduledFor.toISOString(),
      timeZone: event.timeZone || "UTC",
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: event.timeZone || "UTC",
    },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 10 }],
    },
  };

  if (event.recurrence === "daily") {
    body.recurrence = ["RRULE:FREQ=DAILY;COUNT=14"];
  }

  if (event.recurrence === "weekly") {
    body.recurrence = ["RRULE:FREQ=WEEKLY;COUNT=8"];
  }

  const response = await fetch(
    `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message || `Google Calendar event failed with ${response.status}.`;
    throw new Error(message);
  }

  return payload as { id?: string; htmlLink?: string };
}

async function requestToken(tokenUrl: string, body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error_description || payload.error)
        : `Token request failed with ${response.status}.`;

    throw new Error(message);
  }

  if (!payload?.access_token) {
    throw new Error("Token response did not include an access token.");
  }

  return payload as TokenResponse;
}
