"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";
import { useAuth } from "@/components/AuthProvider";

type AuthMode = "signin" | "signup";

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
        <p className="text-sm text-slate-300">正在加载登录页面…</p>
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
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <nav className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <span className="text-xl font-semibold text-white">TESOL</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
              51Talk
            </p>
            <p className="text-sm font-medium text-slate-100">
              学习 · 测验 · Teaching Plan · 证书
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          <span>隐私政策</span>
          <span>帮助中心</span>
          <span>联系支持</span>
        </div>
      </nav>
      <main className="flex flex-1 items-center justify-center px-6 pb-16 pt-8">
        <LoginCard redirect={redirect} supabase={supabase} />
      </main>
      <footer className="px-8 pb-6 text-xs text-slate-400">
        2025 © 51Talk TESOL Platform. Inspired by Apple design principles.
      </footer>
    </div>
  );
}

function LoginCard({
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

  const toggleMode = () =>
    setMode((current) => (current === "signin" ? "signup" : "signin"));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          throw signInError;
        }
      } else {
        if (!fullName.trim()) {
          throw new Error("请填写姓名，以便生成证书。");
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
        if (data.session == null) {
          const { error: signInError } =
            await supabase.auth.signInWithPassword({
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
      const message =
        cause instanceof Error
          ? cause.message
          : "登录失败，请稍后再试。";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-[460px] rounded-[32px] bg-white/5 p-10 shadow-2xl backdrop-blur-xl">
      <h1 className="text-3xl font-semibold text-white">
        {mode === "signin" ? "欢迎回来" : "创建 51Talk TESOL 账号"}
      </h1>
      <p className="mt-2 text-sm text-slate-300">
        使用注册邮箱和密码登录，完成学习、测试并领取证书。
      </p>
      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
              姓名
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
              placeholder="用于证书展示的姓名"
              autoComplete="name"
              required
            />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
            邮箱
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
            placeholder="example@51talk.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
            密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
            placeholder={mode === "signin" ? "输入密码" : "设置登录密码"}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
          />
        </div>
        {error && (
          <p className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/20 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? mode === "signin"
              ? "正在登录..."
              : "正在创建..."
            : mode === "signin"
              ? "登录"
              : "注册并登录"}
        </button>
      </form>
      <div className="mt-6 flex items-center justify-between text-xs text-slate-300">
        <span>{mode === "signin" ? "还没有账号？" : "已经拥有账号？"}</span>
        <button
          type="button"
          onClick={toggleMode}
          className="font-semibold text-white transition hover:text-sky-200"
        >
          {mode === "signin" ? "立即注册" : "返回登录"}
        </button>
      </div>
    </section>
  );
}
