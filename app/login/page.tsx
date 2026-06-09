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
    <main className="flex min-h-screen items-center justify-center px-6 py-16 text-[var(--ink)]">
      <div className="premium-surface w-full max-w-md rounded-lg p-8">
        <div className="mb-10 text-center">
          <p className="text-sm font-medium royal-text">Aeonvera</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            {isSignUpMode ? "Create your account." : "Welcome back."}
          </h1>
          <p className="mt-4 text-sm leading-6 text-[rgba(38,51,73,0.62)]">
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
            className="h-12 w-full rounded-lg border border-[rgba(36,50,74,0.14)] bg-white/80 px-4 text-sm text-[var(--ink)] outline-none transition placeholder:text-[rgba(38,51,73,0.38)] focus:border-[#b18e4e]"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-12 w-full rounded-lg border border-[rgba(36,50,74,0.14)] bg-white/80 px-4 text-sm text-[var(--ink)] outline-none transition placeholder:text-[rgba(38,51,73,0.38)] focus:border-[#b18e4e]"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md royal-gradient text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Processing..." : isSignUpMode ? "Create account" : "Sign in"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {message && (
          <div className="mt-4 rounded-lg border border-[rgba(36,50,74,0.12)] bg-white/75 p-4 text-sm text-[rgba(38,51,73,0.66)]">
            {message}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-[rgba(38,51,73,0.58)]">
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
