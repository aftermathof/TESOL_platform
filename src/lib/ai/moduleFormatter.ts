import type { DraftModule } from "@/lib/learningIngestor";

type FormatterOptions = {
  sourceKey: string;
  baseTitle?: string;
  originalText?: string;
};

export type FormatModulesResult = {
  modules: DraftModule[];
  usedFormatter: boolean;
  formatterModel?: string;
  error?: string | null;
};

const OPENROUTE_ENDPOINT =
  process.env.OPENROUTE_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTE_MODEL =
  process.env.OPENROUTE_MODEL ?? "google/gemini-2.5-flash";

const SECTION_SYSTEM_PROMPT = `You are a meticulous editor who cleans OCR text.
- Preserve the original meaning and sentence order.
- Merge broken lines into coherent paragraphs.
- Remove standalone page numbers, headers/footers, and obvious OCR garbage.
- Keep paragraph breaks using blank lines.
- Do not return markdown code fences or additional commentary. Output clean plain text only.`;

const SUMMARY_SYSTEM_PROMPT = `You are an assistant who rewrites short summaries.
Clean up OCR artifacts, merge broken sentences, and return a concise summary in plain text.`;

let cachedApiKey: string | null = null;

function resolveApiKey(): string | null {
  if (cachedApiKey !== null) {
    return cachedApiKey;
  }
  cachedApiKey = process.env.OPENROUTE_API_KEY?.trim() ?? null;
  if (!cachedApiKey) {
    console.warn("[moduleFormatter] OPENROUTE_API_KEY missing, skipping formatter.");
  }
  return cachedApiKey;
}

export async function formatModulesWithOpenRouter(
  modules: DraftModule[],
  options: FormatterOptions
): Promise<FormatModulesResult> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    return {
      modules,
      usedFormatter: false,
      error: "OPENROUTE_API_KEY is not set.",
    };
  }

  const cleanedModules: DraftModule[] = [];
  const errors: string[] = [];
  let successCount = 0;
  let changed = false;

  for (const module of modules) {
    const cleanedSections = [];
    let cleanedSummary = module.summary ?? null;

    if (module.summary?.trim()) {
      const summaryResult = await cleanTextWithOpenRouter({
        apiKey,
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        userContent: module.summary,
      });
      if (summaryResult.ok) {
        successCount += 1;
        if (summaryResult.text !== module.summary) {
          cleanedSummary = summaryResult.text;
          changed = true;
        }
      } else if (summaryResult.error) {
        errors.push(`[module ${module.title}] summary: ${summaryResult.error}`);
      }
    }

    for (const section of module.sections) {
      const result = await cleanTextWithOpenRouter({
        apiKey,
        systemPrompt: SECTION_SYSTEM_PROMPT,
        userContent: section.content,
      });
      if (result.ok) {
        successCount += 1;
        const cleanedContent = result.text;
        if (cleanedContent !== section.content) {
          changed = true;
        }

        let cleanedSectionSummary = section.summary ?? null;
        if (section.summary?.trim()) {
          const summaryResult = await cleanTextWithOpenRouter({
            apiKey,
            systemPrompt: SUMMARY_SYSTEM_PROMPT,
            userContent: section.summary,
          });
          if (summaryResult.ok) {
            successCount += 1;
            if (summaryResult.text !== section.summary) {
              cleanedSectionSummary = summaryResult.text;
              changed = true;
            }
          } else if (summaryResult.error) {
            errors.push(
              `[module ${module.title}] section ${section.title} summary: ${summaryResult.error}`
            );
          }
        }

        cleanedSections.push({
          ...section,
          content: cleanedContent,
          summary: cleanedSectionSummary,
        });
      } else {
        errors.push(
          `[module ${module.title}] section ${section.title}: ${result.error ?? "unknown error"}`
        );
        cleanedSections.push(section);
      }
    }

    cleanedModules.push({
      ...module,
      sections: cleanedSections,
      summary: cleanedSummary,
    });
  }

  return {
    modules: cleanedModules,
    usedFormatter: successCount > 0 && changed,
    formatterModel: OPENROUTE_MODEL,
    error: errors.length > 0 ? errors.join(" | ") : null,
  };
}

type CleanTextResult =
  | { ok: true; text: string }
  | { ok: false; text: string; error?: string | null };

async function cleanTextWithOpenRouter(params: {
  apiKey: string;
  systemPrompt: string;
  userContent: string;
}): Promise<CleanTextResult> {
  const { apiKey, systemPrompt, userContent } = params;
  if (!userContent.trim()) {
    return { ok: true, text: "" };
  }

  try {
    const response = await fetch(OPENROUTE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENROUTE_MODEL,
        max_tokens: 2048,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        text: userContent,
        error: `status ${response.status}: ${raw}`,
      };
    }

    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const cleaned = data.choices?.[0]?.message?.content?.trim();
    if (!cleaned) {
      return { ok: false, text: userContent, error: "LLM returned empty content." };
    }

    return {
      ok: true,
      text: stripCodeFence(cleaned),
    };
  } catch (error) {
    return {
      ok: false,
      text: userContent,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:[\w-]+)?\s*([\s\S]*?)\s*```$/);
  if (fence) {
    return fence[1].trim();
  }
  return trimmed;
}
