import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getOpsEnvStatus } from "@/lib/ops/diagnostics";
import { rateLimitRequest } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const requestId = request.headers.get("x-vercel-id") || crypto.randomUUID();
  const limited = await rateLimitRequest(request, "ops-health", 120, 60_000);
  if (limited) return limited;

  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const deep = Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`;

  if (authorization && !deep) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(JSON.stringify({
    level: "info",
    msg: "ops health start",
    requestId,
    route: "/api/ops/health",
  }));

  try {
    const checks = {
      app: true,
      database: deep ? await checkDatabase() : undefined,
      env: deep ? getOpsEnvStatus() : undefined,
    };
    const ok = checks.app && (deep ? checks.database : true);

    console.log(JSON.stringify({
      level: ok ? "info" : "error",
      msg: "ops health done",
      ms: Date.now() - start,
      ok,
      requestId,
      route: "/api/ops/health",
    }));

    return NextResponse.json(
      {
        checks,
        ok,
        timestamp: new Date().toISOString(),
      },
      { status: ok ? 200 : 503 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed.";

    console.error(JSON.stringify({
      error: message,
      level: "error",
      msg: "ops health failed",
      ms: Date.now() - start,
      requestId,
      route: "/api/ops/health",
    }));

    return NextResponse.json(
      {
        error: "Health check failed.",
        ok: false,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

async function checkDatabase() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("workspaces").select("id", { count: "exact", head: true });
  return !error;
}
