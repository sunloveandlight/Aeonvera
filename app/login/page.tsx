"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams.get("mode");

  const isSignUpMode = mode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    try {
      setLoading(true);

      const supabase = getSupabase();

      if (isSignUpMode) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          alert(error.message);
          return;
        }

        if (data.user) {
          await supabase.from("profiles").upsert({
            user_id: data.user.id,
            plan: "free",
            subscription_status: "inactive",
          });
        }

        router.push("/pricing");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          alert(error.message);
          return;
        }

        router.push("/dashboard");
      }
    } catch (error) {
      console.error(error);
      alert("Authentication failed.");
    } finally {
      setLoading(false);
    }
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

        <div className="space-y-5">
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
            onClick={handleAuth}
            disabled={loading}
            className="w-full bg-white text-black rounded-xl py-4 font-medium hover:bg-zinc-200 transition"
          >
            {loading
              ? "Loading..."
              : isSignUpMode
              ? "Create Account"
              : "Sign In"}
          </button>
        </div>

        <div className="mt-8 text-sm text-zinc-500 text-center">
          {isSignUpMode ? (
            <>
              Already have an account?{" "}
              <a
                href="/login?mode=signin"
                className="text-white hover:underline"
              >
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