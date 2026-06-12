import { NextRequest, NextResponse } from "next/server";
import { answerPersonalHealthAgent } from "@/lib/agent/personalHealthAgent";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

    const result = await answerPersonalHealthAgent({
      history: sanitizeHistory(body.history),
      question,
      supabase: getSupabaseAdmin(),
      userId: user.id,
    });

    return NextResponse.json({
      answer: result.answer,
      mode: result.mode,
      suggestedPrompts: buildSuggestedPrompts(result.context),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Aeonvera could not answer right now.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
  return typeof value === "string" ? value.trim().slice(0, 800) : "";
}

function sanitizeHistory(value: unknown): SanitizedChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((message: ChatMessage): SanitizedChatMessage => {
      const role: SanitizedChatMessage["role"] =
        message.role === "assistant" ? "assistant" : "user";

      return {
        role,
        content: typeof message.content === "string" ? message.content.trim().slice(0, 900) : "",
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
