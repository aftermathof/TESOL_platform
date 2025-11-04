export type QuizQuestionType = "single" | "multiple" | "blank" | "short";

export type QuizSource = {
  id: string;
  name: string;
  description: string | null;
  source_file: string | null;
  created_at: string;
};

export type QuizDefinition = {
  id: string;
  source_id: string | null;
  title: string;
  duration_minutes: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type QuizQuestionRecord = {
  id: string;
  quiz_id: string;
  question_type: QuizQuestionType;
  prompt: string;
  options: string[] | null;
  answer: unknown;
  explanation: string | null;
  created_at: string;
};

export type QuizQuestion = {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  options?: string[];
  answer?: unknown;
  explanation?: string | null;
};

export type QuizSubmissionAnswer = {
  questionId: string;
  response: unknown;
  isObjective: boolean;
  isCorrect?: boolean | null;
  aiScore?: number | null;
  aiFeedback?: string | null;
  manualOverride?: boolean | null;
  manualFeedback?: string | null;
  maxPoints: number;
  awardedPoints?: number | null;
};

export type QuizSubmission = {
  id: string;
  quizId: string;
  score: number | null;
  maxScore: number | null;
  passThreshold: number | null;
  finalScore: number | null;
  status: "pending_review" | "approved" | "rejected";
  passed: boolean | null;
  totalItems: number | null;
  aiOverallScore: number | null;
  aiSummary: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type ShortAnswerReviewAnswer = {
  answerId: string;
  questionId: string;
  prompt: string;
  response: string | string[] | null;
  aiScore: number | null;
  aiFeedback: string | null;
  maxPoints: number;
  awardedPoints: number | null;
  manualOverride: boolean | null;
  manualFeedback: string | null;
};

export type ShortAnswerReview = {
  submissionId: string;
  quizId: string;
  quizTitle: string | null;
  userId: string;
  createdAt: string;
  score: number | null;
  maxScore: number | null;
  passThreshold: number | null;
  status: "pending_review" | "approved" | "rejected";
  answers: ShortAnswerReviewAnswer[];
};

export type ReviewUpdatePayload = {
  status: "approved" | "rejected" | "pending_review";
  reviewNotes?: string | null;
  answers: Array<{
    answerId: string;
    awardedPoints: number;
    manualFeedback?: string | null;
  }>;
};

export type TeachingPlanSubmission = {
  id: string;
  planContent: string;
  status: string;
  aiScore: number | null;
  aiFeedback: string | null;
  manualScore: number | null;
  manualFeedback: string | null;
  createdAt: string;
};
