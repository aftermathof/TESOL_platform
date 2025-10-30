"use server";

type PlannedSection = {
  title: string;
  summary?: string;
  durationMinutes?: number;
  content: string;
};

export type PlannedModule = {
  title: string;
  summary?: string;
  sections: PlannedSection[];
};

type PlannerResult = {
  modules: PlannedModule[];
  usedFallback: boolean;
};

const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "gemini-2.0-flash";

export async function planModulesFromRawText(params: {
  text: string;
  baseTitle?: string;
  maxModules?: number;
}): Promise<PlannerResult> {
  const { text, baseTitle, maxModules = 6 } = params;
  const trimmed = text.trim();

  if (!trimmed) {
    return fallbackPlan("OCR 未识别到有效内容，请检查原始文档后重试。", baseTitle);
  }

  const apiKey = process.env.OPENROUTE_API_KEY;
  if (!apiKey) {
    return fallbackPlan(trimmed, baseTitle);
  }

  try {
    const userPrompt = [
      "请根据以下 TESOL 教学资料，将其组织成数个学习模块（Module）。",
      "输出格式需为 JSON，结构示例：",
      '{ "modules": [ { "title": "...", "summary": "...", "sections": [ { "title": "...", "summary": "...", "durationMinutes": 15, "content": "..." } ] } ] }',
      "编排规则：",
      "1. 模块数量建议 3-6 个，可按内容量灵活调整；",
      "2. 每个模块需要 summary，总结核心目标或能力；",
      "3. section.content 为排版后的纯文本，可换行，但不要 Markdown 列表；",
      "4. durationMinutes 尽量介于 10-30 分钟，可估算；",
      "5. 若原文包含图片或重点提示，请在 content 中描述；",
      baseTitle ? `推荐模块主题围绕：${baseTitle}` : "",
      "6. 输出请保持中文。",
      "",
      "以下是原始资料：",
      trimmed,
    ]
      .filter(Boolean)
      .join("\n");

    const endpoint = process.env.OPENROUTE_API_URL ?? DEFAULT_ENDPOINT;
    const model = process.env.OPENROUTE_MODEL ?? DEFAULT_MODEL;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer":
          process.env.OPENROUTE_HTTP_REFERER ?? "https://tesol-platform.local",
        "X-Title": process.env.OPENROUTE_TITLE ?? "TESOL Learning Ingestor",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2200,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an instructional designer who restructures TESOL teaching materials into JSON modules.",
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      let detail = "";
      try {
        detail = await response.text();
      } catch {
        detail = "";
      }

      if (response.status === 401) {
        throw new Error(
          `OpenRouter authentication failed (401)。请确认 OPENROUTE_API_KEY 与密钥绑定的来源设置正确。${detail ? ` 服务器返回：${detail}` : ""}`
        );
      }

      throw new Error(
        `OpenRouter responded with status ${response.status}${
          detail ? `: ${detail}` : ""
        }`
      );
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter returned empty content");
    }

    const parsed = JSON.parse(content) as {
      modules?: Array<{
        title?: string;
        summary?: string;
        sections?: Array<{
          title?: string;
          summary?: string;
          durationMinutes?: number;
          content?: string;
        }>;
      }>;
    };

    const modules =
      parsed.modules
        ?.slice(0, maxModules)
        .map<PlannedModule>((module, moduleIndex) => ({
          title: sanitizeText(module.title) ?? `模块 ${moduleIndex + 1}`,
          summary: sanitizeText(module.summary) ?? undefined,
          sections:
            module.sections?.map<PlannedSection>((section, sectionIndex) => ({
              title:
                sanitizeText(section.title) ??
                `模块 ${moduleIndex + 1} - 学习要点 ${sectionIndex + 1}`,
              summary: sanitizeText(section.summary) ?? undefined,
              durationMinutes: clampDuration(
                section.durationMinutes ?? estimateDuration(section.content)
              ),
              content:
                sanitizeText(section.content, true) ??
                "（待补充：该部分内容需要人工完善。）",
            })) ?? [],
        }))
        .filter((module) => module.sections.length > 0) ?? [];

    if (modules.length === 0) {
      return fallbackPlan(trimmed, baseTitle);
    }

    return {
      modules,
      usedFallback: false,
    };
  } catch (error) {
    console.warn("[modulePlanner] OpenRouter failed, using fallback:", error);
    return fallbackPlan(trimmed, baseTitle);
  }
}

function fallbackPlan(text: string, baseTitle?: string): PlannerResult {
  const paragraphs = splitIntoParagraphs(text);
  if (paragraphs.length === 0) {
    return {
      modules: [
        {
          title: baseTitle ?? "待整理资料",
          summary: "OCR 未识别到有效内容，请管理员检查文档或重新上传。",
          sections: [
            {
              title: "待补充内容",
              durationMinutes: 15,
              content: "暂无内容。",
            },
          ],
        },
      ],
      usedFallback: true,
    };
  }

  const chunkSize = Math.max(3, Math.ceil(paragraphs.length / 4));
  const chunks: string[][] = [];
  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    chunks.push(paragraphs.slice(i, i + chunkSize));
  }

  const modules: PlannedModule[] = chunks.map((chunk, index) => ({
    title:
      index === 0 && baseTitle ? `${baseTitle}` : `学习模块 ${index + 1}`,
    summary: chunk.slice(0, 2).join(" "),
    sections: chunk.map<PlannedSection>((paragraph, sectionIndex) => ({
      title: `学习要点 ${sectionIndex + 1}`,
      durationMinutes: clampDuration(Math.round(paragraph.length / 40)),
      content: paragraph,
    })),
  }));

  return {
    modules,
    usedFallback: true,
  };
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((item) => sanitizeText(item, true))
    .filter(Boolean) as string[];
}

function sanitizeText(
  value?: unknown,
  preserveLineBreak = false
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const raw = typeof value === "string" ? value : String(value);
  if (raw.length === 0) {
    return undefined;
  }
  const trimmed = preserveLineBreak
    ? raw
        .replace(/\r/g, "")
        .replace(/\t/g, " ")
        .replace(/[ \u00A0]+/g, " ")
        .trim()
    : raw.replace(/\s+/g, " ").trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function clampDuration(value: number | undefined | null): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }
  return Math.min(45, Math.max(10, Math.round(value)));
}

function estimateDuration(content?: string | null): number {
  if (!content) return 15;
  const words = content.replace(/\s+/g, " ").trim().length;
  return clampDuration(Math.round(words / 40)) ?? 15;
}
