import type { SupabaseClient } from "@supabase/supabase-js";
import {
  healthSubjectInsertFields,
  type ActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import type { WearableProvider } from "./types";

export type WearableOAuthProvider = Extract<WearableProvider, "oura" | "whoop">;

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

type ConnectionRow = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

const OURA_AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
const WHOOP_AUTHORIZE_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

export function getWearableOAuthConfig(provider: WearableOAuthProvider) {
  if (provider === "oura") {
    return {
      authorizeUrl: OURA_AUTHORIZE_URL,
      tokenUrl: OURA_TOKEN_URL,
      clientId: process.env.OURA_CLIENT_ID,
      clientSecret: process.env.OURA_CLIENT_SECRET,
      scope: process.env.OURA_SCOPES || "daily personal",
    };
  }

  return {
    authorizeUrl: WHOOP_AUTHORIZE_URL,
    tokenUrl: WHOOP_TOKEN_URL,
    clientId: process.env.WHOOP_CLIENT_ID,
    clientSecret: process.env.WHOOP_CLIENT_SECRET,
    scope: process.env.WHOOP_SCOPES || "offline read:recovery read:sleep read:cycles read:profile",
  };
}

export function buildRedirectUri(origin: string, provider: WearableOAuthProvider) {
  return `${origin}/api/wearables/${provider}/callback`;
}

export function buildAuthorizeUrl({
  provider,
  origin,
  state,
}: {
  provider: WearableOAuthProvider;
  origin: string;
  state: string;
}) {
  const config = getWearableOAuthConfig(provider);

  if (!config.clientId) {
    throw new Error(`Missing ${provider.toUpperCase()} client ID.`);
  }

  const url = new URL(config.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", buildRedirectUri(origin, provider));
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);

  return url;
}

export async function exchangeWearableCode({
  provider,
  origin,
  code,
}: {
  provider: WearableOAuthProvider;
  origin: string;
  code: string;
}) {
  const config = getWearableOAuthConfig(provider);

  if (!config.clientId || !config.clientSecret) {
    throw new Error(`Missing ${provider.toUpperCase()} OAuth credentials.`);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: buildRedirectUri(origin, provider),
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  return requestToken(config.tokenUrl, body);
}

export async function refreshWearableToken({
  provider,
  refreshToken,
}: {
  provider: WearableOAuthProvider;
  refreshToken: string;
}) {
  const config = getWearableOAuthConfig(provider);

  if (!config.clientId || !config.clientSecret) {
    throw new Error(`Missing ${provider.toUpperCase()} OAuth credentials.`);
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  if (provider === "whoop") {
    body.set("scope", config.scope);
  }

  return requestToken(config.tokenUrl, body);
}

export async function saveWearableConnection({
  healthProfileContext,
  supabase,
  userId,
  provider,
  token,
}: {
  healthProfileContext?: ActiveHealthProfileContext | null;
  supabase: SupabaseClient;
  userId: string;
  provider: WearableOAuthProvider;
  token: TokenResponse;
}) {
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;

  const { error } = await supabase.from("wearable_connections").upsert(
    {
      user_id: userId,
      ...(healthProfileContext ? healthSubjectInsertFields(healthProfileContext) : {}),
      provider,
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      token_type: token.token_type || "bearer",
      scope: token.scope || null,
      expires_at: expiresAt,
      status: "connected",
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  if (error) throw new Error(error.message);
}

export async function getValidWearableAccessToken({
  supabase,
  userId,
  provider,
}: {
  supabase: SupabaseClient;
  userId: string;
  provider: WearableOAuthProvider;
}) {
  const { data, error } = await supabase
    .from("wearable_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("status", "connected")
    .maybeSingle<ConnectionRow>();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : null;
  const hasTime = expiresAt === null || expiresAt > Date.now() + 5 * 60 * 1000;

  if (hasTime) return data.access_token;

  if (!data.refresh_token) {
    throw new Error(`${provider.toUpperCase()} connection expired. Reconnect your device.`);
  }

  const refreshed = await refreshWearableToken({
    provider,
    refreshToken: data.refresh_token,
  });

  await saveWearableConnection({ supabase, userId, provider, token: refreshed });

  return refreshed.access_token;
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
        ? String(payload.error)
        : `Token request failed with ${response.status}.`;

    throw new Error(message);
  }

  if (!payload?.access_token) {
    throw new Error("Token response did not include an access token.");
  }

  return payload as TokenResponse;
}
