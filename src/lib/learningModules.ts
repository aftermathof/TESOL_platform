"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";

type RawProgressRow = {
  completed_at: string | null;
};

type RawSectionRow = {
  id: string;
  title: string | null;
  summary: string | null;
  order_index: number | null;
  duration_minutes: number | null;
  content: string | null;
};

type RawModuleRow = {
  id: string;
  title: string | null;
  description: string | null;
  order_index: number | null;
  sections?: RawSectionRow[] | null;
  progress?: RawProgressRow[] | null;
};

export type ModuleSectionRecord = {
  id: string;
  title: string;
  summary: string | null;
  orderIndex: number | null;
  durationMinutes: number | null;
  content: string;
};

export type LearningModuleRecord = {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number | null;
  sections: ModuleSectionRecord[];
  completed: boolean;
  completedAt?: string | null;
};

const DEFAULT_SECTION_TITLE = "未命名章节";
const DEFAULT_MODULE_TITLE = "未命名模块";

export async function fetchLearningModules(): Promise<LearningModuleRecord[]> {
  const supabase = getSupabaseBrowserClient();
  const { data: userResult } = await supabase.auth.getUser();
  if (!userResult?.user) {
    throw new Error("未登录，无法获取学习模块。");
  }

  const { data, error } = await supabase
    .from("learning_modules")
    .select(
      `
        id,
        title,
        description,
        order_index,
        sections:module_sections (
          id,
          title,
          summary,
          order_index,
          duration_minutes,
          content
        ),
        progress:module_progress (
          module_id,
          completed_at
        )
      `
    )
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  const modules = (data as RawModuleRow[] | null) ?? [];

  return modules.map((module) => {
    const sections: ModuleSectionRecord[] = (module.sections ?? [])
      .map((section) => ({
        id: section.id,
        title: section.title ?? DEFAULT_SECTION_TITLE,
        summary: section.summary ?? null,
        orderIndex: section.order_index ?? null,
        durationMinutes: section.duration_minutes ?? null,
        content: section.content ?? "",
      }))
      .sort((a, b) => {
        const orderA = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });

    const progressRecords = module.progress ?? [];
    const completedRecord = progressRecords.length > 0 ? progressRecords[0] : null;

    return {
      id: module.id,
      title: module.title ?? DEFAULT_MODULE_TITLE,
      description: module.description ?? null,
      orderIndex: module.order_index ?? null,
      sections,
      completed: completedRecord != null,
      completedAt: completedRecord?.completed_at ?? null,
    };
  });
}

export async function markModuleCompleted(moduleId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;

  if (!user) {
    throw new Error("未登录，无法提交学习进度。");
  }

  const { error } = await supabase.from("module_progress").upsert(
    {
      module_id: moduleId,
      user_id: user.id,
      completed_at: new Date().toISOString(),
    },
    {
      onConflict: "module_id,user_id",
    }
  );

  if (error) {
    throw error;
  }
}
