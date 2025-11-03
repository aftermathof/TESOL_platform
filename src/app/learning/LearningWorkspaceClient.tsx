"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LearningWorkspace } from "./learningWorkspace";
import {
  fetchLearningModules,
  markModuleCompleted,
  type LearningModuleRecord,
} from "@/lib/learningModules";

export function LearningWorkspaceClient() {
  const searchParams = useSearchParams();
  const initialModuleId = searchParams.get("module") ?? undefined;
  const [modules, setModules] = useState<LearningModuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingModuleId, setCompletingModuleId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    void loadModules();
  }, []);

  const loadModules = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLearningModules();
      setModules(data);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "无法获取学习模块，请稍后再试。";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteModule = async (moduleId: string) => {
    setCompletingModuleId(moduleId);
    try {
      await markModuleCompleted(moduleId);
      const refreshed = await fetchLearningModules();
      setModules(refreshed);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "记录完成状态时发生错误，请稍后再试。";
      setError(message);
    } finally {
      setCompletingModuleId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-sm text-zinc-500">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
          <span>正在加载学习模块…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-red-50/80 p-8 text-sm text-red-700 shadow-sm">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void loadModules()}
          className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
        >
          重新加载
        </button>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500 shadow-sm">
        暂无学习模块内容，请联系管理员上传资料后再试。
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-1 overflow-visible">
      <LearningWorkspace
        modules={modules}
        initialModuleId={initialModuleId}
        onCompleteModule={(moduleId) => void handleCompleteModule(moduleId)}
        completingModuleId={completingModuleId}
      />
    </div>
  );
}
