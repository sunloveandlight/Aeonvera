"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";

export default function SuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Finalizing account access...");

  /**
   * FIXED: use ref to track cancellation and timeout
   * so cleanup is reliable on unmount or redirect
   */
  const cancelledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    cancelledRef.current = false;
    let attempts = 0;

    const checkStatus = async () => {
      if (cancelledRef.current) return;

      attempts++;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setStatus("Please sign in again.");
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("plan, subscription_status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Profile check error:", error);
        }

        const allowed =
          profile && isUserAllowed(profile.plan, profile.subscription_status);

        if (allowed) {
          cancelledRef.current = true;
          router.replace("/dashboard");
          return;
        }

        if (attempts < 20) {
          timeoutRef.current = setTimeout(checkStatus, 1500);
        } else {
          setStatus(
            "We're still waiting for Stripe confirmation. Please refresh this page in a few moments."
          );
        }
      } catch (err) {
        console.error("Success page sync error:", err);

        if (!cancelledRef.current && attempts < 20) {
          timeoutRef.current = setTimeout(checkStatus, 1500);
        } else {
          setStatus(
            "Synchronization is taking longer than expected. Please refresh the page shortly."
          );
        }
      }
    };

    checkStatus();

    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center max-w-xl px-6">
        <p className="text-zinc-500 uppercase tracking-[0.3em] mb-6">
          AEONVERA
        </p>

        <h1 className="text-5xl font-light mb-6">Subscription Activated</h1>

        <div className="flex justify-center mb-8">
          <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full" />
        </div>

        <p className="text-zinc-400">{status}</p>
      </div>
    </main>
  );
}