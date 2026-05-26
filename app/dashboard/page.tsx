"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { CreditCard, LogOut } from "lucide-react";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // Small delay to ensure client-side hydration
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.replace("/login");
          return;
        }
        
        setUser(user);
      } catch (error) {
        console.error("Auth error:", error);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-xl">
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
            className="flex items-center gap-2 px-6 py-3 border border-red-500/50 hover:bg-red-950 text-red-400 rounded-2xl transition-colors"
          >
            <LogOut size={20} /> Logout
          </button>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-3xl p-10">
          <h2 className="text-3xl mb-4">Welcome back</h2>
          <p className="text-2xl text-emerald-400 mb-8">{user?.email}</p>
          
          <div className="border border-white/10 rounded-2xl p-8">
            <div className="flex items-center gap-4 mb-6">
              <CreditCard size={32} />
              <h3 className="text-2xl">Subscription Status</h3>
            </div>
            <p className="text-zinc-400">Your active membership details will appear here once we connect Stripe.</p>
          </div>
        </div>
      </div>
    </div>
  );
}