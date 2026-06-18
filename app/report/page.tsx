"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type ReportData = {
  risk_score: number;
  primary_goal: string;
  risk_profile: {
    sleep_risk: string;
    metabolic_risk: string;
    cardiovascular_risk: string;
    lifestyle_risk: string;
  };
  strengths: string[];
  weaknesses: string[];
  top_priorities: string[];
  "90_day_plan": Array<{
    category: string;
    action: string;
    impact: string;
  }>;
  behavioral_insights: string[];
};

type ProfileData = {
  display_name: string | null;
  biological_age: number | null;
};

type AssessmentData = {
  age: string;
  // cardiovascular
  resting_hr?: string;
  blood_pressure_systolic?: string;
  blood_pressure_diastolic?: string;
  vo2_max?: string;
  hrv?: string;
  // metabolic
  fasting_glucose?: string;
  hba1c?: string;
  ldl?: string;
  hdl?: string;
  triglycerides?: string;
  fasting_insulin?: string;
  hscrp?: string;
  albumin?: string;
  creatinine?: string;
  lymphocyte_pct?: string;
  mean_cell_volume?: string;
  red_cell_distribution_width?: string;
  alkaline_phosphatase?: string;
  white_blood_cell_count?: string;
  // body
  body_fat_pct?: string;
  waist_cm?: string;
  // lifestyle
  sleep_hours?: string;
  sleep_quality?: string;
  exercise_days?: string;
  strength_training?: string;
  diet_type?: string;
  smoking?: string;
  alcohol_use?: string;
  stress_level?: string;
  // mental
  anxiety_level?: string;
  social_connection?: string;
  purpose_score?: string;
  // family
  family_longevity?: string;
  family_heart_disease?: string;
  family_diabetes?: string;
};

type BioAgeHistoryPoint = {
  id: string;
  chronological_age: number | string;
  biological_age: number | string;
  age_delta: number | string;
  score?: number | string | null;
  accuracy_score?: number | string | null;
  category?: string | null;
  source?: string | null;
  result?: {
    clinicalAge?: number;
    clinicalAgeDelta?: number;
    clinicalModel?: string;
    clinicalCompleteness?: number;
  } | null;
  created_at: string;
};

type BioAgeSimulation = {
  id: string;
  title: string;
  domain: string;
  action: string;
  horizon: string;
  projectedAgeDeltaImprovement: number;
  projectedBiologicalAgeImprovement: number;
  projectedBiologicalAge: number;
  projectedScore: number;
  confidence: number;
  keyDrivers: string[];
};

type LabTrend = {
  canonicalKey: string;
  label: string;
  latestValue: number;
  previousValue: number | null;
  unit: string | null;
  measuredAt: string;
  delta: number | null;
  percentChange: number | null;
  status: "improving" | "worsening" | "stable" | "baseline";
  interpretation: string;
  target: string;
};

type ImprovementLoop = {
  status: "improving" | "declining" | "stable" | "building";
  phase4Complete: boolean;
  phase5Ready: boolean;
  latestBiologicalAge: number | null;
  baselineBiologicalAge: number | null;
  biologicalAgeChange: number | null;
  latestAgeDelta: number | null;
  ageDeltaChange: number | null;
  scoreChange: number | null;
  daysTracked: number;
  pacePer30Days: number | null;
  projected90DayChange: number | null;
  headline: string;
  summary: string;
  drivers: Array<{
    label: string;
    value: string;
    status: "positive" | "negative" | "neutral";
    detail: string;
  }>;
  nextActions: Array<{
    domain: string;
    action: string;
    reason: string;
    impact: "low" | "medium" | "high";
  }>;
};

