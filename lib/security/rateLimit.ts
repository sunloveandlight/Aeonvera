import { NextRequest, NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  label?: string;
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, Bucket>();

export function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit({
  key,
  label = "This request",
  limit,
  windowMs,
}: RateLimitOptions) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (existing.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return NextResponse.json(
      { error: `${label} is temporarily rate limited. Try again shortly.` },
      {
        headers: { "Retry-After": String(retryAfter) },
        status: 429,
      }
    );
  }

  existing.count += 1;
  return null;
}

export function rateLimitRequest(
  request: NextRequest,
  scope: string,
  limit = 60,
  windowMs = 60_000
) {
  return checkRateLimit({
    key: `${scope}:${getClientIp(request)}`,
    label: "This request",
    limit,
    windowMs,
  });
}
