import { getQuiz } from "@/lib/dataService";
import type { Quiz, QuizQuestion } from "@/data/mockData";
import { QuizClient } from "./quizClient";
import { TeachingPlanPanel } from "./TeachingPlanPanel";

export const dynamic = "force-dynamic";

export default async function QuizPage() {
  const quiz = await getQuiz();

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">
          测验与教学计划
        </h2>
        <p className="text-sm text-zinc-500">
          完成全部学习内容后开启测试并提交 Teaching Plan，系统将自动评估并允许管理员复核。
        </p>
      </header>
      <QuizClient quiz={quiz} />
      <TeachingPlanPanel />
    </div>
  );
}

export type { Quiz, QuizQuestion };
