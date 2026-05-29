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
  const [message, setMessage] = useState("");

  /**
   * If session already exists → redirect
   */
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        router.replace("/dashboard");
      }
    }

    checkSession();
  }, [router]);

  /**
   * AUTH HANDLER
   */
  async function handleAuth(e: FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      /**
       * SIGN UP FLOW
       */
      if (isSignUpMode) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
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

        setMessage("Account created successfully.");

        setTimeout(() => {
          router.replace("/pricing");
        }, 1000);

        return;
      }

      /**
       * SIGN IN FLOW
       */
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      /**
       * 🔥 CRITICAL FIX:
       * Force session refresh before redirect
       */
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        setMessage("Session failed to initialize. Try again.");
        return;
      }

      setMessage("Login successful.");

      setTimeout(() => {
        router.replace("/dashboard");
      }, 500);
    } catch (error) {
      console.error(error);
      setMessage("Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * PASSWORD RESET
   */
  async function handlePasswordReset() {
    if (!email) {
      setMessage("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/login",
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
        <p className="text-sm tracking-[0.3em] uppercase text-zinc-500 mb-6">
          AEONVERA
        </p>

        <h1 className="text-4xl font-light mb-3">
          {isSignUpMode ? "Create Account" : "Welcome Back"}
        </h1>

        <p className="text-zinc-500 mb-10">
          {isSignUpMode
            ? "Begin your biological intelligence journey."
            : "Access your longevity intelligence dashboard."}
        </p>

        <form onSubmit={handleAuth} className="space-y-5">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-white"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-white"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black rounded-xl py-4 font-medium hover:bg-zinc-200 transition disabled:opacity-50"
          >
            {loading
              ? "Loading..."
              : isSignUpMode
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        {!isSignUpMode && (
          <button
            onClick={handlePasswordReset}
            className="mt-4 text-sm text-zinc-400 hover:text-white transition"
          >
            Forgot Password?
          </button>
        )}

        {message && (
          <div className="mt-6 border border-white/10 bg-black rounded-xl p-4 text-sm text-zinc-300">
            {message}
          </div>
        )}

        <div className="mt-8 text-sm text-zinc-500 text-center">
          {isSignUpMode ? (
            <>
              Already have an account?{" "}
              <a href="/login" className="text-white hover:underline">
                Sign In
              </a>
            </>
          ) : (
            <>
              Need an account?{" "}
              <a
                href="/login?mode=signup"
                className="text-white hover:underline"
              >
                Create Account
              </a>
            </>
          )}
        </div>
      </div>
    </main>
  );
}