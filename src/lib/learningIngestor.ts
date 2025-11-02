import { requestBaiduOcr } from "@/lib/ocr/baiduClient";
import { formatModulesWithOpenRouter } from "@/lib/ai/moduleFormatter";
import { getSupabaseServiceClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";

export type IngestLearningDocumentOptions = {
  moduleId: string;
  baseTitle: string;
  fileUrl: string;
  pageRange?: [number, number];
};

export type IngestLearningDocumentResult = {
  sourceKey: string;
  modules: Array<{ id: string; title: string; sectionCount: number }>;
  totalSections: number;
  ocrConfidence: number;
  pages: number[];
  usedFallback: boolean;
};

function buildCacheKey(fileUrl: string, pageRange?: [number, number]) {
  return `${fileUrl}::${pageRange ? pageRange.join("-") : "all"}`;
}

export async function ingestLearningDocument(
  options: IngestLearningDocumentOptions
): Promise<IngestLearningDocumentResult> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error(
      "Supabase service role 未配置，无法执行写操作。请在 .env.local 中设置 SUPABASE_SERVICE_ROLE_KEY。"
    );
  }

  const cacheKey = buildCacheKey(options.fileUrl, options.pageRange);

  const { data: cached } = await supabase
    .from("learning_ocr_cache")
    .select("text, confidence, pages")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  let ocrResult =
    cached != null
      ? {
          text: String(cached.text ?? ""),
          confidence: Number(cached.confidence ?? 1),
          pages: Array.isArray(cached.pages) ? (cached.pages as number[]) : [],
        }
      : null;

  if (ocrResult) {
    const trimmed = ocrResult.text.trim();
    const markerOnly = /^(\s*--\s*\d+\s+of\s+\d+\s*--\s*)+$/i.test(trimmed);
    if (
      trimmed.length < 24 ||
      markerOnly ||
      /\bNo text recognised\.?/i.test(trimmed)
    ) {
      ocrResult = null;
    }
  }

  if (!ocrResult) {
    ocrResult = await requestBaiduOcr({
      fileUrl: options.fileUrl,
      pageRange: options.pageRange,
    });

    const { error: cacheError } = await supabase
      .from("learning_ocr_cache")
      .upsert(
        {
          cache_key: cacheKey,
          module_id: options.moduleId,
          file_url: options.fileUrl,
          page_start: options.pageRange ? options.pageRange[0] : null,
          page_end: options.pageRange ? options.pageRange[1] : null,
          text: ocrResult.text,
          confidence: ocrResult.confidence,
          pages: ocrResult.pages,
        },
        { onConflict: "cache_key" }
      );

    if (cacheError) {
      console.warn("[learningIngestor] failed to cache OCR result:", cacheError);
    }
  }

  const ocrModules = buildModulesFromOcrText(ocrResult.text, options.baseTitle);
  const rawModules = ocrModules.modules;
  if (rawModules.length === 0) {
    throw new Error("未能生成有效的学习模块，请检查 OCR 识别结果后重试。");
  }

  const reuseResult = await tryReuseFormattedModules(
    supabase,
    options.moduleId,
    ocrResult.text
  );

  let modules: DraftModule[];
  let formatterUsed: boolean;
  let formatterModel: string | null;
  let formatterError: string | null;

  if (reuseResult) {
    modules = reuseResult.modules;
    formatterUsed = reuseResult.usedFormatter;
    formatterModel = reuseResult.formatterModel ?? null;
    formatterError = reuseResult.error ?? null;
  } else {
    const formatterResult = await formatModulesWithOpenRouter(rawModules, {
      sourceKey: options.moduleId,
      baseTitle: options.baseTitle,
      originalText: ocrResult.text,
    });
    modules = cleanupFormattedModules(formatterResult.modules);
    formatterUsed = formatterResult.usedFormatter;
    formatterModel = formatterResult.formatterModel ?? null;
    formatterError = formatterResult.error ?? null;
  }

  const formattedDocument = serializeModules(modules);

  const { error: documentError } = await supabase
    .from("learning_documents")
    .upsert(
      {
        source_key: options.moduleId,
        raw_text: ocrResult.text,
        formatted_text: formattedDocument,
        formatted_modules: serializeModulesForStorage(modules),
        formatter_model: formatterModel,
        formatter_used: formatterUsed,
        formatter_error: formatterError ?? null,
      },
      { onConflict: "source_key" }
    );
  if (documentError) {
    throw documentError;
  }

  const { error: removeError } = await supabase
    .from("learning_modules")
    .delete()
    .eq("source_key", options.moduleId);

  if (removeError) {
    throw removeError;
  }

  const insertedModules: Array<{ id: string; title: string; sectionCount: number }> = [];
  let totalSections = 0;

  for (const [index, module] of modules.entries()) {
    const { data: moduleInsert, error: moduleInsertError } = await supabase
      .from("learning_modules")
      .insert({
        source_key: options.moduleId,
        title: module.title,
        order_index: index,
      })
      .select("id")
      .single();

    if (moduleInsertError || !moduleInsert) {
      throw moduleInsertError ?? new Error("无法写入学习模块记录。");
    }

    const sectionsPayload = module.sections.map((section, sectionIndex) => ({
      module_id: moduleInsert.id,
      title: section.title,
      order_index: sectionIndex,
      duration_minutes: null,
      content: section.content,
      summary: section.summary ?? null,
    }));

    if (sectionsPayload.length > 0) {
      const { error: sectionError } = await supabase
        .from("module_sections")
        .insert(sectionsPayload);
      if (sectionError) {
        throw sectionError;
      }
    }

    insertedModules.push({
      id: moduleInsert.id,
      title: module.title,
      sectionCount: sectionsPayload.length,
    });
    totalSections += sectionsPayload.length;
  }

  return {
    sourceKey: options.moduleId,
    modules: insertedModules,
    totalSections,
    ocrConfidence: ocrResult.confidence,
    pages: ocrResult.pages,
    usedFallback: ocrModules.usedFallback,
  };
}

