"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchLearningModules,
  type LearningModuleRecord,
} from "@/lib/learningModules";
import { getProgressSnapshot } from "@/lib/dataService";
import type { ProgressSnapshot } from "@/data/mockData";

const statusMap: Record<string, string> = {
  not_submitted: "未提交",
  in_review: "审核中",
  approved: "已通过",
  not_eligible: "暂未满足条件",
  generating: "生成中",
  available: "可下载",
};

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

function formatModuleDisplay(module: LearningModuleRecord, index: number) {
  if (module.orderIndex != null) {
    return `Module ${module.orderIndex} · ${module.title}`;
  }
  return `Module ${index + 1} · ${module.title}`;
}

export function DashboardClient() {
  const [modulesState, setModulesState] = useState<
    AsyncState<LearningModuleRecord[]>
  >({
    data: null,
    loading: true,
    error: null,
  });
  const [progressState, setProgressState] = useState<
    AsyncState<ProgressSnapshot>
  >({
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
          getProgressSnapshot(),
        ]);
        if (cancelled) return;
        setModulesState({
          data: fetchedModules,
          loading: false,
          error: null,
        });
        setProgressState({
          data: snapshot,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "加载仪表盘数据时出现问题，请稍后再试。";
        setModulesState((prev) => ({ ...prev, loading: false, error: message }));
        setProgressState((prev) => ({ ...prev, loading: false, error: message }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const modules = useMemo(
    () => modulesState.data ?? [],
    [modulesState.data],
  );
  const totalModules = modules.length;
  const completedModules = modules.filter((module) => module.completed).length;
  const pendingModules = Math.max(totalModules - completedModules, 0);
  const completionLabel =
    totalModules > 0
      ? `已完成 ${completedModules} / 未完成 ${pendingModules}`
      : "暂无学习模块";

  const nextModule = useMemo(() => {
    if (modules.length === 0) return null;
    const firstIncomplete = modules.find((module) => !module.completed);
    return firstIncomplete ?? modules[modules.length - 1];
  }, [modules]);

  const nextModuleDisplay = useMemo(() => {
    if (!nextModule) return "";
    const index = modules.findIndex((module) => module.id === nextModule.id);
    return formatModuleDisplay(nextModule, index < 0 ? 0 : index);
  }, [modules, nextModule]);

  if (modulesState.loading || progressState.loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-sm text-zinc-500">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
          <span>正在加载仪表盘数据…</span>
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

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-zinc-900">
          欢迎回来，继续你的 TESOL 学习旅程
        </h2>
        {nextModule && (
          <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-sky-100 bg-sky-50/60 p-6 text-sm text-sky-700 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-sky-900">
                下一学习任务：{nextModuleDisplay}
              </p>
              <p>当前完成进度：{completionLabel}</p>
            </div>
            <Link
              href={`/learning?module=${encodeURIComponent(nextModule.id)}`}
              className="inline-flex items-center justify-center rounded-full bg-[rgb(0,102,255)] px-4 py-2 font-medium text-white hover:bg-[rgb(0,92,230)]"
            >
              前往学习模块
            </Link>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <ProgressCard
          title="学习进度"
          value={completionLabel}
          description="已完成 TESOL 课程内容"
        />
        <ProgressCard
          title="待完成测验"
          value={(progressState.data?.pendingQuizzes ?? 0).toString()}
          description="仍需完成的测验数量"
        />
        <ProgressCard
          title="Teaching Plan"
          value={
            statusMap[progressState.data?.teachingPlanStatus ?? "not_submitted"]
          }
          description="AI 教案生成状态"
        />
        <ProgressCard
          title="证书状态"
          value={
            statusMap[progressState.data?.certificateStatus ?? "not_eligible"]
          }
          description="达到条件后可自动生成证书"
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
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-zinc-500">{title}</p>
      <p className="mt-3 text-3xl font-bold text-zinc-900">{value}</p>
      <p className="mt-2 text-sm text-zinc-600">{description}</p>
    </article>
  );
}
