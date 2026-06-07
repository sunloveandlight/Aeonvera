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

  const [profile, setProfile] = useState<Profile | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [hasAssessment, setHasAssessment] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return router.replace("/login");

        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name, plan, subscription_status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profileData) return router.replace("/onboarding");

        if (!isUserAllowed(profileData.plan, profileData.subscription_status)) {
          return router.replace("/pricing");
        }

        setProfile(profileData);

        const { data: existingReport } = await supabase
          .from("longevity_reports")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

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

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-white/40 text-xs tracking-[0.4em] uppercase">
        INITIALIZING COMMAND SYSTEM
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <PageContainer>

      {/* ================= HEADER ================= */}
      <div className="py-14 border-b border-white/5 mb-10">
        <p className="text-[10px] tracking-[0.5em] uppercase text-white/25">
          AEONVERA COMMAND CENTER
        </p>

        <h1 className="text-5xl md:text-6xl font-light tracking-[-0.05em] mt-4 text-white/90">
          Intelligence Overview
        </h1>

        <p className="mt-4 text-white/40 max-w-2xl leading-relaxed">
          Your biological system state, reports, and active optimization pathways.
        </p>
      </div>

      {/* ================= SYSTEM STATUS ================= */}
      <div className="grid md:grid-cols-3 gap-6 mb-10">

        <Card title="SYSTEM STATUS">
          <div className="space-y-2">
            <p className="text-white/70 text-sm">
              {profile?.display_name || "User"}
            </p>
            <p className="text-white/30 text-xs uppercase tracking-[0.3em]">
              {profile?.plan || "CORE ACCESS"}
            </p>
          </div>
        </Card>

        <Card title="SUBSCRIPTION">
          <p className="text-white/60 text-sm">
            {profile?.subscription_status || "active"}
          </p>
        </Card>

        <Card title="ASSESSMENT STATE">
          <p className="text-white/60 text-sm">
            {hasAssessment ? "COMPLETED" : "NOT INITIALIZED"}
          </p>
        </Card>

      </div>

      {/* ================= CORE SIGNAL ================= */}
      <Card title="CORE INTELLIGENCE SIGNAL" glow className="mb-10">
        {report ? (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-white/40 text-sm mb-2">
                Risk Model Score
              </p>
              <p className="text-5xl font-light text-white/80 tracking-[-0.04em]">
                {report.risk_score}
                <span className="text-white/30 text-2xl"> / 100</span>
              </p>
            </div>

            <Button href="/report">
              Open Model
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-white/40">
              No active intelligence model generated.
            </p>

            <Button href="/assessment">
              Initialize
            </Button>
          </div>
        )}
      </Card>

      {/* ================= ACTION PANEL ================= */}
      <div className="grid md:grid-cols-3 gap-6">

        <Card title="ACTIONS">
          <div className="space-y-3">
            {!hasAssessment && (
              <Button href="/assessment">
                Start Assessment
              </Button>
            )}
            <Button variant="secondary" href="/report">
              View Report
            </Button>
          </div>
        </Card>

        <Card title="SYSTEM CONTROL">
          <Button variant="secondary" href="/pricing">
            Manage Plan
          </Button>
        </Card>

        <Card title="INTELLIGENCE STATE">
          <p className="text-white/40 text-sm">
            Continuously evolving biological model.
          </p>
        </Card>

      </div>

    </PageContainer>
  );
}