"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ensureProfile } from "@/lib/auth/ensureProfile";
import { isUserAllowed } from "@/lib/auth/permissions";
import { supabase } from "@/lib/supabase/client";
import {
  Form,
  FormField,
  PasswordInput,
  SubmitButton,
  TextInput,
} from "@/components/ui/forms";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)]" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSignUpMode = searchParams.get("mode") === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAuth(values: Record<string, unknown>) {
    const submittedEmail = String(values.email ?? email).trim();
    const submittedPassword = String(values.password ?? password);

    setLoading(true);
    setMessage(null);

    try {
      if (isSignUpMode) {
        const { data, error } = await supabase.auth.signUp({
          email: submittedEmail,
          password: submittedPassword,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        if (data.user) {
          await ensureProfile(data.user.id);
        }

        router.replace("/pricing");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: submittedEmail,
        password: submittedPassword,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.user) {
        setMessage("Login failed");
        return;
      }

      await ensureProfile(data.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, plan, subscription_status")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!profile?.onboarding_completed) {
        router.replace("/onboarding");
      } else if (isUserAllowed(profile.plan, profile.subscription_status)) {
        router.replace("/dashboard");
      } else {
        router.replace("/pricing");
      }
    } catch (err) {
      console.error(err);
      setMessage("Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-stage flex min-h-screen items-center justify-center px-6 py-16 text-white">
      <div className="auth-surface w-full max-w-md rounded-lg p-8">
        <div className="mb-10 text-center">
          <p className="text-eyebrow">Aeonvera</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            {isSignUpMode ? "Create your account." : "Welcome back."}
          </h1>
          <p className="mt-4 text-sm leading-6 text-white/55">
            {isSignUpMode
              ? "Create your private account, choose a membership, then complete onboarding."
              : "Sign in to continue to your dashboard and reports."}
          </p>
        </div>

        <Form onSubmit={handleAuth} className="space-y-4">
          <FormField name="email" label="Email" required>
            {({ value, onChange }) => (
              <TextInput
                name="email"
                type="email"
                value={(value as string) ?? email}
                onChange={(e) => {
                  onChange(e.target.value);
                  setEmail(e.target.value);
                }}
                placeholder="Email"
                className="h-12 bg-[#151517] px-4 placeholder:text-white/30"
                required
              />
            )}
          </FormField>

          <FormField name="password" label="Password" required>
            {({ value, onChange }) => (
              <PasswordInput
                name="password"
                value={(value as string) ?? password}
                onChange={(e) => {
                  onChange(e.target.value);
                  setPassword(e.target.value);
                }}
                placeholder="Password"
                className="h-12 bg-[#151517] px-4 placeholder:text-white/30"
                required
              />
            )}
          </FormField>

          <SubmitButton loading={loading}>
            {isSignUpMode ? "Create account" : "Sign in"}
          </SubmitButton>
        </Form>

        {message && (
          <div className="mt-4 rounded-lg border border-white/12 bg-[#151517] p-4 text-sm text-white/60">
            {message}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-white/50">
          {isSignUpMode ? (
            <p>
              Already have an account?{" "}
              <Link href="/login" className="font-medium royal-text">
                Sign in
              </Link>
            </p>
          ) : (
            <p>
              Don&apos;t have an account?{" "}
              <Link href="/login?mode=signup" className="font-medium royal-text">
                Create one
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