export type DraftModule = {
  title: string;
  summary?: string | null;
  sections: Array<{
    title: string;
    content: string;
    summary?: string | null;
  }>;
};

export type ModulesFromOcr = {
  modules: DraftModule[];
  usedFallback: boolean;
};

export function buildModulesFromOcrText(
  text: string,
  baseTitle?: string
): ModulesFromOcr {
  const normalised = text.replace(/\r/g, "").trim();
  if (!normalised) {
    return { modules: [], usedFallback: true };
  }

  const headings = extractHeadingSegments(normalised);
  if (headings.length > 0) {
    const segmentMap = splitByHeadingSegments(normalised, headings);

    const structured = headings.map((heading, index) => {
      const content =
        segmentMap.get(heading.title) ??
        buildPlaceholderContent(heading.title, index + 1);
      const summary =
        content.split("\n").find((line) => line.trim().length > 0)?.trim() ?? null;

      return {
        title: heading.title,
        summary,
        sections: [
          {
            title: heading.title,
            content,
            summary,
          },
        ],
      };
    });

    return { modules: structured, usedFallback: false };
  }

  return {
    modules: buildFallbackModules(normalised, baseTitle),
    usedFallback: true,
  };
}

function serializeModules(modules: DraftModule[]): string {
  return modules
    .map((module, moduleIndex) => {
      const heading = `${moduleIndex + 1}. ${module.title}`;
      const summary = module.summary?.trim()
        ? `摘要：${module.summary.trim()}`
        : null;
      const sections = module.sections.map((section, sectionIndex) => {
        const sectionHeading =
          module.sections.length > 1
            ? `${moduleIndex + 1}.${sectionIndex + 1} ${section.title}`
            : section.title;
        const sectionParts = [
          sectionHeading,
          section.summary?.trim() ?? null,
          section.content,
        ].filter((part): part is string => Boolean(part && part.trim().length));

        return sectionParts.join("\n");
      });

      return [heading, summary, ...sections]
        .filter((part): part is string => Boolean(part && part.trim().length))
        .join("\n\n");
    })
    .join("\n\n");
}

async function tryReuseFormattedModules(
  supabase: SupabaseClient,
  sourceKey: string,
  rawText: string
): Promise<{
  modules: DraftModule[];
  usedFormatter: boolean;
  formatterModel?: string | null;
  error?: string | null;
} | null> {
  const { data, error } = await supabase
    .from("learning_documents")
    .select(
      "raw_text, formatted_modules, formatter_model, formatter_used, formatter_error"
    )
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (error) {
    console.warn("[learningIngestor] failed to load cached document:", error);
    return null;
  }

  if (!data || typeof data.raw_text !== "string") {
    return null;
  }

  if (data.raw_text !== rawText) {
    return null;
  }

  const restored = deserializeModulesFromStorage(data.formatted_modules);
  if (!restored) {
    return null;
  }

  return {
    modules: restored,
    usedFormatter: Boolean(data.formatter_used),
    formatterModel: data.formatter_model ?? null,
    error: data.formatter_error ?? null,
  };
}

function serializeModulesForStorage(modules: DraftModule[]) {
  return modules.map((module) => ({
    title: module.title,
    summary: module.summary ?? null,
    sections: module.sections.map((section) => ({
      title: section.title,
      summary: section.summary ?? null,
      content: section.content,
    })),
  }));
}

function deserializeModulesFromStorage(value: unknown): DraftModule[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  try {
    return value.map((module) => {
      const moduleTitle =
        typeof (module as { title?: unknown }).title === "string"
          ? ((module as { title: string }).title ?? "")
          : String((module as { title?: unknown }).title ?? "");

      const moduleSummary =
        typeof (module as { summary?: unknown }).summary === "string" ||
        (module as { summary?: unknown }).summary === null
          ? ((module as { summary: string | null }).summary ?? null)
          : null;

      const rawSections = Array.isArray((module as { sections?: unknown }).sections)
        ? ((module as { sections: unknown[] }).sections ?? [])
        : [];

      const sections = rawSections.map((section) => {
        const title =
          typeof (section as { title?: unknown }).title === "string"
            ? ((section as { title: string }).title ?? "")
            : String((section as { title?: unknown }).title ?? "");

        const summary =
          typeof (section as { summary?: unknown }).summary === "string" ||
          (section as { summary?: unknown }).summary === null
            ? ((section as { summary: string | null }).summary ?? null)
            : null;

        const content =
          typeof (section as { content?: unknown }).content === "string"
            ? ((section as { content: string }).content ?? "")
            : "";

        return {
          title,
          summary,
          content,
        };
      });

      return {
        title: moduleTitle,
        summary: moduleSummary,
        sections,
      };
    });
  } catch (error) {
    console.warn("[learningIngestor] failed to restore cached formatter modules:", error);
    return null;
  }
}

