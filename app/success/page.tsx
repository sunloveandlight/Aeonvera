"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function SuccessPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkSession() {

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login?mode=signin");
        return;
      }

      router.push("/dashboard");
    }

    checkSession();
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-zinc-500 uppercase tracking-[0.3em] mb-6">
          AEONVERA
        </p>

        <h1 className="text-5xl font-light mb-6">
          Subscription Activated
        </h1>

        <p className="text-zinc-400">
          Initializing your biological intelligence systems...
        </p>
      </div>
    </main>
  );
}