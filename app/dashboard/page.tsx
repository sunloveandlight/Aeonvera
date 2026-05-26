"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { CreditCard, LogOut } from "lucide-react";

export const dynamic = 'force-dynamic';   // ← This is the key fix

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.replace("/login");
          return;
        }

        setUser(user);
      } catch (err) {
        console.error(err);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-xl">
        Loading dashboard...
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
          <p className="text-2xl text-emerald-400">{user?.email}</p>
          
          <div className="mt-10 border border-white/10 rounded-2xl p-8">
            <div className="flex items-center gap-4 mb-6">
              <CreditCard size={32} />
              <h3 className="text-2xl">Subscription</h3>
            </div>
            <p className="text-zinc-400">Your membership details will be shown here soon.</p>
          </div>
        </div>
      </div>
    </div>
  );
}