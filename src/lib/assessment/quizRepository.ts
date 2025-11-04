import { getSupabaseServiceClient } from "@/lib/supabaseServerClient";
import type {
  QuizDefinition,
  QuizQuestion,
  QuizQuestionRecord,
  QuizSubmission,
  QuizSubmissionAnswer,
} from "./types";
import { mockQuiz } from "@/data/mockData";

type QuizRecordWithQuestions = {
  quiz: QuizDefinition;
  questions: QuizQuestion[];
};

function mapQuestion(record: QuizQuestionRecord): QuizQuestion {
  return {
    id: record.id,
    type: record.question_type,
    prompt: record.prompt,
    options: Array.isArray(record.options)
      ? (record.options as string[])
      : undefined,
    answer: record.answer ?? undefined,
    explanation: record.explanation ?? undefined,
  };
}

export async function getActiveQuiz(): Promise<QuizRecordWithQuestions> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return {
      quiz: {
        id: mockQuiz.id,
        source_id: null,
        title: mockQuiz.title,
        duration_minutes: mockQuiz.duration,
        metadata: {},
        created_at: new Date().toISOString(),
      },
      questions: mockQuiz.questions.map((question) => ({
        id: question.id,
        type: question.type === "text" ? "short" : question.type,
        prompt: question.prompt,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
      })),
    };
  }

  const { data: quizRows, error: quizError } = await supabase
    .from("quiz_bank")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (quizError || !quizRows || quizRows.length === 0) {
    console.warn("[quizRepository] fallback to mock quiz:", quizError);
    return {
      quiz: {
        id: mockQuiz.id,
        source_id: null,
        title: mockQuiz.title,
        duration_minutes: mockQuiz.duration,
        metadata: {},
        created_at: new Date().toISOString(),
      },
      questions: mockQuiz.questions.map((question) => ({
        id: question.id,
        type: question.type === "text" ? "short" : question.type,
        prompt: question.prompt,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
      })),
    };
  }

  const quiz = quizRows[0] as QuizDefinition;
  const { data: questionRows, error: questionError } = await supabase
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", quiz.id)
    .order("created_at", { ascending: true });

  if (questionError || !questionRows) {
    throw new Error(
      `Failed to load quiz questions: ${questionError?.message ?? "Unknown error"}`
    );
  }

  return {
    quiz,
    questions: (questionRows as QuizQuestionRecord[]).map(mapQuestion),
  };
}

export async function saveQuizSubmission(params: {
  userId: string;
  quizId: string;
  score: number;
  totalItems: number;
  aiOverallScore?: number | null;
  aiSummary?: string | null;
  answers: QuizSubmissionAnswer[];
}): Promise<QuizSubmission> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const { data: submissionRows, error: submissionError } = await supabase
    .from("quiz_submissions")
    .insert({
      quiz_id: params.quizId,
      user_id: params.userId,
      score: params.score,
      total_items: params.totalItems,
      ai_overall_score: params.aiOverallScore ?? null,
      ai_summary: params.aiSummary ?? null,
    })
    .select()
    .single();

  if (submissionError || !submissionRows) {
    throw new Error(
      `Failed to create quiz submission: ${
        submissionError?.message ?? "Unknown error"
      }`
    );
  }

  const submission = submissionRows as {
    id: string;
    quiz_id: string;
    score: number | null;
    total_items: number | null;
    ai_overall_score: number | null;
    ai_summary: string | null;
    created_at: string;
  };

  if (params.answers.length > 0) {
    const payload = params.answers.map((answer) => ({
      submission_id: submission.id,
      question_id: answer.questionId,
      response: answer.response,
      is_objective: answer.isObjective,
      is_correct: answer.isCorrect ?? null,
      ai_score: answer.aiScore ?? null,
      ai_feedback: answer.aiFeedback ?? null,
      manual_override: answer.manualOverride ?? null,
      manual_feedback: answer.manualFeedback ?? null,
    }));

    const { error: answerError } = await supabase
      .from("quiz_submission_answers")
      .insert(payload);

    if (answerError) {
      console.error("[quizRepository] Failed to insert answers", answerError);
    }
  }

  return {
    id: submission.id,
    quizId: submission.quiz_id,
    score: submission.score,
    totalItems: submission.total_items,
    aiOverallScore: submission.ai_overall_score,
    aiSummary: submission.ai_summary,
    createdAt: submission.created_at,
  };
}
