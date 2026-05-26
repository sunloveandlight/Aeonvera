import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "../../../lib/stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  // Create Supabase client inside the handler
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  );

  console.log(`✅ Webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_details?.email;

        console.log("📧 Stripe email:", email);
console.log("🧾 Full session:", session);

if (!email) break;

// find user by email
const { data: usersData } =
  await supabase.auth.admin.listUsers();

const user = usersData.users.find(
  (u) => u.email?.toLowerCase() === email.toLowerCase()
);

if (!user) {
  console.log("❌ User not found");
  break;
}

// update profile
const { error } = await supabase
  .from("profiles")
  .upsert({
    id: user.id,
    email,
    stripe_customer_id: session.customer as string,
    subscription_status: "active",
    plan: "core",
  });

if (error) {
  console.error("❌ Supabase update failed:", error);
} else {
  console.log("✅ User upgraded to core");
}
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("📋 Subscription updated:", subscription.id, subscription.status);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Webhook handling error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}