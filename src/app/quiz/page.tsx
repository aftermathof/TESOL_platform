import { getQuiz } from "@/lib/dataService";
import type { Quiz, QuizQuestion } from "@/data/mockData";
import { QuizClient } from "./quizClient";

export const dynamic = "force-dynamic";

export default async function QuizPage() {
  const quiz = await getQuiz();

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">Assessment Center</h2>
        <p className="text-sm text-zinc-500">
          Finish every learning module to unlock the assessment.
        </p>
      </header>
      <QuizClient quiz={quiz} />
    </div>
  );
}

export type { Quiz, QuizQuestion };
