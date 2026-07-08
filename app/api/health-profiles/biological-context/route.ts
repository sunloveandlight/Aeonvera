import { NextRequest, NextResponse } from "next/server";
import {
  frozenHealthProfileResponse,
  getRequestedHealthProfileId,
  healthProfileWriteAccessDeniedResponse,
  isFrozenHealthProfileError,
  isHealthProfileWriteAccessError,
  requireProfileWriteAccess,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import {
  BiologicalContextValidationError,
  loadBiologicalContext,
  updateBiologicalContext,
} from "@/lib/health-profiles/biologicalContext";
import { rateLimitRequest } from "@/lib/security/rateLimit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "biological-context-read", 60, 60_000);
    if (limited) return limited;

    const user = await requireUser();
    const admin = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });

    const context = await loadBiologicalContext({
      healthProfileId: healthProfileContext.healthProfileId,
      supabase: admin,
    });

    return NextResponse.json({
      biologicalContext: context,
      healthProfileId: healthProfileContext.healthProfileId,
      mode: healthProfileContext.mode,
      role: healthProfileContext.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load biological context.";
    if (message !== "Unauthorized") console.error("Could not load biological context:", error);
    return NextResponse.json(
      { error: message === "Unauthorized" ? "Unauthorized" : "Internal server error." },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "biological-context-write", 30, 60_000);
    if (limited) return limited;

    const user = await requireUser();
    const admin = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });

    if (healthProfileContext.isFrozen) return frozenHealthProfileResponse();
    requireProfileWriteAccess(healthProfileContext);

    if (!healthProfileContext.healthProfileId) {
      return NextResponse.json(
        { error: "Create or select a health profile before saving biological context." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const context = await updateBiologicalContext({
      healthProfileId: healthProfileContext.healthProfileId,
      input: body.biologicalContext || body,
      source: "profile_settings",
      supabase: admin,
    });

    return NextResponse.json({
      biologicalContext: context,
      healthProfileId: healthProfileContext.healthProfileId,
    });
  } catch (error) {
    if (isFrozenHealthProfileError(error)) return frozenHealthProfileResponse();
    if (isHealthProfileWriteAccessError(error)) return healthProfileWriteAccessDeniedResponse();
    if (error instanceof BiologicalContextValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Could not update biological context.";
    if (message !== "Unauthorized") console.error("Could not update biological context:", error);
    return NextResponse.json(
      { error: message === "Unauthorized" ? "Unauthorized" : "Internal server error." },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
