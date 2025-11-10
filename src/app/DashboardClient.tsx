"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { fetchLearningModules, type LearningModuleRecord } from "@/lib/learningModules";
import type { ProgressSnapshot } from "@/data/mockData";
import { useAuth } from "@/components/AuthProvider";

const statusMap: Record<string, string> = {
  not_eligible: "Requirements not met yet",
  generating: "Certificate is being generated",
  available: "Certificate ready",
};

const quizStatusLabel: Record<"not_started" | "pending_review" | "approved" | "rejected", string> =
  {
    not_started: "Not started",
    pending_review: "Under review",
    approved: "Approved",
    rejected: "Rejected",
  };

const ALL_COMPLETED_LABEL = "All modules completed";

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

async function fetchProgress(accessToken?: string): Promise<ProgressSnapshot> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch("/api/progress", {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      typeof errorBody?.error === "string"
        ? errorBody.error
        : `Failed to load progress (status ${response.status})`;
    throw new Error(message);
  }

  const payload = (await response.json()) as { progress: ProgressSnapshot };
  return payload.progress;
}

function formatModuleDisplay(module: LearningModuleRecord, index: number) {
  if (module.orderIndex != null) {
    return `Module ${module.orderIndex} · ${module.title}`;
  }
  return `Module ${index + 1} · ${module.title}`;
}

export function DashboardClient() {
  const { session } = useAuth();
  const [modulesState, setModulesState] = useState<AsyncState<LearningModuleRecord[]>>({
    data: null,
    loading: true,
    error: null,
  });
  const [progressState, setProgressState] = useState<AsyncState<ProgressSnapshot>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fetchedModules, snapshot] = await Promise.all([
          fetchLearningModules(),
          fetchProgress(session?.access_token ?? undefined),
        ]);
        if (cancelled) return;
        setModulesState({ data: fetchedModules, loading: false, error: null });
        setProgressState({ data: snapshot, loading: false, error: null });
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load dashboard data. Please try again.";
        setModulesState((prev) => ({ ...prev, loading: false, error: message }));
        setProgressState((prev) => ({ ...prev, loading: false, error: message }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const modules = useMemo(() => modulesState.data ?? [], [modulesState.data]);
  const totalModules = modules.length;
  const completedModules = modules.filter((module) => module.completed).length;
  const pendingModules = Math.max(totalModules - completedModules, 0);
  const completionLabel =
    totalModules > 0
      ? `Completed ${completedModules} · Remaining ${pendingModules}`
      : "No learning modules yet";

  const completionValue: ReactNode =
    totalModules > 0 ? (
      <div className="flex flex-col leading-tight">
        <span className="text-3xl font-bold text-zinc-900">Completed {completedModules}</span>
        <span className="mt-2 text-lg font-semibold text-zinc-500">Remaining {pendingModules}</span>
      </div>
    ) : (
      <span className="text-3xl font-bold text-zinc-900">No learning modules yet</span>
    );

  const nextModule = useMemo(() => {
    if (modules.length === 0) return null;
    const firstIncomplete = modules.find((module) => !module.completed);
    return firstIncomplete ?? null;
  }, [modules]);

  const nextModuleDisplay = useMemo(() => {
    if (!nextModule) {
      if (modules.length > 0 && modules.every((module) => module.completed)) {
        return ALL_COMPLETED_LABEL;
      }
      return "";
    }
    const index = modules.findIndex((module) => module.id === nextModule.id);
    return formatModuleDisplay(nextModule, index < 0 ? 0 : index);
  }, [modules, nextModule]);

  if (modulesState.loading || progressState.loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-sm text-zinc-500">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
          <span>Loading dashboard data...</span>
        </div>
      </div>
    );
  }

  if (modulesState.error) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-red-50/80 p-8 text-sm text-red-700 shadow-sm">
        <p>{modulesState.error}</p>
      </div>
    );
  }

  const quizSnapshot = progressState.data?.quiz ?? {
    attempts: 0,
    highestFinalScore: null,
    pendingReviewCount: 0,
    latestStatus: "not_started" as const,
  };

  const quizValue: ReactNode =
    quizSnapshot.attempts === 0 ? (
      <span className="text-lg font-semibold text-zinc-600">Examination not started yet</span>
    ) : (
      <div className="flex flex-col leading-tight">
        <span className="text-3xl font-bold text-zinc-900">
          Completed {quizSnapshot.attempts} {quizSnapshot.attempts === 1 ? "attempt" : "attempts"}
        </span>
        <span className="mt-2 text-lg font-semibold text-zinc-500">
          Highest score:{" "}
          {quizSnapshot.highestFinalScore != null
            ? `${quizSnapshot.highestFinalScore.toFixed(1)}`
            : "Not available yet"}
        </span>
      </div>
    );

  const quizDescription =
    quizSnapshot.attempts === 0
      ? "Complete every learning module to unlock the examination."
      : `Latest examination status: ${quizStatusLabel[quizSnapshot.latestStatus]}`;

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-zinc-900">
          Welcome back—continue your TESOL learning journey
        </h2>
        {(nextModule || nextModuleDisplay === ALL_COMPLETED_LABEL) && (
          <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-sky-100 bg-sky-50/60 p-6 text-sm text-sky-700 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-sky-900">
                {nextModuleDisplay === ALL_COMPLETED_LABEL
                  ? "Status: all modules completed"
                  : `Next learning task: ${nextModuleDisplay}`}
              </p>
              <p>Current progress: {completionLabel}</p>
            </div>
            {nextModule ? (
              <Link
                href={`/learning?module=${encodeURIComponent(nextModule.id)}`}
                className="inline-flex items-center justify-center rounded-full bg-[rgb(0,102,255)] px-4 py-2 font-medium text-white hover:bg-[rgba(242, 244, 247, 1)] hover:text-white focus-visible:outline-none"
              >
                <span className="text-white">Go to learning module</span>
              </Link>
            ) : (
              <div className="inline-flex items-center justify-center rounded-full bg-green-600 px-4 py-2 font-medium text-white">
                🎉 Congrats on finishing every learning module!
              </div>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ProgressCard title="Learning Progress" value={completionValue} />
        <ProgressCard title="Examination" value={quizValue} description={quizDescription} />
        <ProgressCard
          title="Certificate Status"
          value={statusMap[progressState.data?.certificateStatus ?? "not_eligible"]}
          description={
            progressState.data?.certificateStatus === "available" &&
            progressState.data?.certificateUrl ? (
              <a
                href={progressState.data.certificateUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center rounded-full border border-sky-500 px-3 py-1 text-sm font-semibold text-sky-600 hover:bg-sky-50"
              >
                Download PDF
              </a>
            ) : undefined
          }
        />
      </section>
    </div>
  );
}

function ProgressCard({
  title,
  value,
  description,
}: {
  title: string;
  value: ReactNode;
  description?: string | ReactNode;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-zinc-500">{title}</p>
      <div className="mt-3 text-3xl font-bold text-zinc-900">{value}</div>
      {typeof description === "string" ? (
        <p className="mt-2 text-sm text-zinc-600">{description}</p>
      ) : description ? (
        <div className="mt-2 text-sm">{description}</div>
      ) : null}
    </article>
  );
}
