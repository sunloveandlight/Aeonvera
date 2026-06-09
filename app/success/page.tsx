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
    <main className="flex min-h-screen items-center justify-center px-6 text-white">
      <div className="premium-surface max-w-xl rounded-lg p-8 text-center">
        <p className="mb-6 text-xs uppercase tracking-normal text-[#d4af37]/75">
          AEONVERA
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-normal">Subscription Activated</h1>

        <div className="mb-8 flex justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-[#d4af37]" />
        </div>

        <p className="text-white/55">{status}</p>
      </div>
    </main>
  );
}
