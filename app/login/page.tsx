"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ensureProfile } from "@/lib/auth/ensureProfile";
import { isUserAllowed } from "@/lib/auth/permissions";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)]" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSignUpMode = searchParams.get("mode") === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUpMode) {
        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) {
          setMessage(error.message);
          return;
        }

        if (data.user) {
          await ensureProfile(data.user.id);
        }

        router.replace("/onboarding");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.user) {
        setMessage("Login failed");
        return;
      }

      await ensureProfile(data.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, plan, subscription_status")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!profile?.onboarding_completed) {
        router.replace("/onboarding");
      } else if (isUserAllowed(profile.plan, profile.subscription_status)) {
        router.replace("/dashboard");
      } else {
        router.replace("/pricing");
      }
    } catch (err) {
      console.error(err);
      setMessage("Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16 text-white">
      <div className="premium-surface w-full max-w-md rounded-lg p-8">
        <div className="mb-10 text-center">
          <p className="text-eyebrow">Aeonvera</p>
          <h1 className="mt-4 text-4xl font-light leading-tight">
            {isSignUpMode ? "Create your account." : "Welcome back."}
          </h1>
          <p className="mt-4 text-sm leading-6 text-white/55">
            {isSignUpMode
              ? "Start your biological age assessment and build your healthspan baseline."
              : "Sign in to continue to your dashboard and reports."}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-12 w-full rounded-lg border border-white/12 bg-[#151517] px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#c4a969]"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-12 w-full rounded-lg border border-white/12 bg-[#151517] px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#c4a969]"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="premium-action inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Processing..." : isSignUpMode ? "Create account" : "Sign in"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {message && (
          <div className="mt-4 rounded-lg border border-white/12 bg-[#151517] p-4 text-sm text-white/60">
            {message}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-white/50">
          {isSignUpMode ? (
            <p>
              Already have an account?{" "}
              <Link href="/login" className="font-medium royal-text">
                Sign in
              </Link>
            </p>
          ) : (
            <p>
              Don&apos;t have an account?{" "}
              <Link href="/login?mode=signup" className="font-medium royal-text">
                Create one
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
