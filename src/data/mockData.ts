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
        content: [
          "Understanding who our learners are is the foundation of every TESOL classroom. Consider their age, proficiency level, cultural background, and personal goals. A young learner preparing for study abroad will approach language with different motivations than a business professional aiming to polish presentation skills.",
          "",
          "Spend time collecting learner stories, interests, and challenges. Encourage them to surface their prior experiences with English and the specific contexts in which they hope to use the language. These narratives inform the tasks, topics, and scaffolds we design.",
          "",
          "Remember that a classroom is always multi-dimensional. Cultural expectations around participation, error correction, and time may influence how learners behave. Build norms that honour these differences while gradually expanding their repertoire."
        ].join("\n"),
      },
      {
        id: "section-1-2",
        title: "Classroom Management Essentials",
        duration: "22 min",
        content: [
          "Purposeful routines keep energy high and reduce cognitive overhead. Start with concise warm-ups to activate schema, then signal transitions clearly with timers or visual cues.",
          "",
          "Balance teacher talk with guided interaction. Use breakout rooms, chat prompts, and collaborative documents to ensure every learner contributes within a safe structure. When issues arise, restate expectations and model the desired behaviours instead of relying on punitive measures.",
          "",
          "In online environments, leverage platform analytics to identify disengagement early. Greet late arrivals, check audio quickly, and provide alternative pathways (transcripts, summary boards) for those with connectivity challenges."
        ].join("\n"),
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
        content: [
          "Backward design flips the planning sequence. Begin by writing a vivid description of what success looks like for learners. Focus on communicative performance, not only linguistic accuracy.",
          "",
          "Once outcomes are clear, determine how learners will demonstrate evidence. Will they record a dialogue? Deliver a micro-presentation? Curate a reflective journal entry? These assessments drive the selection of input materials, modelling, and practice opportunities.",
          "",
          "Finally, curate learning experiences that gradually build towards the assessment. Scaffold with pre-task vocabulary exploration, targeted drills, and rehearsal spaces. Provide checklists so learners know what success requires."
        ].join("\n"),
      },
      {
        id: "section-2-2",
        title: "Assessment and Feedback",
        duration: "19 min",
        content: [
          "Assessment is not an end-of-unit surprise; it is woven into every interaction. Use quick pulse checks—emoji polls, thumbs up/down, exit tickets—to gauge comprehension and adjust pacing.",
          "",
          "When offering feedback, connect comments explicitly to learning goals. Highlight what learners did well, then provide one actionable step for improvement. Encourage peer feedback through structured prompts that focus on noticing rather than judging.",
          "",
          "Document observations in a shared tracker so progress discussions become data-informed. Celebrate growth, however incremental, to sustain learner motivation."
        ].join("\n"),
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
