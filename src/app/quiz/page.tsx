import { getQuiz, getTeachingPlanTemplate } from "@/lib/dataService";
import type { Quiz, QuizQuestion } from "@/data/mockData";
import { QuizClient } from "./quizClient";
import { TeachingPlanPanel } from "./TeachingPlanPanel";

export const dynamic = "force-static";

export default async function QuizPage() {
  const [quiz, template] = await Promise.all([
    getQuiz(),
    getTeachingPlanTemplate(),
  ]);

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">测验与教学设计</h2>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600">
          完成模块测验后，可在同一页面撰写 Teaching Plan，并通过 AI
          获取改进建议。目前题目与模板基于演示数据，待接入 Supabase 与 OCR。
        </p>
      </header>
      <QuizClient quiz={quiz} />
      <TeachingPlanPanel template={template} />
    </div>
  );
}

export type { Quiz, QuizQuestion };
