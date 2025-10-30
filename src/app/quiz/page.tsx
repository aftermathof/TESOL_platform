import { getQuiz } from "@/lib/dataService";
import type { Quiz, QuizQuestion } from "@/data/mockData";
import { QuizClient } from "./quizClient";
import { TeachingPlanPanel } from "./TeachingPlanPanel";

export const dynamic = "force-static";

export default async function QuizPage() {
  const quiz = await getQuiz();

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">测验与教学计划</h2>
      </header>
      <QuizClient quiz={quiz} />
      <TeachingPlanPanel />
    </div>
  );
}

export type { Quiz, QuizQuestion };
