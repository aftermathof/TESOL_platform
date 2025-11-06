import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getActiveQuiz,
  saveQuizSubmission,
} from "@/lib/assessment/quizRepository";
import { scoreSubjectiveAnswer } from "@/lib/assessment/aiScoring";
import { getSupabaseServiceClient } from "@/lib/supabaseServerClient";
import type { QuizQuestion } from "@/data/mockData";
import type { QuizSubmissionAnswer } from "@/lib/assessment/types";

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
      const expected =
        typeof question.answer === "string" ? question.answer : null;
      const correct =
        typeof userAnswer === "string" && userAnswer === expected;
      record.isCorrect = correct;
      record.awardedPoints = correct ? weight : 0;
      rawScore += record.awardedPoints;
    } else if (question.type === "multiple") {
      const expected = Array.isArray(question.answer) ? question.answer : [];
      const received = Array.isArray(userAnswer) ? userAnswer : [];
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
      });
      record.isObjective = false;
      record.aiScore = aiResult.aiScore;
      record.aiFeedback = aiResult.aiFeedback ?? null;
      if (typeof aiResult.aiScore === "number") {
        const awarded = (aiResult.aiScore / 100) * weight;
        record.awardedPoints = Number(awarded.toFixed(2));
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
  const lastIndex = questions.length - 1;

  questions.forEach((question, index) => {
    const configured =
      typeof question.points === "number" && !Number.isNaN(question.points)
        ? question.points
        : null;
    if (configured != null && configured > 0) {
      plan.set(question.id, configured);
      return;
    }

    if (question.type === "short") {
      plan.set(question.id, index === lastIndex ? 50 : 10);
      return;
    }

    plan.set(question.id, 1);
  });

  return plan;
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