function cleanupFormattedModules(modules: DraftModule[]): DraftModule[] {
  return modules.map((module) => ({
    ...module,
    summary: cleanupFormattedText(module.summary),
    sections: module.sections.map((section) => ({
      ...section,
      summary: cleanupFormattedText(section.summary),
      content: cleanupFormattedContent(section.content),
    })),
  }));
}

function cleanupFormattedText(value?: string | null): string | null {
  if (!value) return value ?? null;
  const placeholder = "__DOUBLE_BREAK__";
  const normalised = value
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, placeholder)
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(new RegExp(placeholder, "g"), "\n\n")
    .trim();
  return normalised.length > 0 ? normalised : null;
}

function cleanupFormattedContent(value: string): string {
  return cleanupFormattedText(value) ?? "";
}

type HeadingSegment = {
  title: string;
  index: number;
};

function extractHeadingSegments(text: string): HeadingSegment[] {
  const headings: HeadingSegment[] = [];

  const contentsIndex = text.toLowerCase().indexOf("contents");
  const searchScope =
    contentsIndex >= 0
      ? text.slice(contentsIndex, contentsIndex + 2000)
      : text.slice(0, 2000);

  const headingPattern = /^(\d+)\s+([^\d][^\n]+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(searchScope))) {
    const rawTitle = match[2].trim();
    if (!rawTitle) continue;

    const escaped = escapeForRegex(rawTitle);
    const searchRegex = new RegExp(
      `(?:^|\\n)${escaped.replace(/\s+/g, "\\s+")}`,
      "i"
    );
    const index = text.search(searchRegex);
    headings.push({ title: rawTitle, index });
  }

  if (headings.length === 0) {
    return headings;
  }

  headings.sort((a, b) => {
    if (a.index === -1 && b.index === -1) return 0;
    if (a.index === -1) return 1;
    if (b.index === -1) return -1;
    return a.index - b.index;
  });

  return headings;
}

function splitByHeadingSegments(
  text: string,
  headings: HeadingSegment[]
): Map<string, string> {
  const segments = new Map<string, string>();

  const validHeadings = headings.filter((heading) => heading.index >= 0);
  if (validHeadings.length === 0) {
    return segments;
  }

  for (let i = 0; i < validHeadings.length; i += 1) {
    const current = validHeadings[i];
    const next = validHeadings[i + 1];
    const start = current.index;
    const end = next ? next.index : text.length;
    const chunk = text.slice(start, end).trim();
    if (!chunk) continue;

    const cleaned = removeContentsLines(stripHeading(chunk));
    if (!cleaned) continue;

    segments.set(current.title, cleaned);
  }

  return segments;
}

function stripHeading(chunk: string): string {
  const lines = chunk.split("\n");
  let removed = 0;

  while (lines.length > 0 && lines[0].trim().length > 0 && removed < 4) {
    lines.shift();
    removed += 1;
  }

  while (lines.length > 0 && lines[0].trim().length === 0) {
    lines.shift();
  }

  return lines.join("\n").trim();
}

function removeContentsLines(body: string): string {
  const lines = body.split("\n");
  const filtered: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (/^\d+\s+[^\d\s].*$/u.test(line)) {
      const nextLine = lines[index + 1]?.trim();
      if (nextLine && /^\d+$/.test(nextLine)) {
        index += 1;
      }
      continue;
    }

    filtered.push(lines[index]);
  }

  return filtered.join("\n").trim();
}

function buildFallbackModules(text: string, baseTitle?: string): DraftModule[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [];
  }

  const chunkSize = Math.max(4, Math.ceil(paragraphs.length / 6));
  const modules: DraftModule[] = [];

  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    const chunk = paragraphs.slice(i, i + chunkSize);
    const title =
      i === 0 && baseTitle ? baseTitle : `学习模块 ${modules.length + 1}`;
    const content = chunk.join("\n\n");
    const summary =
      content.split("\n").find((line) => line.trim().length > 0)?.trim() ?? null;

    modules.push({
      title,
      summary,
      sections: [
        {
          title,
          content,
          summary,
        },
      ],
    });
  }

  return modules;
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPlaceholderContent(title: string, order: number): string {
  return [
    `${title}`,
    "",
    "该章节的正文内容暂未在 OCR 结果中识别到，请手动补充或重新上传清晰版本。",
    `（章节顺序：第 ${order} 章）`,
  ].join("\n");
}
