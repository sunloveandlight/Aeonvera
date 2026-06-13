import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireServerFeatureAccess } from "@/lib/auth/serverFeatureAccess";
import { parseAppleHealthPayload, parseAppleHealthText } from "@/lib/wearables/apple";
import { ingestWearableMetrics } from "@/lib/wearables/ingestWearableMetrics";
import type { WearableRawMetric } from "@/lib/wearables/types";

let openaiClient: OpenAI | null = null;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for image import.");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const entitlement = await requireServerFeatureAccess({
      feature: "dashboard_access",
      lockedMessage: "Activate Core to import Apple Health data.",
      supabase: admin,
      userId: user.id,
    });
    if (!entitlement.allowed) return entitlement.response;

    const metrics = await parseImportRequest(request);

    if (metrics.length === 0) {
      return NextResponse.json(
        { error: "No Apple Health metrics found. Upload JSON, CSV, or a readable screenshot." },
        { status: 400 }
      );
    }

    const result = await ingestWearableMetrics({
      supabase: admin,
      userId: user.id,
      provider: "apple",
      metrics,
    });

    return NextResponse.json({
      success: true,
      provider: "apple",
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Apple Health import failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function parseImportRequest(request: NextRequest): Promise<WearableRawMetric[]> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const payload = String(form.get("payload") || "").trim();
    const file = form.get("file");

    if (file instanceof File) {
      if (file.size > 8 * 1024 * 1024) {
        throw new Error("Apple Health upload must be 8MB or smaller.");
      }

      if (file.type.startsWith("image/")) {
        return extractMetricsFromImage(file);
      }

      return parseAppleHealthText(await file.text());
    }

    if (payload) {
      return parseAppleHealthText(payload);
    }

    return [];
  }

  const body = await request.json();
  return parseAppleHealthPayload(body);
}

async function extractMetricsFromImage(file: File): Promise<WearableRawMetric[]> {
  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
  const dataUrl = `data:${file.type};base64,${bytes}`;

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 700,
    messages: [
      {
        role: "system",
        content:
          "Extract wearable health metrics from screenshots. Return raw JSON only.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Read this Apple Health or wearable screenshot and return JSON in this exact shape: {\"records\":[{\"metricName\":\"step_count|sleep_hours|heart_rate_variability|resting_heart_rate|vo2max\",\"value\":number,\"timestamp\":\"ISO date or today's visible date\"}]}. Include only metrics clearly visible in the image.",
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

  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return parseAppleHealthPayload(JSON.parse(cleaned));
  } catch {
    return [];
  }
}
