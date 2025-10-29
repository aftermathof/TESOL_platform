import { getQuiz } from "@/lib/dataService";
import type { Quiz, QuizQuestion } from "@/data/mockData";
import { QuizClient } from "./quizClient";

export const dynamic = "force-static";

export default async function QuizPage() {
  const quiz = await getQuiz();

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">测验中心</h2>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600">
          该演示展示了在线测验如何渲染题目并提交答案。提交后，后端会按照题型自动给出得分与解析。
        </p>
      </header>
      <QuizClient quiz={quiz} />
    </div>
  );
}

export type { Quiz, QuizQuestion };
