import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  computeBiologicalAge,
  AssessmentInput,
} from "@/lib/longevity/biologicalAgeEngine";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

async function getSupabaseUser() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function GET() {
  try {
    const supabaseUser = await getSupabaseUser();
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("biological_age_history")
      .select("id, chronological_age, biological_age, age_delta, score, accuracy_score, category, source, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(24);

    if (error) {
      if (isMissingHistoryTable(error)) {
        return NextResponse.json({ history: [] });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ history: data || [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load biological age history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUser = await getSupabaseUser();
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const supabase = getSupabaseAdmin();

    const { data: assessment, error: assessmentError } = await supabase
      .from("longevity_assessments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (assessmentError || !assessment) {
      return NextResponse.json(
        { error: "No assessment found." },
        { status: 404 }
      );
    }

    const safeNum = (v: unknown): number | undefined => {
      const n = Number(v);
      return !isNaN(n) && v !== "" && v != null ? n : undefined;
    };

    const input: AssessmentInput = {
      // Required
      age: Number(assessment.age) || 30,
      sex: assessment.sex || "unknown",
      height_cm: Number(assessment.height_cm) || 170,
      weight_kg: Number(assessment.weight_kg) || 70,
      sleep_hours: Number(assessment.sleep_hours) || 7,
      sleep_quality: Number(assessment.sleep_quality) || 5,
      exercise_days: Number(assessment.exercise_days) || 0,
      strength_training: assessment.strength_training?.toLowerCase() === "yes",
      diet_type: assessment.diet_type || "standard",
      alcohol_use: assessment.alcohol_use || "none",
      smoking: assessment.smoking || "never",
      stress_level: Number(assessment.stress_level) || 5,
      primary_goal: assessment.primary_goal || "",

      // Cardiovascular
      resting_hr: safeNum(assessment.resting_hr),
      blood_pressure_systolic: safeNum(assessment.blood_pressure_systolic),
      blood_pressure_diastolic: safeNum(assessment.blood_pressure_diastolic),
      vo2_max: safeNum(assessment.vo2_max),
      hrv: safeNum(assessment.hrv),

      // Metabolic
      fasting_glucose: safeNum(assessment.fasting_glucose),
      hba1c: safeNum(assessment.hba1c),
      total_cholesterol: safeNum(assessment.total_cholesterol),
      ldl: safeNum(assessment.ldl),
      hdl: safeNum(assessment.hdl),
      triglycerides: safeNum(assessment.triglycerides),
      fasting_insulin: safeNum(assessment.fasting_insulin),
      hscrp: safeNum(assessment.hscrp),

      // Body
      body_fat_pct: safeNum(assessment.body_fat_pct),
      waist_cm: safeNum(assessment.waist_cm),

      // Sleep extras
      recovery_quality: safeNum(assessment.recovery_quality),
      screen_time_before_bed: assessment.screen_time_before_bed || undefined,

      // Lifestyle
      water_intake: assessment.water_intake || undefined,
      fasting_type: assessment.fasting_type || undefined,
      supplements: assessment.supplements || undefined,
      sunlight_hours: assessment.sunlight_hours || undefined,
      cold_exposure: assessment.cold_exposure || undefined,

      // Mental
      anxiety_level: safeNum(assessment.anxiety_level),
      cognitive_score: safeNum(assessment.cognitive_score),
      social_connection: safeNum(assessment.social_connection),
      purpose_score: safeNum(assessment.purpose_score),

      // Hormones
      testosterone: safeNum(assessment.testosterone),
      cortisol: safeNum(assessment.cortisol),

      // Family
      family_heart_disease: assessment.family_heart_disease || undefined,
      family_cancer: assessment.family_cancer || undefined,
      family_diabetes: assessment.family_diabetes || undefined,
      family_longevity: assessment.family_longevity || undefined,
    };

    const result = computeBiologicalAge(input);
    const body = await readJsonBody(request);
    const source = normalizeSource(body?.source);

    await supabase
      .from("profiles")
      .update({
        biological_age: result.biologicalAge,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    const { data: historyPoint } = await supabase
      .from("biological_age_history")
      .insert({
        user_id: userId,
        assessment_id: assessment.id,
        chronological_age: result.chronologicalAge,
        biological_age: result.biologicalAge,
        age_delta: result.ageDelta,
        score: result.score,
        accuracy_score: result.accuracyScore,
        category: result.category,
        source,
        result,
      })
      .select("id, chronological_age, biological_age, age_delta, score, accuracy_score, category, source, created_at")
      .single();

    return NextResponse.json({ success: true, result, history: historyPoint || null });
  } catch (err: unknown) {
    console.error("Biological age error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizeSource(value: unknown) {
  return value === "wearable" || value === "simulation" || value === "system"
    ? value
    : "assessment";
}

function isMissingHistoryTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("biological_age_history") ||
    error.message?.includes("schema cache")
  );
}
