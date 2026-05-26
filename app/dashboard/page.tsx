"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { CreditCard, LogOut } from "lucide-react";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Create client inside component (important!)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
        return;
      }
      
      setUser(user);
      setLoading(false);
    };

    fetchUser();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading your dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-5xl font-bold">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-3 border border-red-500/50 hover:bg-red-950 text-red-400 rounded-2xl transition"
          >
            <LogOut size={20} /> Logout
          </button>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8">
          <h2 className="text-2xl mb-4">Welcome back</h2>
          <p className="text-xl text-emerald-400">{user?.email}</p>
          <p className="text-zinc-400 mt-6">Your subscription status will appear here soon.</p>
        </div>
      </div>
    </div>
  );
}