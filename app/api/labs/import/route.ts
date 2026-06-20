import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  checkAndRecordUsage,
  getUserPlanForUsage,
  serializeUsage,
  usageErrorResponse,
} from "@/lib/usage/tierUsage";
import { createClinicalInsightFromLabs } from "@/lib/clinical/clinicalIntelligence";
import {
  CLINICAL_BIOMARKERS,
  normalizeClinicalBiomarkers,
  parseClinicalBiomarkerText,
  type ParsedClinicalBiomarker,
} from "@/lib/labs/clinicalBiomarkers";
import { refreshBiologicalAgeForUser } from "@/lib/longevity/refreshBiologicalAge";
import { storeSemanticMemory } from "@/lib/memory/semanticMemory";
import {
  getRequestedHealthProfileId,
  healthSubjectInsertFields,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

let openaiClient: OpenAI | null = null;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for lab image import.");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "labs-import", 12, 60_000);
    if (limited) return limited;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    const usage = await checkAndRecordUsage({
      healthProfileId: healthProfileContext.healthProfileId,
      metadata: { source: "lab_import" },
      meter: "lab_import",
      plan: subscription.plan,
      status: subscription.status,
      supabase: admin,
      userId: user.id,
    });

    if (!usage.allowed) {
      return NextResponse.json(
        usageErrorResponse(usage),
        { status: usage.statusCode || 429 }
      );
    }

    const { biomarkers, source } = await parseImportRequest(request);

    if (biomarkers.length === 0) {
      return NextResponse.json(
        {
          error:
            "No supported lab biomarkers found. Upload a readable report or enter metabolic, lipid, inflammation, CBC, thyroid, hormone, vitamin D, or biological-age lab markers.",
        },
        { status: 400 }
      );
    }

    const measuredAt = new Date().toISOString();
    const rows = biomarkers.map((biomarker) => ({
      ...healthSubjectInsertFields(healthProfileContext),
      user_id: user.id,
      canonical_key: biomarker.canonicalKey,
      value: biomarker.value,
      unit: biomarker.unit || null,
      raw_label: biomarker.rawLabel || null,
      reference_range: biomarker.referenceRange || null,
      source,
      measured_at: measuredAt,
    }));

    const { data: inserted, error: insertError } = await admin
      .from("lab_biomarkers")
      .insert(rows)
      .select("id, canonical_key, value, unit, raw_label, measured_at");

    if (insertError) {
      console.error("Lab biomarker insert failed:", insertError);
      return NextResponse.json(
        {
          error:
            "Lab tables are not live yet. Apply supabase/migrations/20260610150000_lab_biomarkers.sql in Supabase, then try again.",
        },
        { status: 500 }
      );
    }

    const biologicalAge = await refreshBiologicalAgeForUser({
      healthProfileId: healthProfileContext.healthProfileId,
      supabase: admin,
      userId: user.id,
      source: "system",
    });
    const clinicalIntelligence = await createClinicalInsightFromLabs({
      healthProfileId: healthProfileContext.healthProfileId,
      sourceQuestion: "Clinical lab import",
      supabase: admin,
      userId: user.id,
    });
    await storeSemanticMemory({
      content: [
        `Imported ${biomarkers.length} lab biomarkers from ${source}.`,
        ...biomarkers.slice(0, 24).map((marker) =>
          `${marker.canonicalKey}: ${marker.value}${marker.unit ? ` ${marker.unit}` : ""}${
            marker.referenceRange ? ` (${marker.referenceRange})` : ""
          }`
        ),
      ].join("\n"),
      healthProfileId: healthProfileContext.healthProfileId,
      importance: 0.86,
      metadata: {
        biomarkerCount: biomarkers.length,
        source,
        storedBy: "lab_import",
      },
      occurredAt: measuredAt,
      sourceType: "lab_import",
      supabase: admin,
      title: "Imported lab biomarkers",
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      source,
      inserted: inserted || [],
      biologicalAge,
      clinicalIntelligence,
      usage: serializeUsage(usage),
    });
  } catch (error) {
    console.error("Lab import failed:", error);

    return NextResponse.json({ error: "Lab import failed." }, { status: 500 });
  }
}

async function parseImportRequest(request: NextRequest): Promise<{
  biomarkers: ParsedClinicalBiomarker[];
  source: "upload" | "manual" | "image" | "pdf" | "csv" | "text";
}> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const payload = String(form.get("payload") || "").trim();
    const manual = normalizeClinicalBiomarkers(safeJson(payload));
    const file = form.get("file");

    if (file instanceof File) {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Lab upload must be 10MB or smaller.");
      }

      if (file.type.startsWith("image/")) {
        return {
          biomarkers: mergeBiomarkers([
            ...manual,
            ...(await extractBiomarkersFromImage(file)),
          ]),
          source: "image",
        };
      }

      const text = await file.text();
      const source = file.type.includes("pdf")
        ? "pdf"
        : file.type.includes("csv") || file.name.toLowerCase().endsWith(".csv")
        ? "csv"
        : "text";

      return {
        biomarkers: mergeBiomarkers([
          ...manual,
          ...parseClinicalBiomarkerText(text),
          ...normalizeClinicalBiomarkers(safeJson(text)),
        ]),
        source,
      };
    }

    return {
      biomarkers: mergeBiomarkers([
        ...manual,
        ...parseClinicalBiomarkerText(payload),
      ]),
      source: "manual",
    };
  }

  const body = await request.json();
  return {
    biomarkers: normalizeClinicalBiomarkers(body),
    source: "manual",
  };
}

async function extractBiomarkersFromImage(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
  const dataUrl = `data:${file.type};base64,${bytes}`;

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content:
          "Extract clinical lab biomarkers from lab report screenshots. Return raw JSON only.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Read this lab report image and return JSON exactly like {"records":[{"canonicalKey":"${CLINICAL_BIOMARKERS.map((marker) => marker.key).join("|")}","value":number,"unit":"string","rawLabel":"string","referenceRange":"string"}]}. Include only values clearly visible.`,
          },
          {
            type: "image_url",
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) return [];

  return normalizeClinicalBiomarkers(safeJson(stripJsonFences(raw)));
}

function mergeBiomarkers(biomarkers: ParsedClinicalBiomarker[]) {
  return Array.from(
    biomarkers
      .filter((biomarker) => Number.isFinite(biomarker.value))
      .reduce<Map<string, ParsedClinicalBiomarker>>((map, biomarker) => {
        if (!map.has(biomarker.canonicalKey)) {
          map.set(biomarker.canonicalKey, biomarker);
        }

        return map;
      }, new Map())
      .values()
  );
}

function safeJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stripJsonFences(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}
