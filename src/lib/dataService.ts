import {
  mockCertificate,
  mockLearningModules,
  mockProgress,
  mockQuiz,
  mockTeachingPlanTemplate,
  type CertificateInfo,
  type LearningModule,
  type ProgressSnapshot,
  type Quiz,
  type TeachingPlanTemplate,
} from "@/data/mockData";
import { getActiveQuiz } from "@/lib/assessment/quizRepository";

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

export async function getCertificateInfo(): Promise<CertificateInfo> {
  return structuredClone(mockCertificate);
}

export async function getProgressSnapshot(): Promise<ProgressSnapshot> {
  return structuredClone(mockProgress);
}
