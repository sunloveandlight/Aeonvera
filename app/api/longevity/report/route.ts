import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";
import { cookies } from "next/headers";
import { predictHealthRisks } from "@/lib/prediction/riskPredictionEngine";
import { computeAdaptiveWeights } from "@/lib/personalization/adaptiveWeightEngine";

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
          cookiesToSet.forEach(
            ({
              name,
              value,
              options,
            }: {
              name: string;
              value: string;
              options?: any;
            }) => {
              cookieStore.set(name, value, options);
            }
          );
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
     * STEP 1 — PROFILE + ASSESSMENT
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

    if (!assessment) {
      return NextResponse.json(
        { error: "No assessment found" },
        { status: 400 }
      );
    }

    /**
     * STEP 2 — HEALTH STATE (FOR PREDICTION + PERSONALIZATION)
     */
    const { data: state } = await supabase
      .from("health_states")
      .select("*")
      .eq("user_id", userId)
      .single();

    /**
     * STEP 3 — BEHAVIOR EVENTS (FOR PERSONALIZATION)
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
     * STEP 4 — PREDICTION ENGINE
     */
    const predictedRisks = state
      ? predictHealthRisks({
          userId,
          baseline: state.baseline,
          trends: state.trends,
          riskScores: state.risk_scores,
          insights: state.insights,
          updatedAt: state.updated_at,
        })
      : null;

    /**
     * STEP 5 — 🔥 PERSONALIZED AI PROMPT (NEW CORE LOGIC)
     */
    const prompt = `
You are Aeonvera, a longevity intelligence engine.

You analyze human biological + lifestyle data and produce structured optimization intelligence.

You are now PERSONALIZED per-user.

## PERSONALIZATION WEIGHTS (IMPORTANT)
These weights indicate what this user responds to best:

${JSON.stringify(adaptiveWeights, null, 2)}

## INTERPRETATION RULE:
- Higher weight = prioritize this domain more in recommendations
- Lower weight = deprioritize or avoid overfocusing

## PREDICTIVE CONTEXT:
${JSON.stringify(predictedRisks, null, 2)}

## USER PROFILE:
${JSON.stringify(profile, null, 2)}

## ASSESSMENT:
${JSON.stringify(assessment, null, 2)}

IMPORTANT RULES:
- Do NOT give medical diagnoses
- Focus on actionable optimization
- Tailor reasoning to user responsiveness patterns
- Be structured and concise
- Output must be valid JSON only

OUTPUT FORMAT:
Return ONLY valid JSON:

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
     * STEP 6 — OPENAI CALL
     */
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a precise personalized health intelligence engine. Adapt outputs to user-specific behavior patterns.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    const content = completion.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: "No AI response" },
        { status: 500 }
      );
    }

    let report;
    try {
      report = JSON.parse(content);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid AI JSON output", raw: content },
        { status: 500 }
      );
    }

    /**
     * STEP 7 — SAVE REPORT
     */
    const { data, error } = await supabase
      .from("longevity_reports")
      .insert({
        user_id: userId,
        assessment_id: assessment.id,
        report,
        risk_score: report.risk_score,
        primary_goal: report.primary_goal,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    /**
     * STEP 8 — RESPONSE
     */
    return NextResponse.json({
      success: true,
      report: data,
      predicted_risks: predictedRisks,
      adaptive_weights: adaptiveWeights,
    });
  } catch (err: any) {
    console.error("AI Report Error:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}