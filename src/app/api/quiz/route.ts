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
  if (userId) {
    try {
      await saveQuizSubmission({
        userId,
        quizId: quiz.id,
        score: grading.score,
        totalItems: questions.length,
        aiOverallScore: grading.averageAiScore,
        aiSummary: grading.aiSummary,
        answers: grading.persistedAnswers,
      });
    } catch (error) {
      console.error("[quiz] Failed to persist submission:", error);
    }
  }

  return NextResponse.json({
    score: grading.score,
    total: questions.length,
    feedback: grading.feedback,
    aiSummary: grading.aiSummary,
  });
}

async function gradeAnswers(
  answers: Record<string, string | string[]>,
  questions: QuizQuestion[]
): Promise<{
  score: number;
  feedback: {
    id: string;
    correct: boolean;
    explanation?: string;
    aiScore?: number | null;
    aiFeedback?: string | null;
  }[];
  aiSummary: string | null;
  averageAiScore: number | null;
  persistedAnswers: QuizSubmissionAnswer[];
}> {
  let score = 0;
  const feedback: {
    id: string;
    correct: boolean;
    explanation?: string;
    aiScore?: number | null;
    aiFeedback?: string | null;
  }[] = [];
  const persistedAnswers: QuizSubmissionAnswer[] = [];
  const aiFeedbackSnippets: string[] = [];
  const aiScores: number[] = [];

  for (const question of questions) {
    const userAnswer = answers[question.id];
    const record: QuizSubmissionAnswer = {
      questionId: question.id,
      response: userAnswer ?? null,
      isObjective: question.type !== "short",
      isCorrect: null,
      aiScore: null,
      aiFeedback: null,
    };

    if (question.type === "single") {
      const expected =
        typeof question.answer === "string" ? question.answer : null;
      const correct =
        typeof userAnswer === "string" && userAnswer === expected;
      if (correct) score += 1;
      record.isCorrect = correct;
      feedback.push({
        id: question.id,
        correct,
        explanation: question.explanation,
      });
    } else if (question.type === "multiple") {
      const expected = Array.isArray(question.answer) ? question.answer : [];
      const received = Array.isArray(userAnswer) ? userAnswer : [];
      const correct =
        expected.length === received.length &&
        expected.every((item) => received.includes(item));
      if (correct) score += 1;
      record.isCorrect = correct;
      feedback.push({
        id: question.id,
        correct,
        explanation: question.explanation,
      });
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
      if (correct) score += 1;
      record.isCorrect = correct;
      feedback.push({
        id: question.id,
        correct,
        explanation: question.explanation,
      });
    } else {
      const userText =
        typeof userAnswer === "string" ? userAnswer.trim() : "";
      const reference =
        typeof question.answer === "string"
          ? question.answer
          : Array.isArray(question.answer)
          ? question.answer.join("；")
          : null;
      const aiResult = await scoreSubjectiveAnswer({
        question: question.prompt,
        userAnswer: userText,
        referenceAnswer: reference,
      });
      record.isObjective = false;
      record.aiScore = aiResult.aiScore;
      record.aiFeedback = aiResult.aiFeedback ?? null;
      const correct =
        typeof aiResult.aiScore === "number"
          ? aiResult.aiScore >= 60
          : userText.length > 0;
      if (correct) score += 1;
      record.isCorrect = correct;
      feedback.push({
        id: question.id,
        correct,
        explanation: question.explanation,
        aiScore: aiResult.aiScore,
        aiFeedback: aiResult.aiFeedback ?? undefined,
      });
      if (aiResult.aiFeedback) {
        aiFeedbackSnippets.push(aiResult.aiFeedback);
      }
      if (typeof aiResult.aiScore === "number") {
        aiScores.push(aiResult.aiScore);
      }
    }

    persistedAnswers.push(record);
  }

  return {
    score,
    feedback,
    aiSummary:
      aiFeedbackSnippets.length > 0
        ? aiFeedbackSnippets.slice(0, 3).join("；")
        : null,
    averageAiScore:
      aiScores.length > 0
        ? aiScores.reduce((acc, value) => acc + value, 0) / aiScores.length
        : null,
    persistedAnswers,
  };
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
