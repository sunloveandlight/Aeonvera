"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Profile = {
  display_name: string | null;
  plan: string | null;
  subscription_status: string | null;
  biological_age: number | null;
};

type Report = {
  id: string;
  risk_score: number;
  primary_goal: string;
  created_at: string;
};

type Alert = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  recommendation: string;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [hasAssessment, setHasAssessment] = useState(false);
  const [assessmentAge, setAssessmentAge] = useState<number | null>(null);
  const [accuracyScore, setAccuracyScore] = useState<number>(40);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.replace("/login");

        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name, plan, subscription_status, biological_age")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profileData) return router.replace("/onboarding");
        if (!isUserAllowed(profileData.plan, profileData.subscription_status)) {
          return router.replace("/pricing");
        }

        setProfile(profileData);

        const [reportRes, assessmentRes, alertsRes] = await Promise.all([
          supabase
            .from("longevity_reports")
            .select("id, risk_score, primary_goal, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("longevity_assessments")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("health_alerts")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3),
        ]);

        if (reportRes.data) setReport(reportRes.data);

        if (assessmentRes.data) {
          setHasAssessment(true);
          setAssessmentAge(Number(assessmentRes.data.age) || null);

          // Compute accuracy
          const optionalKeys = [
            "resting_hr", "blood_pressure_systolic", "vo2_max", "hrv",
            "fasting_glucose", "hba1c", "ldl", "hdl", "triglycerides",
            "fasting_insulin", "hscrp", "body_fat_pct", "waist_cm",
            "anxiety_level", "social_connection", "purpose_score",
            "family_longevity", "family_heart_disease", "family_diabetes",
          ];
          const filled = optionalKeys.filter(
            (k) => assessmentRes.data[k] != null && assessmentRes.data[k] !== ""
          ).length;
          setAccuracyScore(
            Math.min(100, 40 + Math.round((filled / optionalKeys.length) * 60))
          );

          // Auto-compute bio age if missing
          if (!profileData.biological_age) {
            fetch("/api/longevity/biological-age", {
              method: "POST",
              credentials: "include",
            })
              .then((r) => r.json())
              .then((d) => {
                if (d.result?.biologicalAge) {
                  setProfile((prev) =>
                    prev ? { ...prev, biological_age: d.result.biologicalAge } : prev
                  );
                }
              })
              .catch(console.error);
          }
        }

        if (alertsRes.data) setAlerts(alertsRes.data);

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("System failure. Please retry.");
        setLoading(false);
      }
    };

    run();
  }, [router]);

  async function handleGenerateReport() {
    try {
      setGeneratingReport(true);
      await fetch("/api/longevity/biological-age", { method: "POST", credentials: "include" });
      const res = await fetch("/api/longevity/report", { method: "POST", credentials: "include" });
      if (res.ok) router.push("/report");
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingReport(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
          <div className="absolute inset-0 rounded-full border-t border-[#2997ff]/40 animate-spin" />
        </div>
        <p className="text-white/20 text-[10px] tracking-normal uppercase">Initializing</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400/70 text-sm">
        {error}
      </div>
    );
  }

  const bioAge = profile?.biological_age ?? null;
  const ageDelta = bioAge && assessmentAge ? bioAge - assessmentAge : null;

  const bioAgeColor =
    ageDelta === null ? "text-white/70"
    : ageDelta <= -3 ? "text-green-400"
    : ageDelta <= 0 ? "text-emerald-400"
    : ageDelta <= 4 ? "text-yellow-400"
    : "text-red-400";

  const hour = currentTime.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const systemStatus =
    !hasAssessment ? "UNINITIALIZED"
    : !bioAge ? "COMPUTING"
    : ageDelta !== null && ageDelta <= 0 ? "OPTIMAL"
    : ageDelta !== null && ageDelta <= 4 ? "ATTENTION REQUIRED"
    : "INTERVENTION ADVISED";

  const statusColor =
    systemStatus === "OPTIMAL" ? "text-green-400"
    : systemStatus === "ATTENTION REQUIRED" ? "text-yellow-400"
    : systemStatus === "INTERVENTION ADVISED" ? "text-red-400"
    : "text-white/30";

  return (
    <PageContainer>
      <div className="py-14 space-y-8">

        {/* ═══════════════════════════════════════
            HEADER
        ═══════════════════════════════════════ */}
        <div className="border-b border-white/[0.04] pb-10">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-normal text-white/15 mb-4">
                {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="text-5xl md:text-6xl font-light tracking-normal text-white/90 leading-tight">
                {greeting},
                <br />
                <span className="text-white/40">
                  {profile?.display_name || "User"}
                </span>
              </h1>
              <p className="mt-4 text-white/25 text-sm leading-relaxed max-w-lg">
                Your biological operating system is{" "}
                {hasAssessment ? "active and monitoring." : "waiting for initialization."}
              </p>
            </div>

            {/* SYSTEM STATUS INDICATOR */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.02]">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  systemStatus === "OPTIMAL" ? "bg-green-400"
                  : systemStatus === "ATTENTION REQUIRED" ? "bg-yellow-400"
                  : systemStatus === "INTERVENTION ADVISED" ? "bg-red-400 animate-pulse"
                  : "bg-white/20"
                }`} />
                <span className={`text-[9px] uppercase tracking-normal ${statusColor}`}>
                  {systemStatus}
                </span>
              </div>
              <p className="text-[9px] uppercase tracking-normal text-white/15">
                {profile?.plan || "core"} · {profile?.subscription_status || "active"}
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            HERO ROW — BIO AGE + RISK
        ═══════════════════════════════════════ */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* BIOLOGICAL AGE CARD */}
          <Card title="BIOLOGICAL AGE" glow>
            {bioAge ? (
              <div>
                <div className="flex items-end gap-4 mb-3">
                  <p className={`text-5xl md:text-6xl font-light tracking-normal leading-none ${bioAgeColor}`}>
                    {bioAge}
                    <span className="text-white/15 text-2xl ml-2">yrs</span>
                  </p>
                  {assessmentAge && (
                    <div className="mb-1">
                      <p className="text-[9px] uppercase tracking-normal text-white/15 mb-0.5">Chrono</p>
                      <p className="text-white/35 text-xl font-light">{assessmentAge}</p>
                    </div>
                  )}
                </div>

                {ageDelta !== null && (
                  <p className={`text-sm mb-4 ${bioAgeColor}`}>
                    {ageDelta < 0
                      ? `${Math.abs(ageDelta)} years younger than chronological age`
                      : ageDelta > 0
                      ? `${ageDelta} years older than chronological age`
                      : "Biological age matches chronological age"}
                  </p>
                )}

                {/* ACCURACY BAR */}
                <div className="border-t border-white/[0.04] pt-4">
                  <div className="flex justify-between text-[9px] uppercase tracking-normal text-white/20 mb-2">
                    <span>Estimation Accuracy</span>
                    <span>{accuracyScore}%</span>
                  </div>
                  <div className="h-px bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        accuracyScore >= 80 ? "bg-green-400/50"
                        : accuracyScore >= 60 ? "bg-yellow-400/50"
                        : "bg-orange-400/50"
                      }`}
                      style={{ width: `${accuracyScore}%` }}
                    />
                  </div>
                  {accuracyScore < 70 && (
                    <button
                      onClick={() => router.push("/assessment")}
                      className="mt-2 text-[9px] uppercase tracking-normal text-[#2997ff] hover:text-[#2997ff] transition-colors duration-300"
                    >
                      Add lab data to improve →
                    </button>
                  )}
                </div>
              </div>
            ) : hasAssessment ? (
              <div className="flex items-center gap-4">
                <div className="w-6 h-6 rounded-full border-t border-[#2997ff]/40 animate-spin shrink-0" />
                <p className="text-white/25 text-sm">Computing your biological age...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-white/25 text-sm leading-relaxed">
                  Complete your assessment to compute your biological age across all domains.
                </p>
                <Button href="/assessment">Initialize Assessment</Button>
              </div>
            )}
          </Card>

          {/* RISK + INTELLIGENCE CARD */}
          <Card title="INTELLIGENCE REPORT">
            {report ? (
              <div>
                <div className="flex items-end gap-3 mb-3">
                  <p className={`text-5xl md:text-6xl font-light tracking-normal leading-none ${
                    report.risk_score <= 35 ? "text-green-400"
                    : report.risk_score <= 65 ? "text-yellow-400"
                    : "text-red-400"
                  }`}>
                    {report.risk_score}
                    <span className="text-white/15 text-2xl ml-2">/ 100</span>
                  </p>
                  <p className="text-white/25 text-sm mb-1">risk score</p>
                </div>

                <div className="h-px bg-white/[0.04] overflow-hidden mb-4">
                  <div
                    className={`h-full ${
                      report.risk_score <= 35 ? "bg-green-400/40"
                      : report.risk_score <= 65 ? "bg-yellow-400/40"
                      : "bg-red-400/40"
                    }`}
                    style={{ width: `${report.risk_score}%` }}
                  />
                </div>

                <p className="text-white/30 text-sm leading-relaxed mb-6 line-clamp-2">
                  {report.primary_goal}
                </p>

                <div className="flex items-center gap-3 border-t border-white/[0.04] pt-4">
                  <button
                    onClick={() => router.push("/report")}
                    className="px-4 py-2 rounded-full border border-[#2997ff]/30 text-[#2997ff] hover:border-[#2997ff]/40 hover:text-[#2997ff] transition-all duration-300 text-[10px] uppercase tracking-normal"
                  >
                    Open Report
                  </button>
                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="text-[10px] uppercase tracking-normal text-white/15 hover:text-white/40 transition-colors duration-300 disabled:opacity-30"
                  >
                    {generatingReport ? "Generating..." : "Regenerate"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-white/25 text-sm leading-relaxed">
                  {hasAssessment
                    ? "Your assessment is complete. Generate your first intelligence report."
                    : "Complete your assessment to unlock AI intelligence reports."}
                </p>
                {hasAssessment ? (
                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="px-6 py-2.5 rounded-full border border-[#2997ff]/30 text-[#2997ff] hover:border-[#2997ff]/50 hover:text-[#2997ff] transition-all duration-300 text-[10px] uppercase tracking-normal disabled:opacity-30"
                  >
                    {generatingReport ? "Generating..." : "Generate Intelligence Report"}
                  </button>
                ) : (
                  <Button href="/assessment">Start Assessment</Button>
                )}
              </div>
            )}
          </Card>

        </div>

        {/* ═══════════════════════════════════════
            COACH ALERTS
        ═══════════════════════════════════════ */}
        {alerts.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-normal text-white/15 mb-4">
              Active Intelligence Alerts
            </p>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-4 p-4 rounded-xl border ${
                    alert.severity === "high"
                      ? "border-red-500/15 bg-red-500/[0.04]"
                      : alert.severity === "medium"
                      ? "border-yellow-500/15 bg-yellow-500/[0.04]"
                      : "border-white/[0.05] bg-white/[0.02]"
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                    alert.severity === "high" ? "bg-red-400"
                    : alert.severity === "medium" ? "bg-yellow-400"
                    : "bg-white/30"
                  }`} />
                  <div className="flex-1">
                    <p className="text-white/60 text-sm font-light mb-1">{alert.title}</p>
                    <p className="text-white/30 text-xs leading-relaxed">{alert.recommendation}</p>
                  </div>
                  <span className={`text-[9px] uppercase tracking-normal shrink-0 ${
                    alert.severity === "high" ? "text-red-400/60"
                    : alert.severity === "medium" ? "text-yellow-400/60"
                    : "text-white/20"
                  }`}>
                    {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            QUICK ACTIONS
        ═══════════════════════════════════════ */}
        <div className="grid md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push("/assessment")}
            className="premium-surface rounded-lg p-5 text-left transition-all duration-300 hover:border-white/15 group"
          >
            <p className="text-[10px] uppercase tracking-normal text-white/20 mb-3 group-hover:text-white/30 transition-colors">
              {hasAssessment ? "Update" : "Initialize"}
            </p>
            <p className="text-white/60 text-sm font-light">
              {hasAssessment ? "Update your assessment data" : "Start your assessment"}
            </p>
            <p className="text-[#2997ff] text-[10px] uppercase tracking-normal mt-3">
              {hasAssessment ? "Retake →" : "Start →"}
            </p>
          </button>

          <button
            onClick={() => router.push("/report")}
            className="premium-surface rounded-lg p-5 text-left transition-all duration-300 hover:border-white/15 group"
          >
            <p className="text-[10px] uppercase tracking-normal text-white/20 mb-3 group-hover:text-white/30 transition-colors">
              Intelligence
            </p>
            <p className="text-white/60 text-sm font-light">
              View your full biological profile and 90-day protocol
            </p>
            <p className="text-[#2997ff] text-[10px] uppercase tracking-normal mt-3">
              Open report →
            </p>
          </button>

          <button
            onClick={() => router.push("/pricing")}
            className="premium-surface rounded-lg p-5 text-left transition-all duration-300 hover:border-white/15 group"
          >
            <p className="text-[10px] uppercase tracking-normal text-white/20 mb-3 group-hover:text-white/30 transition-colors">
              Account
            </p>
            <p className="text-white/60 text-sm font-light">
              {profile?.plan ? `${profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)} plan · ${profile.subscription_status}` : "Manage subscription"}
            </p>
            <p className="text-[#2997ff] text-[10px] uppercase tracking-normal mt-3">
              Manage →
            </p>
          </button>
        </div>

      </div>
    </PageContainer>
  );
}
