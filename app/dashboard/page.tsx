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
};

type Report = {
  id: string;
  risk_score: number;
  primary_goal: string;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openingPortal, setOpeningPortal] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [hasAssessment, setHasAssessment] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name, plan, subscription_status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profileData) {
          router.replace("/onboarding");
          return;
        }

        if (!isUserAllowed(profileData.plan, profileData.subscription_status)) {
          router.replace("/pricing");
          return;
        }

        setProfile(profileData);

        const { data: existingReport } = await supabase
          .from("longevity_reports")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingReport) setReport(existingReport);

        const { data: assessment } = await supabase
          .from("longevity_assessments")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        setHasAssessment(!!assessment);

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("System failure. Please retry.");
        setLoading(false);
      }
    };

    run();
  }, [router]);

  async function generateReport() {
    try {
      setGeneratingReport(true);

      const res = await fetch("/api/longevity/report", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to generate report");
        return;
      }

      setReport(data.report);
    } finally {
      setGeneratingReport(false);
    }
  }

  async function openBillingPortal() {
    try {
      setOpeningPortal(true);

      const res = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      window.location.href = data.url;
    } catch {
      alert("Failed to open billing portal.");
    } finally {
      setOpeningPortal(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/40 tracking-[0.3em] text-xs uppercase">
        Initializing Aeonvera Intelligence Layer...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="py-20 space-y-12">

        {/* ================= HEADER ================= */}
        <div className="space-y-6">
          <p className="text-[10px] tracking-[0.5em] text-white/30 uppercase">
            Aeonvera Command System
          </p>

          <h1 className="text-5xl md:text-6xl font-light tracking-tight text-white/90">
            Dashboard
          </h1>

          <p className="text-white/40 max-w-2xl leading-relaxed">
            Your biological intelligence layer. Monitor your system status, generate insights,
            and manage your longevity profile.
          </p>
        </div>

        {/* ================= PRIMARY STATUS ================= */}
        <Card title="SYSTEM STATUS" glow>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-10">

            <div>
              {report ? (
                <>
                  <p className="text-white/40 text-sm mb-2">
                    Active intelligence model
                  </p>

                  <div className="text-5xl font-light text-white">
                    {report.risk_score}
                    <span className="text-white/30 text-2xl"> / 100</span>
                  </div>

                  <p className="text-white/30 text-sm mt-3">
                    Last updated {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </>
              ) : hasAssessment ? (
                <>
                  <p className="text-white/40 text-sm">
                    Assessment complete. Your system is ready for analysis.
                  </p>
                  <p className="text-white/60 mt-2">
                    Generate your longevity intelligence report.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-white/40 text-sm">
                    No biological profile detected.
                  </p>
                  <p className="text-white/60 mt-2">
                    Begin your assessment to initialize your system.
                  </p>
                </>
              )}
            </div>

            <div className="flex gap-3">
              {report ? (
                <Button onClick={() => router.push("/report")}>
                  Open Report
                </Button>
              ) : hasAssessment ? (
                <Button onClick={generateReport} disabled={generatingReport}>
                  {generatingReport ? "Processing..." : "Generate Report"}
                </Button>
              ) : (
                <Button onClick={() => router.push("/assessment")}>
                  Start Assessment
                </Button>
              )}
            </div>

          </div>
        </Card>

        {/* ================= SECONDARY GRID ================= */}
        <div className="grid md:grid-cols-2 gap-6">

          <Card title="SUBSCRIPTION">
            <div className="space-y-6">
              <div>
                <p className="text-white/40 text-sm">Current plan</p>
                <h3 className="text-2xl font-light text-white uppercase mt-2">
                  {profile?.plan || "core"}
                </h3>
              </div>

              <Button variant="secondary" onClick={openBillingPortal} disabled={openingPortal}>
                {openingPortal ? "Opening..." : "Manage Plan"}
              </Button>
            </div>
          </Card>

          <Card title="QUICK ACTIONS">
            <div className="flex flex-col gap-3">
              {!hasAssessment && (
                <Button onClick={() => router.push("/assessment")}>
                  Start Assessment
                </Button>
              )}

              <Button variant="secondary" onClick={openBillingPortal}>
                Billing
              </Button>

              <Button variant="secondary" onClick={() => router.push("/report")}>
                View Report
              </Button>
            </div>
          </Card>

        </div>

      </div>
    </PageContainer>
  );
}