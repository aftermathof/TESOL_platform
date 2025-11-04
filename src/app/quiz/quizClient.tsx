"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { useAuth } from "@/components/AuthProvider";
import { fetchLearningModules } from "@/lib/learningModules";
import type { Quiz, QuizQuestion } from "./page";

type SubmissionResult = {
  score: number;
  total: number;
  feedback: {
    id: string;
    correct: boolean;
    explanation?: string;
    aiScore?: number | null;
    aiFeedback?: string | null;
  }[];
  aiSummary?: string | null;
};

const TEST_DURATION_SECONDS = 90 * 60;

export function QuizClient({ quiz }: { quiz: Quiz | null }) {
  const { session } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [progressLoading, setProgressLoading] = useState(true);
  const [allowStart, setAllowStart] = useState(true);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION_SECONDS);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);

  const totalQuestions = quiz?.questions.length ?? 0;

  useEffect(() => {
    let cancelled = false;
    async function loadModules() {
      if (!session?.user) {
        setProgressMessage("提示：未检测到登录状态，可直接开始测试。");
        setAllowStart(true);
        setProgressLoading(false);
        return;
      }

      try {
        const modules = await fetchLearningModules();
        if (cancelled) return;

        if (modules.length === 0) {
          setProgressMessage("当前账户尚未分配学习模块，如有疑问请联系管理员。");
          setAllowStart(true);
        } else if (modules.every((module) => module.completed)) {
          setProgressMessage(null);
          setAllowStart(true);
        } else {
          const remaining = modules.filter((module) => !module.completed).length;
          setProgressMessage(
            `仍有 ${remaining} 个学习模块未完成，建议先完成学习再参加测验。`
          );
          setAllowStart(false);
        }
      } catch (error) {
        console.warn("[QuizClient] Failed to load modules:", error);
        setProgressMessage("暂时无法获取学习进度，您仍可直接开始测试。");
        setAllowStart(true);
      } finally {
        if (!cancelled) {
          setProgressLoading(false);
        }
      }
    }

    void loadModules();
    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  useEffect(() => {
    if (!hasStarted || result) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          setAutoSubmitting(true);
          void submitQuiz(true);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasStarted, result]);

  const countdownLabel = useMemo(() => formatTime(timeLeft), [timeLeft]);

  if (!quiz) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">
        暂无可用测试题。
      </section>
    );
  }

  const disabled = !allowStart;

  return (
    <div className="grid gap-6">
      {!hasStarted ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600 shadow-sm">
          <div>
            <h3 className="text-xl font-semibold text-zinc-900">{quiz.title}</h3>
            {quiz.duration ? (
              <p className="mt-1 text-sm text-zinc-500">
                建议用时：{quiz.duration} 分钟
              </p>
            ) : null}
            <p className="mt-4 text-base text-zinc-700">
              本次测验共 {totalQuestions} 道题，涵盖单选、多选、填空和简答题型。
              测试时长 90 分钟，将在倒计时结束后自动提交。
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:flex-row md:items-center">
            <button
              type="button"
              disabled={disabled}
              className={clsx(
                "inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition",
                disabled
                  ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
                  : "bg-sky-500 text-white hover:bg-sky-600"
              )}
              onClick={() => {
                if (disabled) return;
                setShowIntroModal(true);
              }}
            >
              开始测试
            </button>
            {progressLoading ? (
              <p className="text-xs text-zinc-400">正在检查学习进度…</p>
            ) : progressMessage ? (
              <p
                className={clsx(
                  "text-xs",
                  allowStart ? "text-amber-500" : "font-semibold text-red-500"
                )}
              >
                {progressMessage}
              </p>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <header>
            <h3 className="text-xl font-semibold text-zinc-900">{quiz.title}</h3>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              <span>剩余时间</span>
              <span
                className={clsx(
                  "font-mono text-lg font-semibold",
                  timeLeft <= 300 ? "text-red-500" : "text-sky-600"
                )}
              >
                {countdownLabel}
              </span>
            </div>
          </header>
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (isSubmitting) return;
              setShowConfirmModal(true);
            }}
          >
            {quiz.questions.map((question, index) => (
              <QuestionItem
                key={question.id}
                question={question}
                index={index}
                value={answers[question.id]}
                onChange={(value) =>
                  setAnswers((previous) => ({
                    ...previous,
                    [question.id]: value,
                  }))
                }
              />
            ))}
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-xs font-semibold text-zinc-400 underline-offset-4 hover:underline"
                onClick={() => {
                  setHasStarted(false);
                  setShowIntroModal(false);
                  setTimeLeft(TEST_DURATION_SECONDS);
                  setAnswers({});
                }}
                disabled={isSubmitting}
              >
                退出并稍后再试
              </button>
              <button
                type="submit"
                className="inline-flex items-center rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? "提交中…" : "提交试卷"}
              </button>
            </div>
          </form>
          {autoSubmitting && (
            <p className="text-sm font-semibold text-red-500">
              时间到，系统正在自动提交，请勿关闭页面…
            </p>
          )}
        </section>
      )}

      {!hasStarted && result ? (
        <ResultPanel
          result={result}
          questions={quiz.questions}
          onReset={() => {
            setResult(null);
          }}
        />
      ) : null}

      {showIntroModal && (
        <IntroModal
          quiz={quiz}
          totalQuestions={totalQuestions}
          onCancel={() => setShowIntroModal(false)}
          onConfirm={() => {
            setHasStarted(true);
            setShowIntroModal(false);
            setResult(null);
            setAnswers({});
            setTimeLeft(TEST_DURATION_SECONDS);
            setAutoSubmitting(false);
          }}
        />
      )}

      {showConfirmModal && (
        <ConfirmModal
          isSubmitting={isSubmitting}
          onCancel={() => setShowConfirmModal(false)}
          onConfirm={() => void submitQuiz(false)}
        />
      )}
    </div>
  );

  async function submitQuiz(autoTriggered: boolean) {
    if (!quiz) return;
    if (isSubmitting) return;

    setSubmitting(true);
    setShowConfirmModal(false);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    let submissionSucceeded = false;

    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers,
        body: JSON.stringify({ quizId: quiz.id, answers }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setResult({
          score: 0,
          total: totalQuestions,
          feedback: [
            {
              id: "error",
              correct: false,
              explanation: data.error ?? "提交失败，请检查答案格式后重试。",
            },
          ],
        });
      } else {
        const data = (await response.json()) as SubmissionResult;
        setResult(data);
        submissionSucceeded = true;
      }
    } catch (error) {
      console.error("[QuizClient] submit error:", error);
      setResult({
        score: 0,
        total: totalQuestions,
        feedback: [
          {
            id: "error",
            correct: false,
            explanation: "网络异常，提交失败，请稍后重试。",
          },
        ],
      });
    } finally {
      setSubmitting(false);
      setAutoSubmitting(false);
      if (submissionSucceeded || autoTriggered) {
        setHasStarted(false);
        setShowIntroModal(false);
        setTimeLeft(TEST_DURATION_SECONDS);
        setAnswers({});
      }
    }
  }
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
  const hint = useMemo(() => {
    if (!question.options || question.options.length === 0) return null;
    if (question.type === "multiple") {
      return "多选题：请选择所有符合的选项。";
    }
    return null;
  }, [question.options, question.type]);

  return (
    <article className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-5">
      <p className="text-sm font-semibold text-zinc-500">
        第 {index + 1} 题 · {typeLabel[question.type]}
      </p>
      <p className="mt-2 text-base text-zinc-800">{question.prompt}</p>
      {hint ? <p className="mt-2 text-xs text-zinc-500">{hint}</p> : null}

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

      {question.type === "blank" && (
        <input
          className="mt-4 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
          placeholder="请输入答案"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {question.type === "short" && (
        <textarea
          className="mt-4 min-h-[140px] w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
          placeholder="请详细阐述你的想法…"
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
  blank: "填空题",
  short: "简答题",
};

function IntroModal({
  quiz,
  totalQuestions,
  onCancel,
  onConfirm,
}: {
  quiz: Quiz;
  totalQuestions: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900">准备开始测试</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200"
          >
            关闭
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm text-zinc-600">
          <p>
            测试标题：
            <span className="font-semibold text-zinc-900">{quiz.title}</span>
          </p>
          <p>题目数量：{totalQuestions} 道</p>
          <p>测验时长：90 分钟（倒计时结束将自动提交）。</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-500">
            <li>建议准备纸笔记录要点，确保网络稳定。</li>
            <li>客观题即时判分，主观题将由 AI 评分并可供管理员复核。</li>
            <li>提交后会返回测验主页，可在下方查看成绩与反馈。</li>
          </ul>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600"
          >
            开始答题
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-zinc-900">确认提交</h3>
        <p className="mt-2 text-sm text-zinc-600">
          提交后无法继续修改答卷，确定要提交吗？
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100"
            disabled={isSubmitting}
          >
            返回检查
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
            disabled={isSubmitting}
          >
            {isSubmitting ? "提交中…" : "确认提交"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h4 className="text-lg font-semibold text-emerald-800">
          本次成绩：{result.score}/{result.total}
        </h4>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center rounded-full border border-emerald-500 px-4 py-1 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/10"
        >
          收起成绩
        </button>
      </div>
      <ul className="mt-4 space-y-3 text-sm">
        {result.feedback.map((feedback) => {
          const question = questions.find((item) => item.id === feedback.id);
          if (!question) return null;

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
              {feedback.aiFeedback && (
                <p className="mt-2 text-xs text-emerald-600">
                  AI 反馈：{feedback.aiFeedback}
                  {typeof feedback.aiScore === "number"
                    ? `（评分：${feedback.aiScore.toFixed(1)}）`
                    : ""}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {result.aiSummary && (
        <p className="mt-4 rounded-xl border border-emerald-100 bg-white/60 p-4 text-sm text-emerald-700">
          总结：{result.aiSummary}
        </p>
      )}
    </section>
  );
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