const OPTIONAL_FIELDS: { key: keyof AssessmentData; label: string }[] = [
  { key: "resting_hr", label: "Resting Heart Rate" },
  { key: "blood_pressure_systolic", label: "Blood Pressure" },
  { key: "vo2_max", label: "VO2 Max" },
  { key: "hrv", label: "HRV" },
  { key: "fasting_glucose", label: "Fasting Glucose" },
  { key: "hba1c", label: "HbA1c" },
  { key: "ldl", label: "LDL Cholesterol" },
  { key: "hdl", label: "HDL Cholesterol" },
  { key: "triglycerides", label: "Triglycerides" },
  { key: "fasting_insulin", label: "Fasting Insulin" },
  { key: "hscrp", label: "hsCRP Inflammation" },
  { key: "albumin", label: "Albumin" },
  { key: "creatinine", label: "Creatinine" },
  { key: "lymphocyte_pct", label: "Lymphocyte %" },
  { key: "mean_cell_volume", label: "Mean Cell Volume" },
  { key: "red_cell_distribution_width", label: "Red Cell Distribution Width" },
  { key: "alkaline_phosphatase", label: "Alkaline Phosphatase" },
  { key: "white_blood_cell_count", label: "White Blood Cell Count" },
  { key: "body_fat_pct", label: "Body Fat %" },
  { key: "waist_cm", label: "Waist Circumference" },
  { key: "anxiety_level", label: "Anxiety Level" },
  { key: "social_connection", label: "Social Connection" },
  { key: "purpose_score", label: "Purpose Score" },
  { key: "family_longevity", label: "Family Longevity" },
  { key: "family_heart_disease", label: "Family Heart Disease" },
  { key: "family_diabetes", label: "Family Diabetes" },
];

