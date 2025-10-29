"use client";

import { useState } from "react";
import type { Quiz, QuizQuestion } from "./page";

type SubmissionResult = {
  score: number;
  total: number;
  feedback: { id: string; correct: boolean; explanation?: string }[];
};

export function QuizClient({ quiz }: { quiz: Quiz }) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    const response = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });

    if (!response.ok) {
      const data = await response.json();
      setResult({
        score: 0,
        total: quiz.questions.length,
        feedback: [
          {
            id: "error",
            correct: false,
            explanation: data.error ?? "提交失败，请检查答案格式。",
          },
        ],
      });
    } else {
      const data = (await response.json()) as SubmissionResult;
      setResult(data);
    }

    setSubmitting(false);
  }

  return (
    <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-500">
          演示试卷
        </p>
        <h3 className="mt-2 text-xl font-semibold text-zinc-900">{quiz.title}</h3>
        <p className="mt-1 text-sm text-zinc-500">
          建议用时：{quiz.duration} 分钟
        </p>
      </header>
      <form className="grid gap-6" onSubmit={onSubmit}>
        {quiz.questions.map((question, index) => (
          <QuestionItem
            key={question.id}
            question={question}
            index={index}
            value={answers[question.id]}
            onChange={(value) =>
              setAnswers((prev) => ({ ...prev, [question.id]: value }))
            }
          />
        ))}
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            点击提交后将调用 `/api/quiz`，返回自动评分结果。
          </p>
          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
            disabled={isSubmitting}
          >
            {isSubmitting ? "提交中..." : "提交并查看得分"}
          </button>
        </div>
      </form>
      {result && (
        <ResultPanel
          result={result}
          questions={quiz.questions}
          onReset={() => {
            setAnswers({});
            setResult(null);
          }}
        />
      )}
    </section>
  );
}

function QuestionItem({
  question,
  index,
  value,
  onChange,
}: {
  question: QuizQuestion;
  index: number;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  return (
    <article className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-5">
      <p className="text-sm font-semibold text-zinc-500">
        第 {index + 1} 题 · {typeLabel[question.type]}
      </p>
      <p className="mt-2 text-base text-zinc-800">{question.prompt}</p>
      {question.type === "single" && question.options && (
        <div className="mt-4 grid gap-2">
          {question.options.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
            >
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={value === option}
                onChange={(event) => onChange(event.target.value)}
              />
              {option}
            </label>
          ))}
        </div>
      )}
      {question.type === "multiple" && question.options && (
        <div className="mt-4 grid gap-2">
          {question.options.map((option) => {
            const arrayValue = Array.isArray(value) ? value : [];
            const isChecked = arrayValue.includes(option);
            return (
              <label
                key={option}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
              >
                <input
                  type="checkbox"
                  name={`${question.id}-${option}`}
                  value={option}
                  checked={isChecked}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange([...arrayValue, option]);
                    } else {
                      onChange(arrayValue.filter((item) => item !== option));
                    }
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      )}
      {question.type === "text" && (
        <textarea
          className="mt-4 min-h-[120px] w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
          placeholder="请输入您的回答..."
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </article>
  );
}

const typeLabel: Record<QuizQuestion["type"], string> = {
  single: "单选题",
  multiple: "多选题",
  text: "简答题",
};

function ResultPanel({
  result,
  questions,
  onReset,
}: {
  result: SubmissionResult;
  questions: QuizQuestion[];
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h4 className="text-lg font-semibold text-emerald-800">
          提交成功 · 得分 {result.score}/{result.total}
        </h4>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center rounded-full border border-emerald-500 px-4 py-1 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/10"
        >
          重置并重新作答
        </button>
      </div>
      <ul className="mt-4 space-y-3 text-sm">
        {result.feedback.map((feedback) => {
          const question = questions.find((item) => item.id === feedback.id);
          if (!question) {
            return null;
          }

          return (
            <li
              key={feedback.id}
              className="rounded-xl border border-emerald-100 bg-white/70 p-4"
            >
              <p className="font-semibold text-emerald-700">
                {question.prompt}
              </p>
              <p className="mt-1 text-xs text-emerald-600">
                {feedback.correct ? "回答正确" : "待优化"}
              </p>
              {feedback.explanation && (
                <p className="mt-2 text-xs text-emerald-600">
                  解析：{feedback.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
