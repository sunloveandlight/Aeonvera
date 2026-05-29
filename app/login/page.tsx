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

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        router.replace("/dashboard");
      }
    }

    checkSession();
  }, [router]);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage(null);

    try {
      /**
       * SIGN UP
       */
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

        setMessage("Account created. Redirecting...");

        setTimeout(() => {
          router.replace("/pricing");
        }, 500);

        return;
      }

      /**
       * SIGN IN
       */
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      /**
       * 🔥 CRITICAL FIX: SHOW REAL ERROR
       */
      if (error) {
        setMessage(error.message); // THIS WAS YOUR MISSING PIECE
        setLoading(false);
        return;
      }

      if (!data.session) {
        setMessage("Login failed: no session created.");
        setLoading(false);
        return;
      }

      setMessage("Login successful. Redirecting...");

      /**
       * IMPORTANT:
       * Direct redirect (no session polling)
       */
      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      setMessage("Unexpected authentication error.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    if (!email) {
      setMessage("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Password reset email sent.");
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
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black rounded-xl py-3"
          >
            {loading
              ? "Loading..."
              : isSignUpMode
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        {message && (
          <div className="mt-4 text-sm text-white/70 border border-white/10 p-3 rounded-xl">
            {message}
          </div>
        )}

        {!isSignUpMode && (
          <button
            onClick={handlePasswordReset}
            className="mt-4 text-sm text-white/50"
          >
            Forgot password?
          </button>
        )}
      </div>
    </main>
  );
}