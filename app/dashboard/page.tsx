"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login?mode=signin");
        return;
      }

      setLoading(false);
    }

    checkUser();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">
          Initializing biological intelligence systems...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-20">
      <div className="max-w-7xl mx-auto">
        <p className="text-sm tracking-[0.3em] uppercase text-zinc-500 mb-6">
          AEONVERA DASHBOARD
        </p>

        <h1 className="text-5xl md:text-7xl font-light tracking-tight mb-10">
          Biological Intelligence Layer
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-zinc-800 rounded-3xl p-8 bg-zinc-950">
            <h2 className="text-2xl font-light mb-4">
              Recovery Systems
            </h2>

            <p className="text-zinc-500">
              Adaptive recovery optimization infrastructure initializing.
            </p>
          </div>

          <div className="border border-zinc-800 rounded-3xl p-8 bg-zinc-950">
            <h2 className="text-2xl font-light mb-4">
              Biomarker Intelligence
            </h2>

            <p className="text-zinc-500">
              Longitudinal biological monitoring systems coming online.
            </p>
          </div>

          <div className="border border-zinc-800 rounded-3xl p-8 bg-zinc-950">
            <h2 className="text-2xl font-light mb-4">
              Longevity Optimization
            </h2>

            <p className="text-zinc-500">
              Personalized protocol generation infrastructure initializing.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}