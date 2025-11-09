import {
  mockLearningModules,
  mockProgress,
  mockQuiz,
  mockTeachingPlanTemplate,
  type LearningModule,
  type ProgressSnapshot,
  type Quiz,
  type TeachingPlanTemplate,
} from "@/data/mockData";
import { getActiveQuiz } from "@/lib/assessment/quizRepository";
import { getSupabaseServiceClient } from "@/lib/supabaseServerClient";
import { getCertificateSnapshot } from "@/lib/certificates/server";

export async function getLearningModules(): Promise<LearningModule[]> {
  return structuredClone(mockLearningModules);
}

export async function getQuiz(): Promise<Quiz> {
  try {
    const { quiz, questions } = await getActiveQuiz();
    return {
      id: quiz.id,
      title: quiz.title,
      duration: quiz.duration_minutes ?? null,
      questions: questions.map((question) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        options: question.options ?? undefined,
        answer:
          typeof question.answer === "string" || Array.isArray(question.answer)
            ? (question.answer as string | string[])
            : undefined,
        explanation: question.explanation ?? undefined,
      })),
    };
  } catch (error) {
    console.warn("[dataService] Falling back to mock quiz due to error:", error);
    return structuredClone(mockQuiz);
  }
}

export async function getTeachingPlanTemplate(): Promise<TeachingPlanTemplate> {
  return structuredClone(mockTeachingPlanTemplate);
}

export async function getProgressSnapshot(
  userId?: string | null
): Promise<ProgressSnapshot> {
  const supabase = getSupabaseServiceClient();

  if (!supabase || !userId) {
    return structuredClone(mockProgress);
  }

  try {
    const [{ data: submissionRows, error }, certificateState] = await Promise.all([
      supabase
        .from("quiz_submissions")
        .select("status, final_score, score")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      getCertificateSnapshot(userId),
    ]);

    if (error) {
      throw error;
    }

    const submissions =
      (submissionRows as Array<{
        status: string | null;
        final_score: number | null;
        score: number | null;
      }>) ?? [];

    const attempts = submissions.length;
    const approvedScores = submissions
      .filter((row) => row.status === "approved" && row.final_score != null)
      .map((row) => Number(row.final_score));
    const highestFinalScore =
      approvedScores.length > 0 ? Math.max(...approvedScores) : null;
    const pendingReviewCount = submissions.filter(
      (row) => row.status === "pending_review"
    ).length;
    const latestStatusRaw =
      attempts > 0 ? submissions[0]?.status ?? "pending_review" : "not_started";
    const latestStatus = normalizeSubmissionStatus(latestStatusRaw, attempts);

    const certificateStatus =
      certificateState.certificate.status === "ready"
        ? "available"
        : certificateState.certificate.status === "eligible"
        ? "generating"
        : "not_eligible";
    const learningCompletion =
      certificateState.eligibility.totalModules > 0
        ? certificateState.eligibility.completedModules /
          certificateState.eligibility.totalModules
        : mockProgress.learningCompletion;

    return {
      learningCompletion,
      quiz: {
        attempts,
        highestFinalScore,
        pendingReviewCount,
        latestStatus,
      },
      teachingPlanStatus: mockProgress.teachingPlanStatus,
      certificateStatus,
      certificateUrl: certificateState.certificate.pdfUrl ?? null,
    };
  } catch (error) {
    console.warn("[dataService] Using mock progress due to error:", error);
    return structuredClone(mockProgress);
  }
}

function normalizeSubmissionStatus(
  status: string | null,
  attempts: number
): "not_started" | "pending_review" | "approved" | "rejected" {
  if (!status || attempts === 0) {
    return "not_started";
  }
  if (status === "approved" || status === "rejected" || status === "pending_review") {
    return status;
  }
  return "pending_review";
}
