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

export async function getLearningModules(): Promise<LearningModule[]> {
  return structuredClone(mockLearningModules);
}

export async function getQuiz(): Promise<Quiz> {
  return structuredClone(mockQuiz);
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

export async function scoreQuiz(
  answers: Record<string, string | string[]>
): Promise<{
  score: number;
  total: number;
  feedback: { id: string; correct: boolean; explanation?: string }[];
}> {
  const quiz = await getQuiz();
  let score = 0;
  const feedback = quiz.questions.map((question) => {
    const userAnswer = answers[question.id];
    let correct = false;

    if (question.type === "single" && typeof userAnswer === "string") {
      correct = userAnswer === question.answer;
    } else if (question.type === "multiple" && Array.isArray(userAnswer)) {
      const expected = Array.isArray(question.answer) ? question.answer : [];
      correct =
        expected.length === userAnswer.length &&
        expected.every((value) => userAnswer.includes(value));
    } else if (question.type === "text") {
      correct = typeof userAnswer === "string" && userAnswer.trim().length > 0;
    }

    if (correct) {
      score += 1;
    }

    return {
      id: question.id,
      correct,
      explanation: question.explanation,
    };
  });

  return {
    score,
    total: quiz.questions.length,
    feedback,
  };
}
