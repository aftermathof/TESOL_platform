"use client";

import type { FormEvent } from "react";
import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";
import { useAuth } from "@/components/AuthProvider";

type AuthMode = "signin" | "signup";
const enableDemoLogin =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-200">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 px-6 py-4 backdrop-blur">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        <p className="text-sm text-slate-300">Loading sign-in experience…</p>
      </div>
    </div>
  );
}

function LoginPageContent() {
  const supabase = getSupabaseBrowserClient();
  const { session, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (!loading && session) {
      router.replace(redirect);
    }
  }, [loading, session, router, redirect]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-white text-slate-900">
      <div className="absolute left-6 top-6">
        <Image src="/logo.png" alt="51Talk logo" width={110} height={32} priority />
      </div>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-300 via-blue-500 to-slate-300 opacity-70" />
      <AuthContainer redirect={redirect} supabase={supabase} />
    </div>
  );
}

function AuthContainer({
  supabase,
  redirect,
}: {
  supabase: ReturnType<typeof getSupabaseBrowserClient>;
  redirect: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const isSignIn = mode === "signin";

  const handleForgotPassword = () => {
    window.open("mailto:support@51talk.com");
  };

  const toggleMode = () =>
    setMode((current) => (current === "signin" ? "signup" : "signin"));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isSignIn) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          throw signInError;
        }
      } else {
        if (!fullName.trim()) {
          throw new Error("Please provide your full name so we can issue a certificate.");
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
            emailRedirectTo: undefined,
          },
        });
        if (signUpError) {
          throw signUpError;
        }
        const userId = data.user?.id;
        if (userId) {
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert({
              id: userId,
              full_name: fullName.trim(),
            });
          if (profileError) {
            console.warn("[login] Failed to upsert profile name:", profileError);
          }
        }
        if (data.session == null) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            throw signInError;
          }
        }
      }

      router.replace(redirect);
    } catch (cause) {
      if (
        enableDemoLogin &&
        cause instanceof Error &&
        cause.message.toLowerCase().includes("failed to fetch")
      ) {
        console.warn(
          "[AuthContainer] Supabase unavailable, entering demo login mode.",
          cause
        );
        router.replace(redirect);
        return;
      }
      const message =
        cause instanceof Error ? cause.message : "Sign-in failed, please try again later.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative h-[600px] w-full max-w-4xl overflow-hidden rounded-[16px] border border-blue-200 bg-white shadow-[0_40px_120px_-30px_rgba(56,189,248,0.35)]">
      <div
        className={`absolute top-0 flex h-full w-1/3 flex-col items-center justify-center bg-gradient-to-br from-blue-300 to-blue-500 p-12 text-white transition-all duration-700 ease-in-out ${
          isSignIn ? "left-0" : "left-2/3"
        } ${isSignIn ? "rounded-l-[16px]" : "rounded-r-[16px]"}`}
      >
        <div className="text-center">
          <div className="mb-8 text-xl font-semibold">51 Talk</div>
          <h2 className="mb-4 text-4xl font-bold">
            {isSignIn ? "Hey There!" : "Welcome!"}
          </h2>
          <p className="mb-2 text-lg opacity-90">
            {isSignIn ? "Welcome Back." : "Join us today."}
          </p>
          <p className="mb-8 text-base opacity-80">
            {isSignIn
              ? "You are just one step away to your feed."
              : "Start your journey with us."}
          </p>

          <div className="mt-12">
            <p className="mb-4 text-sm opacity-90">
              {isSignIn ? "Don't have an account?" : "Already have an account?"}
            </p>
            <button
              type="button"
              onClick={toggleMode}
              className="rounded-full border-2 border-white px-8 py-3 font-medium transition-all duration-300 hover:bg-white hover:text-indigo-600"
            >
              {isSignIn ? "Sign Up" : "Sign In"}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`absolute top-0 h-full w-2/3 transition-all duration-700 ease-in-out ${
          isSignIn ? "left-1/3" : "left-0"
        } ${isSignIn ? "rounded-r-[16px] rounded-l-none" : "rounded-l-[16px] rounded-r-none"}`}
      >
        <div className="flex h-full flex-col items-center justify-center bg-white p-16 text-gray-800">
          <h3 className="mb-8 text-3xl font-bold">
            {isSignIn ? "SIGN IN" : "SIGN UP"}
          </h3>

          <form className="w-full max-w-sm space-y-6" onSubmit={handleSubmit}>
            {!isSignIn && (
              <div>
                <label className="mb-2 block text-sm text-gray-600">Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 transition-colors placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm text-gray-600">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 transition-colors placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-600">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 transition-colors placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                autoComplete={isSignIn ? "current-password" : "new-password"}
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-500">
                {error}
              </p>
            )}

            {isSignIn && (
              <div className="flex items-center justify-between text-sm text-gray-600">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Keep me logged in
                </label>
                <button
                  type="button"
                  className="text-orange-500 transition hover:text-orange-600"
                  onClick={handleForgotPassword}
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-indigo-600 py-3 text-lg font-medium text-white shadow-lg transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting
                ? isSignIn
            ? "Signing in..."
            : "Creating account..."
          : isSignIn
          ? "Sign In"
          : "Sign Up & Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
