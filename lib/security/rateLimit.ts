import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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
const durableLimiters = new Map<string, Ratelimit>();
let redis: Redis | null = null;

export function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimit({
  key,
  label = "This request",
  limit,
  windowMs,
}: RateLimitOptions) {
  const durableLimiter = getDurableLimiter(limit, windowMs);
  if (durableLimiter) {
    const result = await durableLimiter.limit(key);

    if (!result.success) {
      const retryAfter = Math.max(
        1,
        Math.ceil((result.reset - Date.now()) / 1000)
      );

      return NextResponse.json(
        { error: `${label} is temporarily rate limited. Try again shortly.` },
        {
          headers: { "Retry-After": String(retryAfter) },
          status: 429,
        }
      );
    }

    return null;
  }

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
  return rateLimitRequestAsync(request, scope, limit, windowMs);
}

export function rateLimitRequestAsync(
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

function getDurableLimiter(limit: number, windowMs: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (process.env.NODE_ENV === "production" && (!url || !token)) {
    throw new Error(
      "Production rate limiting requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }

  if (!url || !token) return null;

  if (!redis) {
    redis = new Redis({ url, token });
  }

  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const cacheKey = `${limit}:${windowSeconds}`;
  const existing = durableLimiters.get(cacheKey);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    prefix: "aeonvera:rate-limit",
  });

  durableLimiters.set(cacheKey, limiter);
  return limiter;
}
