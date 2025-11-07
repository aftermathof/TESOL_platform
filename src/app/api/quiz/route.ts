import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getActiveQuiz,
  saveQuizSubmission,
} from "@/lib/assessment/quizRepository";
import { scoreSubjectiveAnswer } from "@/lib/assessment/aiScoring";
import { getSupabaseServiceClient } from "@/lib/supabaseServerClient";
import type {
  QuizQuestion,
  QuizSubmissionAnswer,
} from "@/lib/assessment/types";

const submissionSchema = z.object({
  quizId: z.string().uuid().optional(),
  answers: z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .default({}),
});

const PASS_THRESHOLD = 60;

export async function GET() {
  const { quiz, questions } = await getActiveQuiz();
  return NextResponse.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      duration: quiz.duration_minutes ?? null,
      questions: questions.map((question) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        options: question.options ?? undefined,
        explanation: question.explanation ?? undefined,
      })),
    },
  });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const parseResult = submissionSchema.safeParse(payload);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid quiz submission format", details: parseResult.error },
      { status: 400 }
    );
  }

  const { quiz, questions } = await getActiveQuiz();
  if (parseResult.data.quizId && parseResult.data.quizId !== quiz.id) {
    return NextResponse.json(
      { error: "Quiz version mismatch, please refresh and retry." },
      { status: 409 }
    );
  }

  const grading = await gradeAnswers(parseResult.data.answers, questions);
  const userId = await resolveUserId(request);
  const passed = grading.rawScore >= grading.passThreshold;
  const status = passed ? "approved" : "rejected";
  const finalScore = grading.rawScore;

  let submissionId: string | null = null;
  if (userId) {
    try {
      const submission = await saveQuizSubmission({
        userId,
        quizId: quiz.id,
        rawScore: grading.rawScore,
        maxScore: grading.maxScore,
        passThreshold: grading.passThreshold,
        finalScore,
        status,
        passed,
        totalItems: questions.length,
        aiOverallScore: grading.averageAiScore,
        aiSummary: grading.aiSummary,
        answers: grading.persistedAnswers,
      });
      submissionId = submission.id;
    } catch (error) {
      console.error("[quiz] Failed to persist submission:", error);
    }
  }

  return NextResponse.json({
    submissionId,
    status,
    passThreshold: grading.passThreshold,
    maxScore: grading.maxScore,
    score: grading.rawScore,
    finalScore,
    passed,
    aiSummary: grading.aiSummary,
    answers: grading.persistedAnswers.map((answer) => ({
      questionId: answer.questionId,
      response: answer.response,
      isObjective: answer.isObjective,
      aiScore: answer.aiScore ?? null,
      aiFeedback: answer.aiFeedback ?? null,
      awardedPoints: answer.awardedPoints ?? null,
      maxPoints: answer.maxPoints,
      isCorrect: answer.isCorrect ?? null,
    })),
    message: passed
      ? "AI 已完成评分，恭喜通过测试！"
      : "AI 已完成评分，本次未达到及格线，请继续努力。",
  });
}

