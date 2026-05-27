"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserSubscription } from "@/lib/getUserSubscription";

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const result = await getUserSubscription();

      if (!result?.user) {
        router.replace("/login");
        return;
      }

      if (!result.allowed) {
        router.replace("/");
        return;
      }

      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) {
    return <div style={{ padding: 40 }}>Checking subscription...</div>;
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Dashboard</h1>
      <p>✅ Active subscription confirmed</p>
    </div>
  );
}