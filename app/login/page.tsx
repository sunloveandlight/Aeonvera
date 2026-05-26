"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const signIn = async () => {
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else {
      setMessage("Login successful!");
      setTimeout(() => router.push("/dashboard"), 1000);
    }
    setLoading(false);
  };

  const signUp = async () => {
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` }
    });
    if (error) setMessage(error.message);
    else setMessage("Check your email for confirmation link!");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md p-10 rounded-3xl bg-zinc-950 border border-white/10">
        <h1 className="text-4xl font-bold mb-2">Aeonvera</h1>
        <p className="text-zinc-400 mb-8">Welcome back</p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-4 mb-4 bg-zinc-900 rounded-2xl border border-white/10 focus:border-white/40 outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-4 mb-6 bg-zinc-900 rounded-2xl border border-white/10 focus:border-white/40 outline-none"
        />

        <button
          onClick={signIn}
          disabled={loading}
          className="w-full py-4 bg-white text-black rounded-2xl font-semibold mb-3 hover:bg-zinc-200 disabled:opacity-70"
        >
          {loading ? "Loading..." : "Sign In"}
        </button>

        <button
          onClick={signUp}
          disabled={loading}
          className="w-full py-4 border border-white/30 rounded-2xl font-semibold hover:bg-white/5"
        >
          {loading ? "Loading..." : "Create Account"}
        </button>

        {message && <p className="mt-6 text-center text-sm">{message}</p>}
      </div>
    </div>
  );
}