async function gradeAnswers(
  answers: Record<string, string | string[]>,
  questions: QuizQuestion[]
): Promise<{
  rawScore: number;
  maxScore: number;
  passThreshold: number;
  aiSummary: string | null;
  averageAiScore: number | null;
  persistedAnswers: QuizSubmissionAnswer[];
}> {
  const scoringPlan = buildScoringPlan(questions);
  const persistedAnswers: QuizSubmissionAnswer[] = [];
  const aiFeedbackSnippets: string[] = [];
  const aiScores: number[] = [];

  let rawScore = 0;

  for (const question of questions) {
    const weight = scoringPlan.get(question.id) ?? 1;
    const userAnswer = answers[question.id];
    const record: QuizSubmissionAnswer = {
      questionId: question.id,
      response: userAnswer ?? null,
      isObjective: question.type !== "short",
      isCorrect: null,
      aiScore: null,
      aiFeedback: null,
      maxPoints: weight,
      awardedPoints: 0,
    };

    if (question.type === "single") {
      const expected = resolveSingleAnswer(question.answer, question.options);
      const received =
        typeof userAnswer === "string" ? userAnswer.trim() : undefined;
      const correct =
        expected != null &&
        typeof received === "string" &&
        normalizeOptionValue(received) === normalizeOptionValue(expected);
      record.isCorrect = correct;
      record.awardedPoints = correct ? weight : 0;
      rawScore += record.awardedPoints;
    } else if (question.type === "multiple") {
      const expected = resolveMultipleAnswer(question.answer, question.options);
      const received = Array.isArray(userAnswer)
        ? userAnswer.map((item) =>
            typeof item === "string" ? normalizeOptionValue(item) : ""
          )
        : [];
      const correct =
        expected.length === received.length &&
        expected.every((item) => received.includes(item));
      record.isCorrect = correct;
      record.awardedPoints = correct ? weight : 0;
      rawScore += record.awardedPoints;
    } else if (question.type === "blank") {
      const expected = Array.isArray(question.answer)
        ? question.answer.map((item) => item.toString().trim().toLowerCase())
        : typeof question.answer === "string"
        ? [question.answer.trim().toLowerCase()]
        : [];
      const received =
        typeof userAnswer === "string" ? userAnswer.trim().toLowerCase() : "";
      const correct =
        received.length > 0 &&
        (expected.length === 0 || expected.includes(received));
      record.isCorrect = correct;
      record.awardedPoints = correct ? weight : 0;
      rawScore += record.awardedPoints;
    } else {
      const userText =
        typeof userAnswer === "string" ? userAnswer.trim() : "";
      const reference =
        typeof question.answer === "string"
          ? question.answer
          : Array.isArray(question.answer)
          ? question.answer.join(" / ")
          : null;
      const aiResult = await scoreSubjectiveAnswer({
        question: question.prompt,
        userAnswer: userText,
        referenceAnswer: reference,
        answerOptions: Array.isArray(question.options) ? question.options : undefined,
        promptOverride: question.aiPrompt ?? undefined,
      });
      record.isObjective = false;
      record.aiScore = aiResult.aiScore;
      record.aiFeedback = aiResult.aiFeedback ?? null;
      if (typeof aiResult.aiScore === "number") {
        record.awardedPoints = Number(aiResult.aiScore.toFixed(2));
        rawScore += record.awardedPoints;
        aiScores.push(aiResult.aiScore);
      }
      if (aiResult.aiFeedback) {
        aiFeedbackSnippets.push(aiResult.aiFeedback);
      }
    }

    persistedAnswers.push(record);
  }

  const maxScore = Array.from(scoringPlan.values()).reduce(
    (acc, value) => acc + value,
    0
  );

  return {
    rawScore: Number(rawScore.toFixed(2)),
    maxScore,
    passThreshold: PASS_THRESHOLD,
    aiSummary:
      aiFeedbackSnippets.length > 0
        ? aiFeedbackSnippets.slice(0, 3).join(" / ")
        : null,
    averageAiScore:
      aiScores.length > 0
        ? aiScores.reduce((acc, value) => acc + value, 0) / aiScores.length
        : null,
    persistedAnswers,
  };
}

function buildScoringPlan(questions: QuizQuestion[]): Map<string, number> {
  const plan = new Map<string, number>();
  const shortQuestionIds = questions
    .filter((question) => question.type === "short")
    .map((question) => question.id);
  const lastShortId =
    shortQuestionIds.length > 0
      ? shortQuestionIds[shortQuestionIds.length - 1]
      : null;

  questions.forEach((question) => {
    const configured =
      typeof question.points === "number" && !Number.isNaN(question.points)
        ? question.points
        : null;
    if (configured != null && configured > 0) {
      plan.set(question.id, configured);
      return;
    }

    if (question.type === "short") {
      plan.set(question.id, question.id === lastShortId ? 50 : 10);
      return;
    }

    plan.set(question.id, 1);
  });

  return plan;
}

function normalizeOptionValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function mapLetterToOption(
  rawValue: string,
  options?: string[] | null
): string | undefined {
  const trimmed = rawValue.trim();
  if (!options || options.length === 0) {
    return undefined;
  }
  if (/^[A-Za-z]$/.test(trimmed)) {
    const index = trimmed.toUpperCase().charCodeAt(0) - 65;
    if (index >= 0 && index < options.length) {
      return options[index];
    }
  }
  return undefined;
}

function resolveSingleAnswer(
  answer: unknown,
  options?: string[] | null
): string | null {
  if (typeof answer === "string") {
    const mapped = mapLetterToOption(answer, options);
    return (mapped ?? answer).trim();
  }
  return null;
}

function resolveMultipleAnswer(
  answer: unknown,
  options?: string[] | null
): string[] {
  if (Array.isArray(answer)) {
    return answer
      .map((item) => {
        if (typeof item !== "string") return null;
        const mapped = mapLetterToOption(item, options) ?? item;
        return normalizeOptionValue(mapped);
      })
      .filter((item): item is string => Boolean(item));
  }
  if (typeof answer === "string") {
    const mapped = mapLetterToOption(answer, options) ?? answer;
    return [normalizeOptionValue(mapped)];
  }
  return [];
}

async function resolveUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const accessToken = authHeader.slice("Bearer ".length).trim();
  if (!accessToken) return null;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user?.id) {
      return null;
    }
    return data.user.id;
  } catch {
    return null;
  }
}
