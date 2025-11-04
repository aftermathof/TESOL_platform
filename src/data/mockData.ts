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
  type: "single" | "multiple" | "blank" | "short";
  prompt: string;
  options?: string[];
  answer?: string | string[];
  explanation?: string;
};

export type Quiz = {
  id: string;
  title: string;
  duration: number | null;
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

export type QuizProgress = {
  attempts: number;
  highestFinalScore: number | null;
  pendingReviewCount: number;
  latestStatus: "not_started" | "pending_review" | "approved" | "rejected";
};

export type ProgressSnapshot = {
  learningCompletion: number;
  quiz: QuizProgress;
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
  title: "51Talk TESOL Certification · 综合测验",
  duration: 90,
  questions: [
    {
      id: "q1",
      type: "single",
      prompt:
        "以下哪一项最能体现交际法（Communicative Language Teaching）的核心目标？",
      options: [
        "通过大量语法操练帮助学生记忆规则",
        "让学生在真实语境中使用语言完成任务",
        "强调准确朗读教材中的对话内容",
        "要求学生完成大篇幅的语法翻译作业",
      ],
      answer: "让学生在真实语境中使用语言完成任务",
      explanation:
        "交际法强调真实语境与意义协商，目标是提升学生在实际交流中的语言运用能力。",
    },
    {
      id: "q2",
      type: "multiple",
      prompt:
        "在设计课堂热身活动（Warm-up）时，下列做法中哪些可以有效激发学生参与度？（多选）",
      options: [
        "设置与主题相关的快速配对游戏",
        "让学生单独默写上一节课的单词",
        "使用图片或短视频引入话题",
        "让学生分享与主题相关的个人经历",
      ],
      answer: [
        "设置与主题相关的快速配对游戏",
        "使用图片或短视频引入话题",
        "让学生分享与主题相关的个人经历",
      ],
      explanation:
        "热身应建立情境、激活背景知识并鼓励互动。纯粹的静态默写不利于调动情绪，也不符合热身目的。",
    },
    {
      id: "q3",
      type: "single",
      prompt:
        "在一节听力课中，教师播放音频前安排预测活动，其主要目的是：",
      options: [
        "提升学生的发音准确度",
        "降低学生的焦虑感并激活背景知识",
        "检验学生是否完成课前作业",
        "延长课堂时长以完成教学进度",
      ],
      answer: "降低学生的焦虑感并激活背景知识",
      explanation:
        "预测活动帮助学生提前建立语境，启用相关背景知识，从而降低理解障碍。",
    },
    {
      id: "q4",
      type: "blank",
      prompt:
        "在任务型教学（Task-based Language Teaching）中，任务完成后用于语言总结和反馈的环节通常被称为 ________。",
      answer: "language focus",
      explanation:
        "任务后（Post-task）阶段的 language focus 用于整理语言点、进行纠错与升华。",
    },
    {
      id: "q5",
      type: "multiple",
      prompt:
        "以下哪些反馈策略适合在口语课堂中支持学生的自我纠错？（多选）",
      options: [
        "重述学生话语并强调正确形式",
        "直接指出错误并给出正确答案",
        "使用提示语引导学生重新表达",
        "让同伴先给出改进建议",
      ],
      answer: [
        "重述学生话语并强调正确形式",
        "使用提示语引导学生重新表达",
        "让同伴先给出改进建议",
      ],
      explanation:
        "重述、提示与同伴互助都能促使学生意识到底层问题并进行自我修正，直接给答案容易削弱反思机会。",
    },
    {
      id: "q6",
      type: "blank",
      prompt:
        "课堂管理中，若教师通过预先约定的手势或视觉信号来提醒课堂纪律，这种策略被称为 ________ cue。",
      answer: "nonverbal",
      explanation:
        "非语言提示（nonverbal cue）利用手势、眼神或视觉符号维持秩序，降低干扰。",
    },
    {
      id: "q7",
      type: "single",
      prompt:
        "在阅读课的教学流程中，下列哪一项最适合安排在 While-reading 阶段？",
      options: [
        "根据标题预测文章内容",
        "扫描文本获取特定信息",
        "讨论主题相关的个人经历",
        "制作词汇网络图复习关键词",
      ],
      answer: "扫描文本获取特定信息",
      explanation:
        "While-reading 阶段聚焦于文本理解策略（如扫读、略读），预测与讨论通常在 Pre-reading 进行。",
    },
    {
      id: "q8",
      type: "multiple",
      prompt:
        "在 51Talk 的在线课堂中，为确保学习者持续参与，下列做法哪些更符合有效的课堂互动原则？（多选）",
      options: [
        "每 5-7 分钟切换一次活动形式",
        "仅使用 PPT 展示信息，避免互动工具",
        "在任务说明中提供明确的示例或演示",
        "利用即时投票或表情反馈收集意见",
      ],
      answer: [
        "每 5-7 分钟切换一次活动形式",
        "在任务说明中提供明确的示例或演示",
        "利用即时投票或表情反馈收集意见",
      ],
      explanation:
        "多元活动、清晰示例与及时反馈可保持学生注意力并提升互动体验，单向 PPT 输出容易降低参与度。",
    },
    {
      id: "q9",
      type: "short",
      prompt:
        "请结合自身教学经验，写出一项可帮助学习者自主规划学习目标的策略，并说明实施步骤。",
      explanation:
        "建议包括：提供学习计划模版、引导学生设定 SMART 目标、定期反思等。",
    },
    {
      id: "q10",
      type: "short",
      prompt:
        "在大班在线课堂中，如果出现部分学生持续沉默的情况，你会如何通过课堂设计鼓励他们主动发言？请描述你的方案。",
      explanation:
        "可以提及分组讨论、分配角色、使用匿名提问板等策略，并说明反馈机制。",
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
  quiz: {
    attempts: 0,
    highestFinalScore: null,
    pendingReviewCount: 0,
    latestStatus: "not_started",
  },
  teachingPlanStatus: "in_review",
  certificateStatus: "not_eligible",
};
