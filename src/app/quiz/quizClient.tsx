"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { useAuth } from "@/components/AuthProvider";
import { fetchLearningModules } from "@/lib/learningModules";
import type { Quiz, QuizQuestion } from "./page";

type SubmissionReceipt = {
  submissionId: string | null;
  status: "pending_review" | "approved" | "rejected";
  passThreshold: number;
  maxScore: number;
  score: number | null;
  finalScore: number | null;
  passed: boolean | null;
  answers: {
    questionId: string;
    response: string | string[] | null;
    isObjective: boolean;
    aiScore?: number | null;
    aiFeedback?: string | null;
    awardedPoints?: number | null;
    maxPoints?: number | null;
    isCorrect?: boolean | null;
  }[];
  aiSummary?: string | null;
  message: string;
};

const TEST_DURATION_SECONDS = 90 * 60;

export function QuizClient({ quiz }: { quiz: Quiz | null }) {
  const { session } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
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

  const submitQuiz = useCallback(async (autoTriggered: boolean) => {
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
        setReceipt({
          submissionId: null,
          status: "rejected",
          passThreshold: 60,
          maxScore: 0,
          score: null,
          finalScore: null,
          passed: null,
          answers: [],
          aiSummary: null,
          message: data.error ?? "Submission failed. Please verify your answers and try again.",
        });
      } else {
        const data = (await response.json()) as SubmissionReceipt;
        setReceipt(data);
        submissionSucceeded = true;
      }
    } catch (error) {
      console.error("[QuizClient] submit error:", error);
      setReceipt({
        submissionId: null,
        status: "rejected",
        passThreshold: 60,
        maxScore: quiz.questions.length,
        score: null,
        finalScore: null,
        passed: null,
        answers: [],
        aiSummary: null,
        message: "Network error. Please try submitting again shortly.",
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
  }, [answers, isSubmitting, quiz, session?.access_token]);

  useEffect(() => {
    let cancelled = false;
    async function loadModules() {
      if (!session?.user) {
        setProgressMessage("Heads up: no active session detected. You can still start the examination.");
        setAllowStart(true);
        setProgressLoading(false);
        return;
      }

      try {
        const modules = await fetchLearningModules();
        if (cancelled) return;

        if (modules.length === 0) {
          setProgressMessage("No learning modules are assigned to this account. Please contact an administrator.");
          setAllowStart(true);
        } else if (modules.every((module) => module.completed)) {
          setProgressMessage(null);
          setAllowStart(true);
        } else {
          const remaining = modules.filter((module) => !module.completed).length;
          setProgressMessage(
            `${remaining} learning module(s) remain incomplete. Finish them before taking the examination.`
          );
          setAllowStart(false);
        }
      } catch (error) {
        console.warn("[QuizClient] Failed to load modules:", error);
        setProgressMessage("Learning progress is unavailable right now, but you can still start the examination.");
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
    if (!hasStarted || receipt) {
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
  }, [hasStarted, receipt, submitQuiz]);

  const countdownLabel = useMemo(() => formatTime(timeLeft), [timeLeft]);

  if (!quiz) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">
        No examination content is available yet.
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
                Recommended time: {quiz.duration} minutes
              </p>
            ) : null}
            <p className="mt-4 text-base text-zinc-700">
              This examination includes {totalQuestions} questions covering single-choice and short-response tasks.
              <br />
              You have 90 minutes; the system will auto-submit when the countdown ends.
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
              Start examination
            </button>
            {progressLoading ? (
              <p className="text-xs text-zinc-400">Checking your learning progress...</p>
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
              <span>Time remaining</span>
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
                Exit and try later
              </button>
              <button
                type="submit"
                className="inline-flex items-center rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit answers"}
              </button>
            </div>
          </form>
          {autoSubmitting && (
            <p className="text-sm font-semibold text-red-500">
              Time is up. Submitting automatically—please keep this page open...
            </p>
          )}
        </section>
      )}

      {!hasStarted && receipt ? (
        <SubmissionReviewPanel
          receipt={receipt}
          questions={quiz.questions}
          onReset={() => {
            setReceipt(null);
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
            setReceipt(null);
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
      return "Multiple choice: select every option that applies.";
    }
    return null;
  }, [question.options, question.type]);

  return (
    <article className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-5">
      <p className="text-sm font-semibold text-zinc-500">
        Question {index + 1} · {typeLabel[question.type]}
      </p>
      <p className="mt-2 text-base text-zinc-800 whitespace-pre-line">
        {question.prompt}
      </p>
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
          placeholder="Enter your answer"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {question.type === "short" && (
        <textarea
          className="mt-4 min-h-[140px] w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
          placeholder="Please explain your reasoning in detail..."
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </article>
  );
}

const typeLabel: Record<QuizQuestion["type"], string> = {
  single: "Single Choice",
  multiple: "Multiple Choice",
  blank: "Fill in the Blank",
  short: "Short Response",
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
          <h3 className="text-lg font-semibold text-zinc-900">Ready to begin?</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200"
          >
            Close
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm text-zinc-600">
          <p>
            Examination title:
            <span className="font-semibold text-zinc-900">{quiz.title}</span>
          </p>
          <p>Number of questions: {totalQuestions}</p>
          <p>Duration: 90 minutes (auto-submit when the timer ends).</p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600"
          >
            Start answering
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
        <h3 className="text-lg font-semibold text-zinc-900">Confirm submission</h3>
        <p className="mt-2 text-sm text-zinc-600">
          You cannot modify answers after submitting. Continue?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100"
            disabled={isSubmitting}
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit now"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubmissionReviewPanel({
  receipt,
  questions,
  onReset,
}: {
  receipt: SubmissionReceipt;
  questions: QuizQuestion[];
  onReset: () => void;
}) {
  const statusLabel =
    receipt.status === "approved"
      ? "Passed"
      : receipt.status === "rejected"
      ? "Failed"
      : "Pending";
  const statusTone =
    receipt.status === "approved"
      ? "text-emerald-600"
      : receipt.status === "rejected"
      ? "text-red-600"
      : "text-sky-700";

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-sky-900">
            AI evaluation: <span className={statusTone}>{statusLabel}</span>
          </h4>
          <p className="mt-1 text-sm text-sky-700">
            Total {formatScore(receipt.score)} / {formatScore(receipt.maxScore)} · Passing score{" "}
            {formatScore(receipt.passThreshold)}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center rounded-full border border-sky-500 px-4 py-1 text-sm font-semibold text-sky-700 hover:bg-sky-500/10"
        >
          Hide answer sheet
        </button>
      </div>
      <p className="mt-3 text-sm text-sky-700">{receipt.message}</p>
      <ul className="mt-4 space-y-3 text-sm">
        {receipt.answers.map((answer) => {
          const question = questions.find((item) => item.id === answer.questionId);
          if (!question) return null;
          const renderedResponse = formatAnswerValue(answer.response);
          const correctnessLabel =
            answer.isObjective && typeof answer.isCorrect === "boolean"
              ? answer.isCorrect
                ? "Judgment: correct"
                : "Judgment: incorrect"
              : null;

          return (
            <li
              key={answer.questionId}
              className="rounded-xl border border-sky-100 bg-white/70 p-4 text-sky-800"
            >
              <p className="font-semibold text-sky-900 whitespace-pre-line">
                {question.prompt}
              </p>
              <p className="mt-2 text-xs text-sky-700">
                My answer: {renderedResponse || "(No response)"}
              </p>
              <p className="mt-2 text-xs text-sky-700">
                Score: {formatScore(answer.awardedPoints)} / {formatScore(answer.maxPoints)}
                {correctnessLabel ? ` · ${correctnessLabel}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-sky-600">
        Results sync to your dashboard automatically. Retake the examination anytime to improve.
      </p>
    </section>
  );
}

function formatScore(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
}

function formatAnswerValue(response: string | string[] | null | undefined): string {
  if (response == null) {
    return "";
  }
  if (Array.isArray(response)) {
    return response.join("，");
  }
  return response;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
