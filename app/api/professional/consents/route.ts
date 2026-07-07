import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitRequest } from "@/lib/security/rateLimit";
import { getWorkspaceId, jsonError, requireUser } from "@/app/api/professional/_utils";
import {
  CONSENT_CAPTURE_METHODS,
  CONSENT_LEGAL_BASES,
  CONSENT_PURPOSES,
  createProfessionalConsent,
  isValidConsentValue,
  listProfessionalConsents,
  revokeProfessionalConsent,
  sanitizeEmail,
  sanitizeProfessionalDataClassList,
  sanitizeStaffRole,
  sanitizeText,
  type StaffRole,
} from "@/lib/professional/workflow";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const workspaceId = getWorkspaceId(request.nextUrl.searchParams.get("workspaceId"));
    const healthProfileId = request.nextUrl.searchParams.get("healthProfileId") || undefined;

    if (!workspaceId) return jsonError("Missing organization workspace.");

    const result = await listProfessionalConsents({
      healthProfileId,
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      workspaceId,
    });

    if (result.error) return jsonError(result.error, 403);
    return NextResponse.json({ consents: result.consents });
  } catch (error) {
    console.error("Could not load professional consents:", error);
    return jsonError("Could not load professional consents.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "professional-consent-create", 40, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const workspaceId = getWorkspaceId(body.workspaceId);
    const healthProfileId = typeof body.healthProfileId === "string" ? body.healthProfileId : "";
    const dataClasses = sanitizeProfessionalDataClassList(body.dataClasses);
    const allowedRoles = sanitizeAllowedRoles(body.allowedRoles);
    const captureMethod = typeof body.captureMethod === "string" ? body.captureMethod : "";
    const legalBasis = typeof body.legalBasis === "string" ? body.legalBasis : "";
    const purpose = typeof body.purpose === "string" ? body.purpose : "";
    const sourceDocumentHash = sanitizeText(body.sourceDocumentHash, 160) || null;
    const sourceDocumentUrl = sanitizeText(body.sourceDocumentUrl, 300) || null;

    if (!workspaceId) return jsonError("Missing organization workspace.");
    if (!healthProfileId) return jsonError("Missing roster profile.");
    if (!dataClasses.length) return jsonError("Choose at least one consent data class.");
    if (!allowedRoles.length) return jsonError("Choose at least one consented role.");
    if (!isValidConsentValue(CONSENT_CAPTURE_METHODS, captureMethod)) {
      return jsonError("Choose a supported consent capture method.");
    }
    if (!isValidConsentValue(CONSENT_LEGAL_BASES, legalBasis)) {
      return jsonError("Choose a supported consent legal basis.");
    }
    if (!isValidConsentValue(CONSENT_PURPOSES, purpose)) {
      return jsonError("Choose a supported consent purpose.");
    }
    if (
      (legalBasis === "patient_consent" || legalBasis === "guardian_consent") &&
      captureMethod !== "in_app" &&
      !sourceDocumentHash &&
      !sourceDocumentUrl
    ) {
      return jsonError("Documented patient or guardian consent requires a source document URL or hash.");
    }
    if (
      (legalBasis === "patient_consent" || legalBasis === "guardian_consent") &&
      captureMethod === "in_app"
    ) {
      return jsonError("In-app patient consent must be granted by the invited member.");
    }

    const result = await createProfessionalConsent({
      allowedRoles,
      captureMethod,
      dataClasses,
      expiresAt: sanitizeDate(body.expiresAt),
      healthProfileId,
      legalBasis,
      purpose,
      sourceDocumentHash,
      sourceDocumentUrl,
      subjectEmail: sanitizeEmail(body.subjectEmail) || null,
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      workspaceId,
    });

    if (result.error) return jsonError(result.error, 403);
    return NextResponse.json({ consent: result.consent }, { status: 201 });
  } catch (error) {
    console.error("Could not create professional consent:", error);
    return jsonError("Could not create professional consent.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "professional-consent-revoke", 40, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const workspaceId = getWorkspaceId(body.workspaceId);
    const consentId = typeof body.consentId === "string" ? body.consentId : "";

    if (!workspaceId) return jsonError("Missing organization workspace.");
    if (!consentId) return jsonError("Missing consent.");

    const result = await revokeProfessionalConsent({
      consentId,
      reason: sanitizeText(body.reason, 200) || null,
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      workspaceId,
    });

    if (result.error) return jsonError(result.error, 403);
    return NextResponse.json({ consent: result.consent });
  } catch (error) {
    console.error("Could not revoke professional consent:", error);
    return jsonError("Could not revoke professional consent.", 500);
  }
}

function sanitizeAllowedRoles(value: unknown): StaffRole[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(sanitizeStaffRole).filter(Boolean))) as StaffRole[];
}

function sanitizeDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
