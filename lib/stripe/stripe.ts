import Stripe from "stripe";

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

// ✅ keep old import working
export const stripe = stripeClient;

// future-safe factory
export function getStripe() {
  return stripeClient;
}