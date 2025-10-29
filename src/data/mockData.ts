export type LearningSection = {
  id: string;
  title: string;
  duration: string;
  content: string;
};

export type LearningModule = {
  id: string;
  title: string;
  description: string;
  progress: number;
  sections: LearningSection[];
};

export type QuizQuestion = {
  id: string;
  type: "single" | "multiple" | "text";
  prompt: string;
  options?: string[];
  answer?: string | string[];
  explanation?: string;
};

export type Quiz = {
  id: string;
  title: string;
  duration: number;
  questions: QuizQuestion[];
};

export type TeachingPlanTemplate = {
  objectives: string[];
  steps: string[];
  tips: string[];
};

export type CertificateInfo = {
  certificateId: string;
  teacherName: string;
  issuedAt: string;
  status: "ready" | "pending" | "locked";
  downloadUrl?: string;
};

export type ProgressSnapshot = {
  learningCompletion: number;
  pendingQuizzes: number;
  teachingPlanStatus: "not_submitted" | "in_review" | "approved";
  certificateStatus: "not_eligible" | "generating" | "available";
};

export const mockLearningModules: LearningModule[] = [
  {
    id: "module-1",
    title: "Module 1 · TESOL Foundation",
    description:
      "Introduction to TESOL methodology, core concepts, and learner-centered classrooms.",
    progress: 0.6,
    sections: [
      {
        id: "section-1-1",
        title: "Understanding TESOL Learners",
        duration: "18 min",
        content:
          "Explore different learner profiles, motivations, and cultural considerations when teaching English.",
      },
      {
        id: "section-1-2",
        title: "Classroom Management Essentials",
        duration: "22 min",
        content:
          "Techniques for maintaining engagement and managing diverse classrooms in online and offline settings.",
      },
    ],
  },
  {
    id: "module-2",
    title: "Module 2 · Lesson Planning",
    description:
      "Designing effective TESOL lesson plans with clear objectives and assessment strategies.",
    progress: 0.35,
    sections: [
      {
        id: "section-2-1",
        title: "Backwards Design Framework",
        duration: "15 min",
        content:
          "Plan lessons by identifying desired learning outcomes and aligning assessments and activities.",
      },
      {
        id: "section-2-2",
        title: "Assessment and Feedback",
        duration: "19 min",
        content:
          "Use formative assessment to inform real-time adjustments and offer actionable feedback.",
      },
    ],
  },
];

export const mockQuiz: Quiz = {
  id: "quiz-1",
  title: "Module 1 Knowledge Check",
  duration: 20,
  questions: [
    {
      id: "q1",
      type: "single",
      prompt:
        "Which strategy best supports differentiated instruction in a TESOL classroom?",
      options: [
        "Using the same worksheet for every learner",
        "Allowing learners to choose between discussion or writing tasks",
        "Prioritising grammar accuracy over communication",
        "Skipping warm-up activities to save time",
      ],
      answer: "Allowing learners to choose between discussion or writing tasks",
      explanation:
        "Providing modality choices allows learners to engage with materials via their strengths, supporting differentiation.",
    },
    {
      id: "q2",
      type: "text",
      prompt:
        "Describe one technique you would use to maintain engagement during an online TESOL session.",
      explanation:
        "Techniques include breakout rooms, interactive polls, targeted questioning, or live annotation.",
    },
  ],
};

export const mockTeachingPlanTemplate: TeachingPlanTemplate = {
  objectives: [
    "Learners can use the present perfect tense to describe experiences.",
    "Learners can ask follow-up questions using appropriate intonation.",
  ],
  steps: [
    "Warm-up discussion with experience-sharing prompts.",
    "Mini lecture with examples and timeline visuals.",
    "Guided pair practice using breakout rooms with provided question lists.",
    "Whole-class reflection and error correction.",
  ],
  tips: [
    "Highlight learner contributions to build confidence.",
    "Provide sentence starters for less confident learners.",
    "Monitor breakout rooms and capture exemplar answers.",
  ],
};

export const mockCertificate: CertificateInfo = {
  certificateId: "TESOL-2025-0001",
  teacherName: "Alex Johnson",
  issuedAt: "2025-10-15",
  status: "pending",
};

export const mockProgress: ProgressSnapshot = {
  learningCompletion: 0.48,
  pendingQuizzes: 1,
  teachingPlanStatus: "in_review",
  certificateStatus: "not_eligible",
};
