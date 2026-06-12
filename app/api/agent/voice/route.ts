import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { answerPersonalHealthAgent } from "@/lib/agent/personalHealthAgent";
import { recordClinicalFollowUpAnswer } from "@/lib/clinical/clinicalFollowUpResponses";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  checkAndRecordUsage,
  getUserPlanForUsage,
  serializeUsage,
  usageErrorResponse,
} from "@/lib/usage/tierUsage";

type ChatMessage = {
  role?: unknown;
  content?: unknown;
};

type SanitizedChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 18 * 1024 * 1024;

let openaiClient: OpenAI | null = null;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "Record a voice question first." }, { status: 400 });
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Voice note is too long. Keep it under one minute for now." },
        { status: 413 }
      );
    }

    const admin = getSupabaseAdmin();
    const subscription = await getUserPlanForUsage({ supabase: admin, userId: user.id });
    const usage = await checkAndRecordUsage({
      metadata: { source: "voice_agent" },
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

    const openai = getOpenAI();
    if (!openai) {
      return NextResponse.json(
        { error: "Voice needs OPENAI_API_KEY configured on the server." },
        { status: 500 }
      );
    }

    const transcript = await transcribeAudio(openai, audio);
    if (!transcript) {
      return NextResponse.json(
        { error: "Aeonvera could not hear a clear question." },
        { status: 400 }
      );
    }

    const history = sanitizeHistory(parseJsonField(formData.get("history")));
    const clinicalFollowUp = await maybeRecordClinicalFollowUpAnswer({
      formData,
      question: transcript,
      supabase: admin,
      userId: user.id,
    });
    const result = await answerPersonalHealthAgent({
      history,
      question: transcript,
      supabase: admin,
      userId: user.id,
    });

    return NextResponse.json({
      actions: clinicalFollowUp?.action
        ? [clinicalFollowUp.action, ...result.actions]
        : result.actions,
      answer: result.answer,
      clinicalFollowUp,
      mode: result.mode,
      transcript,
      suggestedPrompts: buildSuggestedPrompts(result.context),
      usage: serializeUsage(usage),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Aeonvera could not process voice right now.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function maybeRecordClinicalFollowUpAnswer({
  formData,
  question,
  supabase,
  userId,
}: {
  formData: FormData;
  question: string;
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
}) {
  const clinicalInsightId = stringFormValue(formData.get("clinicalInsightId"));
  const isClinicalFollowUpAnswer = stringFormValue(formData.get("clinicalFollowUpAnswer")) === "true";

  if (!clinicalInsightId || !isClinicalFollowUpAnswer) return null;

  return recordClinicalFollowUpAnswer({
    answer: question,
    clinicalInsightId,
    source: "voice_agent",
    supabase,
    userId,
  });
}

function stringFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function transcribeAudio(openai: OpenAI, audio: File) {
  const extension = inferAudioExtension(audio);
  const file = new File([await audio.arrayBuffer()], `aeonvera-voice.${extension}`, {
    type: audio.type || "audio/m4a",
  });
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
  });

  return transcription.text?.trim().slice(0, 8000) || "";
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

function parseJsonField(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sanitizeHistory(value: unknown): SanitizedChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((message: ChatMessage): SanitizedChatMessage => {
      const role: SanitizedChatMessage["role"] =
        message.role === "assistant" ? "assistant" : "user";

      return {
        role,
        content: typeof message.content === "string" ? message.content.trim().slice(0, 1600) : "",
      };
    })
    .filter((message) => message.content)
    .slice(-8);
}

function inferAudioExtension(audio: File) {
  if (audio.name?.includes(".")) {
    return audio.name.split(".").pop()?.toLowerCase() || "m4a";
  }

  if (audio.type.includes("mp4")) return "m4a";
  if (audio.type.includes("mpeg")) return "mp3";
  if (audio.type.includes("wav")) return "wav";
  if (audio.type.includes("webm")) return "webm";
  return "m4a";
}

function buildSuggestedPrompts(context: Awaited<ReturnType<typeof answerPersonalHealthAgent>>["context"]) {
  const action = context.dailyPlan?.plan?.items?.[0]?.action;
  const friction = context.memory?.failurePatterns?.[0]?.label;
  const strongest = context.memory?.bestInterventions?.[0]?.domain;

  return [
    action ? `Why did you choose ${action}?` : "What should I do first today?",
    friction ? `How should we make ${friction} easier?` : "What is the simplest version of today?",
    strongest ? `What is working best in ${strongest}?` : "What are you learning about me?",
  ];
}
