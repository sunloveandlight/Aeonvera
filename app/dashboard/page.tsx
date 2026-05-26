"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { CreditCard, LogOut } from "lucide-react";

type Subscription = {
  id: string;
  status: string;
  plan?: string;
  current_period_end?: string;
};

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      // TODO: Fetch subscription from Supabase (we'll create the table later)
      // For now, show basic info
      setSubscription({
        id: "pending",
        status: "active", // placeholder
        plan: "Core / Elite / Sovereign",
      });

      setLoading(false);
    };

    fetchData();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading your profile...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-5xl font-bold">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-3 border border-red-500/50 hover:bg-red-950 text-red-400 rounded-2xl"
          >
            <LogOut size={20} /> Logout
          </button>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Profile Card */}
          <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8">
            <h2 className="text-2xl mb-6">Account</h2>
            <p className="text-xl">{user?.email}</p>
            <p className="text-emerald-400 mt-2">✓ Verified</p>
          </div>

          {/* Subscription Card */}
          <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="text-white" size={28} />
              <h2 className="text-2xl">Subscription</h2>
            </div>

            {subscription ? (
              <>
                <p className="text-3xl font-semibold capitalize">{subscription.plan}</p>
                <p className={`inline-block mt-3 px-4 py-1 rounded-full text-sm ${
                  subscription.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {subscription.status.toUpperCase()}
                </p>
                {subscription.current_period_end && (
                  <p className="text-zinc-400 mt-4">
                    Renews: {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                )}
              </>
            ) : (
              <p>No active subscription</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}