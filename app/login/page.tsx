"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const router = useRouter();

  const handleAuth = async () => {
    if (!email || !password) {
      setMessage("Please enter email and password");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { createClient } = await import("@supabase/supabase-js");
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) setMessage(error.message);
        else setMessage("Account created! Please check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          setMessage(error.message);
        } else {
          setMessage("Login successful! Redirecting...");
          setTimeout(() => router.push("/dashboard"), 1200);
        }
      }
    } catch (err: any) {
      console.error(err);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md p-10 rounded-3xl bg-zinc-950 border border-white/10">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-2">Aeonvera</h1>
          <p className="text-zinc-400">Sign in to continue</p>
        </div>

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-4 mb-4 bg-zinc-900 rounded-2xl border border-white/10 focus:border-white/40 outline-none text-lg"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-4 mb-6 bg-zinc-900 rounded-2xl border border-white/10 focus:border-white/40 outline-none text-lg"
        />

        <button
          onClick={handleAuth}
          disabled={loading}
          className="w-full py-4 bg-white text-black rounded-2xl font-semibold text-lg mb-4 hover:bg-zinc-200 disabled:opacity-70 transition"
        >
          {loading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
        </button>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full py-4 text-zinc-400 hover:text-white transition text-sm"
        >
          {isSignUp 
            ? "Already have an account? Sign In" 
            : "Don't have an account? Create one"}
        </button>

        {message && (
          <p className="mt-6 text-center text-sm text-zinc-400 break-words">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}