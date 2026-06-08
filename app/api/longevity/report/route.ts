import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";
import { cookies } from "next/headers";

import { computeAdaptiveWeights } from "@/lib/personalization/adaptiveWeightEngine";
import { buildConversationMemory } from "@/lib/memory/conversationMemoryEngine";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

async function getSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: any) {
          cookiesToSet.forEach(({ name, value, options }: any) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabase();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    /**
     * STEP 1 — CORE DATA
     */
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    const { data: assessment } = await supabase
      .from("longevity_assessments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    /**
     * STEP 2 — HEALTH STATE
     */
    const { data: state } = await supabase
      .from("health_states")
      .select("*")
      .eq("user_id", userId)
      .single();

    /**
     * STEP 3 — BEHAVIOR MEMORY
     */
    const { data: behaviorEvents } = await supabase
      .from("behavior_events")
      .select("*")
      .eq("user_id", userId);

    const adaptiveWeights = computeAdaptiveWeights(
      (behaviorEvents || []).map((e) => ({
        userId,
        eventType: e.event_type,
        reference: e.reference,
        outcome: e.outcome,
        timestamp: e.created_at,
      }))
    );

    /**
     * STEP 4 — CONVERSATION MEMORY
     */
    const { data: conversationEvents } = await supabase
      .from("conversation_events")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: true })
      .limit(50);

    const conversationMemory = buildConversationMemory(
      (conversationEvents || []).map((c) => ({
        userId,
        role: c.role,
        content: c.content,
        timestamp: c.timestamp,
        tags: c.tags,
      }))
    );

    /**
     * STEP 5 — PROMPT
     */
    const prompt = `
You are Aeonvera, a longevity intelligence system.

You are now FULLY MEMORY-AWARE.

You maintain continuity across time.

---

## CONVERSATION MEMORY (CRITICAL CONTEXT)
${JSON.stringify(conversationMemory, null, 2)}

---

## BEHAVIOR ADAPTATION SIGNALS
${JSON.stringify(adaptiveWeights, null, 2)}

---

## USER PROFILE
${JSON.stringify(profile, null, 2)}

---

## HEALTH STATE
${JSON.stringify(state, null, 2)}

---

## ASSESSMENT
${JSON.stringify(assessment, null, 2)}

---

IMPORTANT RULES:

- You are not generating a one-off report.
- You are continuing an ongoing relationship with the user.
- You MUST remain consistent with prior emotional tone and context.
- You MUST adapt recommendations based on:
  - behavior adherence
  - conversation history
  - health trends

---

OUTPUT FORMAT (JSON ONLY — no markdown fences, no preamble, raw JSON only):

{
  "risk_score": number,
  "primary_goal": string,
  "risk_profile": {
    "sleep_risk": "low" | "medium" | "high",
    "metabolic_risk": "low" | "medium" | "high",
    "cardiovascular_risk": "low" | "medium" | "high",
    "lifestyle_risk": "low" | "medium" | "high"
  },
  "strengths": [string],
  "weaknesses": [string],
  "top_priorities": [string],
  "90_day_plan": [
    {
      "category": string,
      "action": string,
      "impact": "low" | "medium" | "high"
    }
  ],
  "behavioral_insights": [string]
}
`;

    /**
     * STEP 6 — AI CALL
     */
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a persistent adaptive longevity intelligence. Memory is core to your reasoning. Always respond with raw JSON only — no markdown fences, no extra text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      return NextResponse.json({ error: "No AI response" }, { status: 500 });
    }

    /**
     * STEP 7 — STRIP MARKDOWN FENCES BEFORE PARSING
     * GPT models sometimes wrap JSON in ```json ... ``` blocks
     */
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let report;
    try {
      report = JSON.parse(cleaned);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid AI JSON output", raw: cleaned },
        { status: 500 }
      );
    }

    /**
     * STEP 8 — SAVE REPORT
     */
    const { data, error } = await supabase
      .from("longevity_reports")
      .insert({
        user_id: userId,
        assessment_id: assessment?.id,
        report,
        risk_score: report.risk_score,
        primary_goal: report.primary_goal,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    /**
     * STEP 9 — RESPONSE
     */
    return NextResponse.json({
      success: true,
      report: data,
      memory: conversationMemory,
      adaptive_weights: adaptiveWeights,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}