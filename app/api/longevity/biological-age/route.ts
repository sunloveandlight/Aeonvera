import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  computeBiologicalAge,
  AssessmentInput,
} from "@/lib/longevity/biologicalAgeEngine";

async function getSupabaseUser() {
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

export async function POST() {
  try {
    /**
     * STEP 1 — AUTH
     */
    const supabaseUser = await getSupabaseUser();

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const supabase = getSupabaseAdmin();

    /**
     * STEP 2 — FETCH LATEST ASSESSMENT
     */
    const { data: assessment, error: assessmentError } = await supabase
      .from("longevity_assessments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (assessmentError || !assessment) {
      return NextResponse.json(
        { error: "No assessment found. Complete your assessment first." },
        { status: 404 }
      );
    }

    /**
     * STEP 3 — PARSE + VALIDATE INPUT
     */
    const age = Number(assessment.age);
    const height_cm = Number(assessment.height_cm);
    const weight_kg = Number(assessment.weight_kg);
    const sleep_hours = Number(assessment.sleep_hours);
    const sleep_quality = Number(assessment.sleep_quality);
    const exercise_days = Number(assessment.exercise_days);
    const stress_level = Number(assessment.stress_level);

    if (!age || !height_cm || !weight_kg) {
      return NextResponse.json(
        { error: "Assessment is missing required fields." },
        { status: 400 }
      );
    }

    const input: AssessmentInput = {
      age,
      sex: assessment.sex || "unknown",
      height_cm,
      weight_kg,
      sleep_hours: sleep_hours || 7,
      sleep_quality: sleep_quality || 5,
      exercise_days: exercise_days || 0,
      strength_training:
        assessment.strength_training?.toLowerCase() === "yes",
      diet_type: assessment.diet_type || "standard",
      alcohol_use: assessment.alcohol_use || "none",
      smoking: assessment.smoking || "never",
      stress_level: stress_level || 5,
      primary_goal: assessment.primary_goal || "",
    };

    /**
     * STEP 4 — COMPUTE BIOLOGICAL AGE
     */
    const result = computeBiologicalAge(input);

    /**
     * STEP 5 — SAVE TO PROFILES
     */
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        biological_age: result.biologicalAge,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to save biological age:", updateError.message);
    }

    /**
     * STEP 6 — RETURN RESULT
     */
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error("Biological age error:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}