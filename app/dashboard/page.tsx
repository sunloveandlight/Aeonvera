"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserSubscription } from "@/lib/auth/getUserSubscription";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const result = await getUserSubscription();

      if (!result.user) {
        router.replace("/login");
        return;
      }

      if (!result.allowed) {
        router.replace("/");
        return;
      }

      setUserData(result);
      setLoading(false);
    };

    checkAccess();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Checking your subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-2">Welcome to Aeonvera</h1>
        <p className="text-zinc-400 text-xl mb-8">
          You have an active {userData?.plan} subscription ✅
        </p>

        <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8">
          <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>
          <p className="text-zinc-300">
            This is your protected dashboard. You can start building your main features here.
          </p>
        </div>
      </div>
    </div>
  );
}