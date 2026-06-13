import { NextRequest, NextResponse } from "next/server";
import { answerPersonalHealthAgent } from "@/lib/agent/personalHealthAgent";
import { buildAgentSourcePrompts, processAgentCommand } from "@/lib/agent/agentCommandRouter";
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

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const question = sanitizeQuestion(body.question);

    if (!question) {
      return NextResponse.json({ error: "Ask Aeonvera a question first." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const subscription = await getUserPlanForUsage({ supabase: admin, userId: user.id });
    const usage = await checkAndRecordUsage({
      metadata: { source: "agent_chat" },
      meter: "agent_question",
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

    const clinicalFollowUp = await maybeRecordClinicalFollowUpAnswer({
      body,
      question,
      supabase: admin,
      userId: user.id,
    });

    const result = await answerPersonalHealthAgent({
      history: sanitizeHistory(body.history),
      question,
      supabase: admin,
      userId: user.id,
    });
    const command = await processAgentCommand({
      question,
      source: "agent_chat",
      supabase: admin,
      userId: user.id,
    });
    const sourcePrompts = await buildAgentSourcePrompts({ supabase: admin, userId: user.id });

    return NextResponse.json({
      actions: clinicalFollowUp?.action
        ? [clinicalFollowUp.action, ...command.actions, ...result.actions]
        : [...command.actions, ...result.actions],
      answer: result.answer,
      clinicalFollowUp,
      commandActions: command.actions,
      learnedPreferences: command.preferences,
      mode: result.mode,
      suggestedPrompts: [...sourcePrompts, ...buildSuggestedPrompts(result.context)].slice(0, 3),
      usage: serializeUsage(usage),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Aeonvera could not answer right now.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function maybeRecordClinicalFollowUpAnswer({
  body,
  question,
  supabase,
  userId,
}: {
  body: Record<string, unknown>;
  question: string;
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
}) {
  const clinicalInsightId =
    typeof body.clinicalInsightId === "string" ? body.clinicalInsightId.trim() : "";
  const isClinicalFollowUpAnswer = body.clinicalFollowUpAnswer === true;

  if (!clinicalInsightId || !isClinicalFollowUpAnswer) return null;

  return recordClinicalFollowUpAnswer({
    answer: question,
    clinicalInsightId,
    source: "agent_chat",
    supabase,
    userId,
  });
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

function sanitizeQuestion(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 8000) : "";
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
