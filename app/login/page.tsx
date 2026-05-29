"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams.get("mode");
  const isSignUpMode = mode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Initial session check
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/dashboard");
      }
    }
    checkSession();
  }, [router]);

  // Listen for auth changes (this helps with timing issues)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session ? "Session present" : "No session");
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        router.replace("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isSignUpMode) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        await supabase.from("profiles").upsert({
          user_id: data.user.id,
          plan: null,
          billing_type: null,
          subscription_status: "inactive",
          entity_state: "dormant",
          onboarding_completed: false,
          life_stage: "initializing",
        });
      }

      setMessage("Account created. Redirecting to pricing...");
      setTimeout(() => router.replace("/pricing"), 800);
      return;
    }

    // Login flow
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setMessage("Login successful but no session returned. Try again.");
      setLoading(false);
      return;
    }

    setMessage("Login successful. Redirecting...");

    // Force navigation + refresh to ensure middleware and server see the new session
    router.replace("/dashboard");
    router.refresh(); // Critical for cookie/session sync in App Router
  }

  async function handlePasswordReset() {
    if (!email) {
      setMessage("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) setMessage(error.message);
    else setMessage("Password reset email sent. Check your inbox.");
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md border border-zinc-800 bg-zinc-950 rounded-3xl p-10">
        <h1 className="text-4xl font-light mb-6">
          {isSignUpMode ? "Create Account" : "Welcome Back"}
        </h1>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-white"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-white"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black rounded-xl py-3 font-medium disabled:opacity-50"
          >
            {loading ? "Processing..." : isSignUpMode ? "Create Account" : "Sign In"}
          </button>
        </form>

        {!isSignUpMode && (
          <button
            onClick={handlePasswordReset}
            className="mt-4 text-sm text-white/70 hover:text-white underline"
          >
            Forgot password?
          </button>
        )}

        {message && (
          <div className="mt-4 text-sm text-white/70 border border-white/10 p-3 rounded-xl">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}