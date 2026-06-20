import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type CheckoutPlan = "core" | "elite" | "sovereign";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitRequest(req, "stripe-checkout", 20, 60_000);
    if (limited) return limited;

    const stripe = getStripe();

    const PRICE_IDS = {
      core: process.env.STRIPE_CORE_PRICE_ID,
      elite: process.env.STRIPE_ELITE_PRICE_ID,
      sovereign: process.env.STRIPE_SOVEREIGN_PRICE_ID,
    };

    if (!PRICE_IDS.core || !PRICE_IDS.elite || !PRICE_IDS.sovereign) {
      throw new Error("Missing Stripe Price IDs in environment variables");
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    /**
     * FIXED: use getUser() instead of getSession()
     * getSession() is spoofable — getUser() verifies with Supabase server
     */
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const { plan } = body as { plan: CheckoutPlan };

    if (!plan || !PRICE_IDS[plan]) {
      return NextResponse.json(
        { error: "Invalid subscription plan." },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { user_id: user.id },
      });

      customerId = customer.id;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const sessionStripe = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: PRICE_IDS[plan],
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?plan=${plan}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing`,
      metadata: {
        user_id: user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
        },
      },
    });

    return NextResponse.json({ url: sessionStripe.url });
  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
