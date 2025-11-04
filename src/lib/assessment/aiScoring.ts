const OPENROUTE_ENDPOINT =
  process.env.OPENROUTE_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTE_MODEL =
  process.env.OPENROUTE_MODEL ?? "google/gemini-2.5-flash";

type SubjectiveScore = {
  aiScore: number | null;
  aiFeedback: string | null;
};

function resolveApiKey(): string | null {
  const apiKey = process.env.OPENROUTE_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[aiScoring] OPENROUTE_API_KEY missing, skip AI grading");
    return null;
  }
  return apiKey;
}

export async function scoreSubjectiveAnswer(params: {
  question: string;
  userAnswer: string;
  referenceAnswer?: string | null;
}): Promise<SubjectiveScore> {
  const apiKey = resolveApiKey();
  if (!apiKey || !params.userAnswer.trim()) {
    return { aiScore: null, aiFeedback: null };
  }

  const prompt = buildPrompt(params);

  try {
    const response = await fetch(OPENROUTE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENROUTE_MODEL,
        temperature: 0,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an objective examiner that returns JSON with fields score (0-100) and feedback (<=160 Chinese characters).",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      console.warn("[aiScoring] OpenRouter error:", response.status, raw);
      return { aiScore: null, aiFeedback: `AI 评分失败：${response.status}` };
    }

    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { aiScore: null, aiFeedback: "AI 没有返回评分结果" };
    }

    let parsed: { score?: number; feedback?: string } | null = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { aiScore: null, aiFeedback: content.slice(0, 160) };
    }

    return {
      aiScore:
        typeof parsed?.score === "number"
          ? Math.min(Math.max(parsed.score, 0), 100)
          : null,
      aiFeedback: parsed?.feedback ?? null,
    };
  } catch (error) {
    console.warn("[aiScoring] Scoring failed:", error);
    return {
      aiScore: null,
      aiFeedback: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildPrompt(params: {
  question: string;
  userAnswer: string;
  referenceAnswer?: string | null;
}): string {
  const reference = params.referenceAnswer
    ? `参考答案：${params.referenceAnswer}`
    : "参考答案：无固定答案，请依据题目要求评估。";
  return [
    `请为以下主观题答案打分，满分100分，仅返回JSON，如 {"score": 85, "feedback": "简短建议"}`,
    `题目：${params.question}`,
    reference,
    `考生回答：${params.userAnswer}`,
    "请确保反馈中文输出，聚焦于可改进的要点。",
  ].join("\n");
}
