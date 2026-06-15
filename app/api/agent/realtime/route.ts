import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  checkAndRecordUsage,
  getUserPlanForUsage,
  serializeUsage,
  usageErrorResponse,
} from "@/lib/usage/tierUsage";

type ContextRow = Record<string, unknown>;

export const runtime = "nodejs";

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2";
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";
const ALLOWED_REALTIME_VOICES = new Set(["marin", "cedar", "alloy", "verse", "shimmer"]);

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sdp = await request.text();
    if (!sdp || !sdp.includes("v=0")) {
      return NextResponse.json({ error: "Realtime voice needs a valid SDP offer." }, { status: 400 });
    }
    const voice = sanitizeRealtimeVoice(request.nextUrl.searchParams.get("voice"));

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Realtime voice needs OPENAI_API_KEY configured on the server." },
        { status: 500 }
      );
    }

    const admin = getSupabaseAdmin();
    const subscription = await getUserPlanForUsage({ supabase: admin, userId: user.id });
    const usage = await checkAndRecordUsage({
      metadata: { source: "realtime_voice", transport: "webrtc" },
      meter: "voice_question",
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

    const fd = new FormData();
    fd.set("sdp", sdp);
    fd.set(
      "session",
      JSON.stringify({
        type: "realtime",
        model: REALTIME_MODEL,
        output_modalities: ["audio"],
        instructions: await buildRealtimeInstructions(admin, user.id),
        max_output_tokens: 900,
        audio: {
          input: {
            noise_reduction: { type: "near_field" },
            transcription: {
              model: process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 650,
              interrupt_response: true,
            },
          },
          output: {
            voice,
            speed: 0.98,
          },
        },
      })
    );

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Safety-Identifier": hashUserId(user.id),
      },
      body: fd,
    });

    const answerSdp = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: answerSdp || "OpenAI realtime voice session could not start.",
          usage: serializeUsage(usage),
        },
        { status: response.status }
      );
    }

    return new NextResponse(answerSdp, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "X-Aeonvera-Usage": JSON.stringify(serializeUsage(usage)),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Aeonvera realtime voice could not start.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function sanitizeRealtimeVoice(value: string | null) {
  const normalized = value?.trim().toLowerCase() || "";
  if (ALLOWED_REALTIME_VOICES.has(normalized)) return normalized;
  if (ALLOWED_REALTIME_VOICES.has(REALTIME_VOICE)) return REALTIME_VOICE;
  return "marin";
}

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const {
    data: { user: bearerUser },
  } = await getSupabaseAdmin().auth.getUser(token);

  return bearerUser;
}

async function buildRealtimeInstructions(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const context = await loadRealtimeContext(supabase, userId);

  return [
    "You are Aeonvera, a premium realtime longevity and health optimization voice agent.",
    "Speak naturally, calmly, and intelligently. Keep most spoken answers under 45 seconds unless the user asks for depth.",
    "You can discuss advanced longevity protocols, biomarkers, sleep architecture, metabolism, cardiovascular performance, hormones, cognition, recovery, stress, and behavior change.",
    "You are not a replacement for a physician. Do not diagnose, prescribe medication, or claim certainty. For alarming symptoms, abnormal lab clusters, pregnancy, acute chest pain, neurological deficits, severe shortness of breath, or self-harm risk, tell the user to seek urgent professional care.",
    "Use the user's Aeonvera context below when it is present. If data is missing, ask for the highest-yield missing input instead of pretending.",
    "For site actions such as upgrading, downgrading, opening pages, connecting data sources, sharing exports, or changing settings, acknowledge the request briefly. The Aeonvera client will execute supported actions from the user's transcript.",
    "When recommending advanced modalities, separate evidence strength, risk, cost, contraindications, and whether clinician supervision is needed.",
    "If the user asks for a plan, give one clear next action, one reason, and one way Aeonvera can schedule or track it.",
    `Current user context:\n${JSON.stringify(context, null, 2)}`,
  ].join("\n\n");
}

async function loadRealtimeContext(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const today = new Date().toISOString().slice(0, 10);

  const [
    profile,
    dailyPlan,
    memory,
    protocol,
    labs,
    biologicalAge,
    insights,
    preferences,
  ] = await Promise.all([
    safeSingle(() =>
      supabase
        .from("profiles")
        .select("plan,subscription_status")
        .eq("user_id", userId)
        .maybeSingle()
    ),
    safeSingle(() =>
      supabase
        .from("daily_execution_plans")
        .select("summary,status,autopilot_mode,plan,updated_at")
        .eq("user_id", userId)
        .eq("plan_date", today)
        .maybeSingle()
    ),
    safeSingle(() =>
      supabase
        .from("coach_memory_profiles")
        .select("communication_style,memory,confidence,updated_at")
        .eq("user_id", userId)
        .maybeSingle()
    ),
    safeSingle(() =>
      supabase
        .from("optimization_protocols")
        .select("summary,focus_domains,status,protocol,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    safeList(() =>
      supabase
        .from("lab_biomarkers")
        .select("canonical_key,value,unit,measured_at")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(30)
    ),
    safeSingle(() =>
      supabase
        .from("biological_age_history")
        .select("biological_age,chronological_age,age_delta,score,category,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    safeList(() =>
      supabase
        .from("clinical_insights")
        .select("answer_summary,domains,concern_status,range_flags,follow_up_questions,recommended_actions,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(5)
    ),
    safeList(() =>
      supabase
        .from("agent_preferences")
        .select("category,preference_key,preference_value,confidence,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(10)
    ),
  ]);

  return {
    membership: profile,
    today: dailyPlan,
    coachMemory: memory,
    protocol,
    latestLabs: latestRowsByKey(labs, "canonical_key"),
    biologicalAge,
    clinicalMemory: insights,
    preferences,
  };
}

async function safeSingle(query: () => PromiseLike<{ data: unknown; error: { message?: string } | null }>) {
  const result = await query();
  if (result.error) return null;
  return result.data as ContextRow | null;
}

async function safeList(query: () => PromiseLike<{ data: unknown; error: { message?: string } | null }>) {
  const result = await query();
  if (result.error) return [];
  return Array.isArray(result.data) ? (result.data as ContextRow[]) : [];
}

function latestRowsByKey(rows: ContextRow[], key: string) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const value = typeof row[key] === "string" ? row[key] : "";
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function hashUserId(userId: string) {
  const salt = process.env.OPENAI_SAFETY_SALT || process.env.NEXT_PUBLIC_SUPABASE_URL || "aeonvera";
  return createHash("sha256").update(`${salt}:${userId}`).digest("hex");
}