export default function ReportPage() {
  const router = useRouter();

  const [report, setReport] = useState<ReportData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [bioAge, setBioAge] = useState<number | null>(null);
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [accuracyScore, setAccuracyScore] = useState(40);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [bioAgeHistory, setBioAgeHistory] = useState<BioAgeHistoryPoint[]>([]);
  const [bioAgeSimulations, setBioAgeSimulations] = useState<BioAgeSimulation[]>([]);
  const [labTrends, setLabTrends] = useState<LabTrend[]>([]);
  const [improvementLoop, setImprovementLoop] = useState<ImprovementLoop | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/login"); return; }

        const [
          reportRes,
          profileRes,
          assessmentRes,
          historyRes,
          simulatorRes,
          labTrendsRes,
          improvementLoopRes,
        ] = await Promise.all([
          supabase
            .from("longevity_reports")
            .select("report, created_at, risk_score, primary_goal")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from("profiles")
            .select("display_name, biological_age")
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("longevity_assessments")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
          fetch("/api/longevity/biological-age", {
            credentials: "include",
          }).then((response) => response.json()).catch(() => null),
          fetch("/api/longevity/simulator", {
            credentials: "include",
          }).then((response) => response.json()).catch(() => null),
          fetch("/api/labs/trends", {
            credentials: "include",
          }).then((response) => response.json()).catch(() => null),
          fetch("/api/longevity/improvement-loop", {
            credentials: "include",
          }).then((response) => response.json()).catch(() => null),
        ]);

        if (reportRes.data) setReport(reportRes.data.report as ReportData);
        if (profileRes.data) {
          setProfile(profileRes.data);
          setBioAge(profileRes.data.biological_age);
        }
        if (assessmentRes.data) {
          setAssessment(assessmentRes.data as AssessmentData);

          // Compute accuracy score from filled optional fields
          const filled = OPTIONAL_FIELDS.filter((f) => {
            const val = assessmentRes.data[f.key];
            return val != null && val !== "" && val !== undefined;
          });
          const missing = OPTIONAL_FIELDS.filter((f) => {
            const val = assessmentRes.data[f.key];
            return !val || val === "";
          });
          const score = Math.min(
            100,
            40 + Math.round((filled.length / OPTIONAL_FIELDS.length) * 60)
          );
          setAccuracyScore(score);
          setMissingFields(missing.slice(0, 6).map((f) => f.label));
        }
        if (historyRes?.history) setBioAgeHistory(historyRes.history);
        if (simulatorRes?.simulations) setBioAgeSimulations(simulatorRes.simulations);
        if (labTrendsRes?.trends) setLabTrends(labTrendsRes.trends);
        if (improvementLoopRes?.loop) setImprovementLoop(improvementLoopRes.loop);

        if (!reportRes.data) setError("No report found. Complete your assessment first.");
      } catch {
        setError("Failed to load your report.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  async function handleRegenerate() {
    try {
      setRegenerating(true);
      await fetch("/api/longevity/biological-age", { method: "POST", credentials: "include" });
      const res = await fetch("/api/longevity/report", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (res.ok && data.report?.report) {
        setReport(data.report.report as ReportData);
      }
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
          <div className="absolute inset-0 rounded-full border-t royal-border animate-spin" />
        </div>
        <p className="text-white/20 text-[10px] tracking-[0.14em] uppercase">
          Loading your report
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <PageContainer>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md space-y-6">
            <p className="text-white/20 text-xs uppercase tracking-[0.14em]">No Report Found</p>
            <h1 className="text-4xl font-semibold leading-tight text-white/90">
              No report found.
            </h1>
            <p className="text-white/40 text-sm">{error}</p>
            <Button href="/assessment">Start Assessment</Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  const chronologicalAge = assessment?.age ? Number(assessment.age) : null;
  const ageDelta = bioAge && chronologicalAge ? bioAge - chronologicalAge : null;

  const bioAgeColor = "text-white/86";
  const riskColor = "text-white/86";
  const riskBarColor = "living-bar";

  const categoryLabel =
    ageDelta === null ? null
    : ageDelta <= -5 ? "EXCELLENT"
    : ageDelta <= -1 ? "GOOD"
    : ageDelta <= 4 ? "AVERAGE"
    : "NEEDS ATTENTION";

  const accuracyColor = "text-white/78";

  return (
    <PageContainer>
      <div className="py-16 space-y-8">

        {/* ═══════════════════════════════════════
            HEADER
        ═══════════════════════════════════════ */}
        <div className="pb-10 border-b border-white/[0.04]">
          <p className="text-[10px] tracking-[0.14em] text-white/15 uppercase mb-6">
            Aeonvera — Your report
          </p>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white/90 leading-tight">
                {profile?.display_name ? `${profile.display_name}'s` : "Your"}
                <br />
                <span className="text-white/30">Biological Profile</span>
              </h1>
              <p className="mt-4 text-white/25 text-sm">
                Personalized longevity intelligence · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              {/* ACCURACY BADGE */}
              <div className="premium-status flex items-center gap-3 rounded-md px-4 py-2">
                <div className="relative w-8 h-8">
                  <svg className="w-8 h-8 -rotate-90 text-white/80" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeOpacity={0.05} strokeWidth="3" />
                    <circle
                      cx="16" cy="16" r="13" fill="none"
                      stroke={accuracyScore >= 80 ? "rgba(74,222,128,0.7)" : accuracyScore >= 60 ? "rgba(250,204,21,0.7)" : "rgba(251,146,60,0.7)"}
                      strokeWidth="3"
                      strokeDasharray={`${(accuracyScore / 100) * 81.7} 81.7`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-white/60">
                    {accuracyScore}
                  </span>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">Accuracy</p>
                  <p className={`text-xs font-light ${accuracyColor}`}>{accuracyScore}% complete</p>
                </div>
              </div>

              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="premium-action-secondary inline-flex h-9 items-center justify-center px-5 rounded-md transition-all duration-300 text-[10px] uppercase tracking-[0.14em] disabled:opacity-20"
              >
                {regenerating ? "Regenerating..." : "Regenerate Report"}
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            HERO METRICS
        ═══════════════════════════════════════ */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* BIOLOGICAL AGE */}
          <Card title="BIOLOGICAL AGE" glow>
            <div className="pt-2">
              {bioAge ? (
                <>
                  <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
                    <div>
                      <p className="micro-label mb-2">Biological</p>
                      <div className="flex items-baseline gap-3">
                        <p className={`text-6xl font-semibold tracking-tight leading-none ${bioAgeColor}`}>
                          {bioAge}
                        </p>
                        <span className="text-2xl font-light leading-none text-white/24">yrs</span>
                      </div>
                    </div>
                    {chronologicalAge && (
                      <div className="min-w-[7rem] border-l border-white/[0.07] pl-5">
                        <p className="micro-label mb-2">Chronological</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-semibold leading-none text-white/58">{chronologicalAge}</p>
                          <span className="text-sm leading-none text-white/24">yrs</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {ageDelta !== null && (
                    <div className="premium-status-neutral mb-4 inline-flex items-center gap-2 rounded-md px-3 py-1.5">
                      <span className={`text-xs ${bioAgeColor}`}>
                        {ageDelta < 0
                          ? `${Math.abs(ageDelta)} years younger than chronological age`
                          : ageDelta > 0
                          ? `${ageDelta} years older than chronological age`
                          : "Matches chronological age"}
                      </span>
                    </div>
                  )}

                  {categoryLabel && (
                    <p className={`text-[10px] uppercase tracking-[0.14em] mb-4 ${bioAgeColor}`}>
                      {categoryLabel}
                    </p>
                  )}

                  <p className="text-white/20 text-xs leading-relaxed border-t border-white/[0.04] pt-4">
                    Estimated from {accuracyScore >= 70 ? "comprehensive" : "lifestyle"} biomarkers.
                    {accuracyScore < 70 && " Add lab values to improve accuracy."}
                  </p>
                </>
              ) : (
                <p className="text-white/25 text-sm">Not yet computed.</p>
              )}
            </div>
          </Card>

          {/* RISK SCORE */}
          <Card title="RISK INDEX">
            <div className="pt-2">
              <p className={`text-6xl md:text-6xl font-semibold tracking-tight leading-none mb-4 ${riskColor}`}>
                {report.risk_score}
                <span className="text-white/20 text-3xl ml-2">/ 100</span>
              </p>

              <div className="mb-4 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${riskBarColor}`}
                  style={{ width: `${report.risk_score}%` }}
                />
              </div>

              <p className="text-white/30 text-sm mb-6">
                {report.risk_score <= 35
                  ? "Low biological risk. Your system is performing exceptionally."
                  : report.risk_score <= 65
                  ? "Moderate biological risk. Targeted improvements will move the needle."
                  : "Elevated biological risk. Immediate lifestyle intervention is advised."}
              </p>

              {/* RISK PROFILE MINI */}
              <div className="grid grid-cols-2 gap-2 border-t border-white/[0.04] pt-4">
                {Object.entries(report.risk_profile).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                      {key.replace(/_risk/g, "").replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-white/55">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

        </div>

        {/* ═══════════════════════════════════════
            PRIMARY OBJECTIVE
        ═══════════════════════════════════════ */}
        <Card title="PRIMARY OBJECTIVE">
          <p className="text-2xl md:text-3xl font-semibold text-white/80 leading-relaxed">
            {report.primary_goal}
          </p>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <BioAgeHistoryCard
            history={bioAgeHistory}
            currentBioAge={bioAge}
            chronologicalAge={chronologicalAge}
          />
          <BioAgeSimulationCard
            simulations={bioAgeSimulations}
            onOpenOptimization={() => router.push("/optimization")}
          />
        </div>

        <ImprovementLoopCard
          loop={improvementLoop}
          onOpenOptimization={() => router.push("/optimization")}
        />

        <LabTrendsCard trends={labTrends} />

        {/* ═══════════════════════════════════════
            STRENGTHS + WEAKNESSES
        ═══════════════════════════════════════ */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card title="BIOLOGICAL STRENGTHS">
            <div className="space-y-3">
              {report.strengths.map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
                  <span className="mt-0.5 shrink-0 text-sm text-white/45">↑</span>
                  <p className="text-white/60 text-sm leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="OPTIMIZATION TARGETS">
            <div className="space-y-3">
              {report.weaknesses.map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
                  <span className="mt-0.5 shrink-0 text-sm text-white/45">↓</span>
                  <p className="text-white/60 text-sm leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ═══════════════════════════════════════
            TOP PRIORITIES
        ═══════════════════════════════════════ */}
        <Card title="TOP INTERVENTION PRIORITIES">
          <div className="space-y-3">
            {report.top_priorities.map((p, i) => (
              <div key={i} className="flex items-start gap-5 rounded-lg border border-white/[0.04] bg-white/[0.02] p-4 transition-colors duration-300 hover:border-white/[0.08]">
                <span className="royal-text text-sm font-light shrink-0 mt-0.5 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-white/60 text-sm leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ═══════════════════════════════════════
            90-DAY PLAN
        ═══════════════════════════════════════ */}
        <Card title="90-DAY OPTIMIZATION PROTOCOL">
          <div className="space-y-3">
            {report["90_day_plan"].map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.04] bg-white/[0.02] p-4 transition-colors duration-300 hover:border-white/[0.07]">
                <div className="flex-1">
                  <p className="text-[9px] uppercase tracking-[0.14em] royal-text mb-1.5">
                    {item.category}
                  </p>
                  <p className="text-white/60 text-sm leading-relaxed">{item.action}</p>
                </div>
                <span className="premium-status shrink-0 rounded-md px-3 py-1.5 text-[9px] uppercase tracking-[0.14em]">
                  {item.impact}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* ═══════════════════════════════════════
            BEHAVIORAL INTELLIGENCE
        ═══════════════════════════════════════ */}
        <Card title="BEHAVIORAL INTELLIGENCE">
          <div className="space-y-4">
            {report.behavioral_insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-4 border-l-2 border-white/12 pl-5 py-1">
                <p className="text-white/50 text-sm leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ═══════════════════════════════════════
            ACCURACY UPGRADE PROMPT
        ═══════════════════════════════════════ */}
        {accuracyScore < 80 && missingFields.length > 0 && (
          <Card title="IMPROVE ACCURACY" glow>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1">
                <p className="text-white/50 text-sm mb-4 leading-relaxed">
                  Your biological age estimate is currently <span className={accuracyColor}>{accuracyScore}% accurate</span>.
                  Adding the following data points will significantly improve precision:
                </p>
                <div className="flex flex-wrap gap-2">
                  {missingFields.map((field, i) => (
                    <span key={i} className="premium-status rounded-md px-3 py-1 text-[10px] uppercase tracking-[0.14em]">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
              <Button href="/assessment">
                Add Data
              </Button>
            </div>
          </Card>
        )}

        {/* ═══════════════════════════════════════
            FOOTER
        ═══════════════════════════════════════ */}
        <div className="flex items-center justify-between pt-8 border-t border-white/[0.04]">
          <p className="text-white/15 text-xs">
            Generated by Aeonvera AI · For informational purposes only
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" href="/dashboard">
              Dashboard
            </Button>
            <Button href="/assessment">
              Update Assessment
            </Button>
          </div>
        </div>

      </div>
    </PageContainer>
  );
}

function BioAgeHistoryCard({
  history,
  currentBioAge,
  chronologicalAge,
}: {
  history: BioAgeHistoryPoint[];
  currentBioAge: number | null;
  chronologicalAge: number | null;
}) {
  const points = history
    .slice()
    .reverse()
    .map((point) => ({
      biological: Number(point.biological_age),
      chronological: Number(point.chronological_age),
      createdAt: point.created_at,
    }))
    .filter(
      (point) =>
        Number.isFinite(point.biological) && Number.isFinite(point.chronological)
    );
  const displayPoints =
    points.length > 0
      ? points
      : currentBioAge && chronologicalAge
      ? [
          {
            biological: currentBioAge,
            chronological: chronologicalAge,
            createdAt: new Date().toISOString(),
          },
        ]
      : [];

  const values = displayPoints.flatMap((point) => [
    point.biological,
    point.chronological,
  ]);
  const min = values.length ? Math.min(...values) - 1 : 0;
  const max = values.length ? Math.max(...values) + 1 : 1;
  const span = Math.max(1, max - min);
  const biologicalLine = displayPoints.map((point, index) => {
    const x =
      displayPoints.length === 1
        ? 50
        : (index / (displayPoints.length - 1)) * 100;
    const y = 88 - ((point.biological - min) / span) * 76;
    return `${x},${y}`;
  });
  const chronologicalLine = displayPoints.map((point, index) => {
    const x =
      displayPoints.length === 1
        ? 50
        : (index / (displayPoints.length - 1)) * 100;
    const y = 88 - ((point.chronological - min) / span) * 76;
    return `${x},${y}`;
  });
  const first = displayPoints[0];
  const latest = displayPoints[displayPoints.length - 1];
  const latestClinical = history.find((point) => point.result?.clinicalAge)?.result;
  const change = first && latest
    ? Number((latest.biological - first.biological).toFixed(1))
    : 0;

  return (
    <Card title="BIOLOGICAL AGE TRAJECTORY" glow>
      {displayPoints.length ? (
        <div>
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-4xl font-semibold leading-none text-white/86">
                {latest.biological}
                <span className="ml-2 text-xl text-white/22">yrs</span>
              </p>
              <p className="mt-3 text-sm leading-6 text-white/38">
                Current biological age against chronological baseline.
              </p>
            </div>
            <div className="premium-status-neutral rounded-md px-3 py-2 text-[10px] uppercase tracking-[0.14em]">
              {change === 0
                ? "Baseline active"
                : change < 0
                ? `${Math.abs(change)} yrs improved`
                : `${change} yrs higher`}
            </div>
          </div>

          <svg viewBox="0 0 100 100" className="h-44 w-full overflow-visible text-white/80" aria-hidden="true">
            <polyline
              points={chronologicalLine.join(" ")}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.16}
              strokeDasharray="3 4"
              strokeWidth="1.5"
            />
            <polyline
              points={biologicalLine.join(" ")}
              fill="none"
              stroke="rgba(var(--gold),0.9)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.8"
            />
            {biologicalLine.map((point, index) => {
              const [cx, cy] = point.split(",");
              return (
                <circle
                  key={`${point}-${index}`}
                  cx={cx}
                  cy={cy}
                  r={index === biologicalLine.length - 1 ? "3.2" : "2.2"}
                  fill="currentColor"
                  fillOpacity={0.92}
                />
              );
            })}
          </svg>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["History", `${displayPoints.length} point${displayPoints.length === 1 ? "" : "s"}`],
              ["Signal", "Biological"],
              ["Baseline", "Chronological"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
                <p className="text-[9px] uppercase tracking-[0.14em] text-white/24">{label}</p>
                <p className="mt-2 text-sm text-white/62">{value}</p>
              </div>
            ))}
          </div>
          {latestClinical?.clinicalAge && (
            <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="micro-label">Clinical Biomarker Layer</p>
                  <p className="mt-2 text-sm leading-6 text-white/42">
                    PhenoAge-style lab model active at {latestClinical.clinicalCompleteness || 0}% completeness.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-2xl font-light royal-text">
                    {latestClinical.clinicalAge}
                    <span className="ml-1 text-sm text-white/25">yrs</span>
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/25">
                    Clinical estimate
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm leading-7 text-white/38">
          Generate a biological age score to activate your historical trajectory.
        </p>
      )}
    </Card>
  );
}

function BioAgeSimulationCard({
  simulations,
  onOpenOptimization,
}: {
  simulations: BioAgeSimulation[];
  onOpenOptimization: () => void;
}) {
  const topSimulation = simulations[0];

  return (
    <Card title="WHAT WOULD CHANGE YOUR AGE" onClick={onOpenOptimization} actionLabel="Open optimization">
      {topSimulation ? (
        <div className="flex h-full flex-col">
          <div className="mb-5 rounded-lg border border-white/[0.06] bg-white/[0.025] p-5">
            <p className="micro-label mb-4">{topSimulation.domain}</p>
            <div className="flex items-end gap-3">
              <p className="text-5xl font-semibold leading-none royal-text">
                {topSimulation.projectedAgeDeltaImprovement.toFixed(1)}
              </p>
              <p className="mb-1 text-xs uppercase tracking-[0.14em] text-white/24">
                yrs potential
              </p>
            </div>
            <p className="mt-5 text-lg font-light leading-7 text-white/78">
              {topSimulation.title}
            </p>
            <p className="mt-3 text-sm leading-7 text-white/42">
              {topSimulation.action}
            </p>
          </div>

          <div className="space-y-3">
            {simulations.slice(1, 4).map((simulation) => (
              <div key={simulation.id} className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
                <div>
                  <p className="text-sm text-white/68">{simulation.title}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/24">
                    {simulation.horizon}
                  </p>
                </div>
                <span className="royal-text text-sm">
                  {simulation.projectedAgeDeltaImprovement.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm leading-7 text-white/38">
          Once your biological age is generated, Aeonvera will show the highest-impact intervention levers here.
        </p>
      )}
    </Card>
  );
}

function ImprovementLoopCard({
  loop,
  onOpenOptimization,
}: {
  loop: ImprovementLoop | null;
  onOpenOptimization: () => void;
}) {
  return (
    <Card title="BIOLOGICAL AGE IMPROVEMENT LOOP" onClick={onOpenOptimization} actionLabel="Open optimization">
      {loop ? (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="micro-label">Next step</p>
              <span className={improvementStatusClassName(loop.status)}>
                {loop.status}
              </span>
            </div>
            <p className="text-2xl font-light leading-tight text-white/82">
              {loop.headline}
            </p>
            <p className="mt-4 text-sm leading-7 text-white/42">
              {loop.summary}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[
                ["Step 1", loop.phase4Complete ? "closed" : "building"],
                ["Next step", loop.phase5Ready ? "ready" : "building"],
                ["90d pace", loop.projected90DayChange == null ? "new" : `${loop.projected90DayChange > 0 ? "+" : ""}${loop.projected90DayChange}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-white/22">{label}</p>
                  <p className="mt-2 text-sm text-white/62">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {loop.drivers.slice(0, 4).map((driver) => (
              <div
                key={`${driver.label}-${driver.value}`}
                className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-white/24">
                    {driver.label}
                  </p>
                  <span className={driverStatusClassName(driver.status)}>
                    {driver.value}
                  </span>
                </div>
                <p className="line-clamp-3 text-xs leading-5 text-white/38">
                  {driver.detail}
                </p>
              </div>
            ))}
            {loop.nextActions[0] && (
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4 sm:col-span-2">
                <p className="micro-label mb-3">Next Protocol Move</p>
                <p className="text-sm leading-6 text-white/70">{loop.nextActions[0].action}</p>
                <p className="mt-2 text-xs leading-5 text-white/36">{loop.nextActions[0].reason}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm leading-7 text-white/38">
          Generate another biological-age point to activate the improvement loop.
        </p>
      )}
    </Card>
  );
}

function LabTrendsCard({ trends }: { trends: LabTrend[] }) {
  return (
    <Card title="CLINICAL LAB TRENDS">
      {trends.length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {trends.slice(0, 9).map((trend) => (
            <div
              key={trend.canonicalKey}
              className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-[9px] uppercase tracking-[0.14em] text-white/25">
                  {trend.label}
                </p>
                <span className={labTrendClassName(trend.status)}>
                  {trend.status}
                </span>
              </div>
              <p className="text-2xl font-light text-white/78">
                {trend.latestValue}
                <span className="ml-1 text-xs text-white/28">{trend.unit || ""}</span>
              </p>
              <p className="mt-3 text-xs leading-5 text-white/38">
                {trend.interpretation}
              </p>
              <p className="mt-3 border-t border-white/[0.05] pt-3 text-[9px] uppercase tracking-[0.14em] text-white/22">
                Target: {trend.target}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-7 text-white/38">
          Import labs twice over time to unlock biomarker trend intelligence.
        </p>
      )}
    </Card>
  );
}

function labTrendClassName(status: LabTrend["status"]) {
  const base = "rounded-md px-2 py-1 text-[8px] uppercase tracking-[0.14em]";

  if (status === "improving") return `${base} royal-text bg-white/[0.035]`;
  if (status === "worsening") return `${base} text-rose-200/70 bg-rose-400/[0.08]`;
  if (status === "stable") return `${base} text-white/34 bg-white/[0.025]`;
  return `${base} text-white/28 bg-white/[0.02]`;
}

function improvementStatusClassName(status: ImprovementLoop["status"]) {
  const base = "rounded-md px-2.5 py-1 text-[8px] uppercase tracking-[0.14em]";

  if (status === "improving") return `${base} royal-text bg-white/[0.035]`;
  if (status === "declining") return `${base} text-rose-200/70 bg-rose-400/[0.08]`;
  if (status === "stable") return `${base} text-white/38 bg-white/[0.025]`;
  return `${base} text-white/28 bg-white/[0.02]`;
}

function driverStatusClassName(status: ImprovementLoop["drivers"][number]["status"]) {
  const base = "rounded-md px-2 py-1 text-[8px] uppercase tracking-[0.14em]";

  if (status === "positive") return `${base} royal-text bg-white/[0.035]`;
  if (status === "negative") return `${base} text-rose-200/70 bg-rose-400/[0.08]`;
  return `${base} text-white/30 bg-white/[0.025]`;
}
