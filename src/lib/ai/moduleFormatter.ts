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
};

type FormatterResponse = {
  modules?: Array<{
    title?: string;
    summary?: string | null;
    sections?: Array<{
      title?: string;
      summary?: string | null;
      content?: string;
    }>;
  }>;
};

const OPENROUTE_ENDPOINT =
  process.env.OPENROUTE_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTE_MODEL =
  process.env.OPENROUTE_MODEL ?? "gemini-2.0-flash";

const FORMAT_PROMPT = process.env.OPENROUTE_FORMAT_PROMPT?.trim() ?? "";

export async function formatModulesWithOpenRouter(
  modules: DraftModule[],
  options: FormatterOptions
): Promise<FormatModulesResult> {
  if (!FORMAT_PROMPT) {
    console.warn(
      "[moduleFormatter] OPENROUTE_FORMAT_PROMPT missing, skipping formatter."
    );
    return { modules, usedFormatter: false };
  }

  const apiKey = process.env.OPENROUTE_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[moduleFormatter] OPENROUTE_API_KEY is missing, skipping formatting.");
    return { modules, usedFormatter: false };
  }

  try {
    const payload = {
      model: OPENROUTE_MODEL,
      temperature: 0,
      max_tokens: 2800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: FORMAT_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify({
            sourceKey: options.sourceKey,
            baseTitle: options.baseTitle ?? null,
            modules,
            originalText: options.originalText ?? null,
          }),
        },
      ],
    };

    const response = await fetch(OPENROUTE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter responded with status ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter returned empty content");
    }

    const parsed = JSON.parse(content) as FormatterResponse;
    if (!parsed.modules || !Array.isArray(parsed.modules)) {
      throw new Error("Formatted response missing modules array.");
    }

    const formatted: DraftModule[] = [];

    for (let index = 0; index < modules.length; index += 1) {
      const original = modules[index];
      const candidate = parsed.modules[index];

      if (!candidate) {
        formatted.push(original);
        continue;
      }

      const formattedSections =
        candidate.sections?.map((section, sectionIndex) => ({
          title: section.title?.trim() || original.sections[sectionIndex]?.title || original.title,
          summary:
            section.summary?.trim() ??
            original.sections[sectionIndex]?.summary ??
            original.summary ??
            null,
          content:
            section.content?.trim().length
              ? section.content.trim()
              : original.sections[sectionIndex]?.content ?? original.summary ?? "",
        })) ?? original.sections;

      formatted.push({
        title: candidate.title?.trim() || original.title,
        summary:
          candidate.summary?.trim() ??
          (formattedSections[0]?.summary ?? original.summary ?? null),
        sections: formattedSections,
      });
    }

    return {
      modules: formatted,
      usedFormatter: true,
      formatterModel: OPENROUTE_MODEL,
    };
  } catch (error) {
    console.warn("[moduleFormatter] formatting failed, using original content:", error);
    return { modules, usedFormatter: false, formatterModel: OPENROUTE_MODEL };
  }
}
