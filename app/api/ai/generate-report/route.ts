import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ✅ Production-safe Supabase server client (NO cookies() usage)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
      },
    }
  );
}

export async function POST() {
  try {
    const supabase = getSupabase();

    // 1. Get user from JWT (works with Supabase auth cookies automatically)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // 2. Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    // 3. Get latest assessment
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

    // 4. AI prompt
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Aeonvera, a longevity intelligence engine. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `
Analyze this user:

PROFILE:
${JSON.stringify(profile, null, 2)}

ASSESSMENT:
${JSON.stringify(assessment, null, 2)}

Return JSON with:
- risk_score (0-100)
- primary_goal
- strengths
- weaknesses
- top_priorities
- 90_day_plan
          `,
        },
      ],
      temperature: 0.4,
    });

    const content = completion.choices[0].message.content;

    if (!content) {
      return NextResponse.json(
        { error: "No AI response" },
        { status: 500 }
      );
    }

    let report;
    try {
      report = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from AI", raw: content },
        { status: 500 }
      );
    }

    // 5. Save report
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      report: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}