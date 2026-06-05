import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// 🔥 Stable server client (NO SSR cookies at all)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    console.log("STEP 1: ROUTE HIT");

    // Get auth header safely (prevents hanging)
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing auth header" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid user" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // PROFILE
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    // LATEST ASSESSMENT
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

    // OPENAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Return only valid JSON.",
        },
        {
          role: "user",
          content: JSON.stringify({
            profile,
            assessment,
          }),
        },
      ],
    });

    const content = completion.choices[0].message.content;

    return NextResponse.json({
      success: true,
      raw: content,
    });
  } catch (err: any) {
    console.log("FATAL:", err);

    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}