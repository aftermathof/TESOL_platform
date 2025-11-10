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
  answerOptions?: string[] | null;
  promptOverride?: string | null;
}): Promise<SubjectiveScore> {
  const apiKey = resolveApiKey();
  const trimmedAnswer = params.userAnswer.trim();
  if (!apiKey || !trimmedAnswer) {
    return { aiScore: null, aiFeedback: null };
  }
  if (trimmedAnswer.length < 10) {
    return {
      aiScore: 0,
      aiFeedback: "回答内容不足，无法进行AI评分。",
    };
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
      return { aiScore: null, aiFeedback: `AI 评分失败，状态码 ${response.status}` };
    }

    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { aiScore: null, aiFeedback: "AI 没有返回评分结果" };
    }

    const payload = extractJsonPayload(content);

    let parsed: { score?: number; feedback?: string } | null = null;
    try {
      parsed = JSON.parse(payload);
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

function extractJsonPayload(content: string): string {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && start < end) {
    return trimmed.slice(start, end + 1).trim();
  }
  return trimmed;
}
}

function buildPrompt(params: {
  question: string;
  userAnswer: string;
  referenceAnswer?: string | null;
  answerOptions?: string[] | null;
  promptOverride?: string | null;
}): string {
  if (params.promptOverride) {
    const template = params.promptOverride;
    const compiled = compilePrompt(template, {
      question: params.question,
      answer: params.userAnswer,
      reference:
        params.referenceAnswer ??
        "无固定答案，请结合题目要求、公平、公正地给出评价。",
      options: params.answerOptions?.join(" / ") ?? "",
    });

    const hasQuestionToken = template.includes("{question}") || template.includes("{{question}}");
    const hasAnswerToken = template.includes("{answer}") || template.includes("{{answer}}");
    const hasReferenceToken =
      template.includes("{reference}") || template.includes("{{reference}}");
    const hasOptionsToken = template.includes("{options}") || template.includes("{{options}}");

    const needsQuestion = !hasQuestionToken;
    const needsAnswer = !hasAnswerToken;
    const needsReference = !hasReferenceToken && params.referenceAnswer;
    const needsOptions =
      !hasOptionsToken &&
      Array.isArray(params.answerOptions) &&
      params.answerOptions.length > 0;

    const extras: string[] = [];
    if (needsQuestion) {
      extras.push(`题目：${params.question}`);
    }
    if (needsReference) {
      extras.push(
        `参考答案：${
          params.referenceAnswer ??
          "无固定答案，请结合题目要求、公平、公正地给出评价。"
        }`
      );
    }
    if (needsOptions && params.answerOptions) {
      extras.push(`可参考要点：${params.answerOptions.join(" / ")}`);
    }
    if (needsAnswer) {
      extras.push(`考生回答：${params.userAnswer}`);
    }

    return extras.length > 0 ? `${compiled}\n\n${extras.join("\n")}` : compiled;
  }

  const reference = params.referenceAnswer
    ? `参考答案：${params.referenceAnswer}`
    : "参考答案：无固定答案，请依据题目要求评估。";
  const optionsLine =
    Array.isArray(params.answerOptions) && params.answerOptions.length > 0
      ? `可参考要点或答题选项：${params.answerOptions.join(" / ")}`
      : null;

  return [
    '请为以下主观题答案打分，满分100分，仅返回JSON，如 {"score": 85, "feedback": "简短建议"}',
    `题目：${params.question}`,
    reference,
    ...(optionsLine ? [optionsLine] : []),
    `考生回答：${params.userAnswer}`,
    "请确保反馈使用中文，并提供 1-2 条可执行的改进建议。",
  ].join("\n");
}

function compilePrompt(
  template: string,
  tokens: { question: string; answer: string; reference: string; options: string }
): string {
  return ["question", "answer", "reference", "options"].reduce((acc, key) => {
    const value = tokens[key as keyof typeof tokens] ?? "";
    return acc
      .replaceAll(`{${key}}`, value)
      .replaceAll(`{{${key}}}`, value);
  }, template);
}
