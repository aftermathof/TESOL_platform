#!/usr/bin/env node

/**
 * TESOL quiz ingestion pipeline (OCR → LLM → Supabase):
 * 1. Call Baidu doc_analysis to extract full English text from the PDF.
 * 2. Reconstruct the text from the OCR response (paragraphs/layout/results).
 * 3. Send the entire reconstructed text to OpenRouter to obtain structured questions.
 * 4. Persist the extracted text (PDF parser preferred), structured quiz, and per-question LLM outputs to Supabase.
 *
 * Usage:
 *   cmd /c node_modules\.bin\tsx.cmd scripts\ingest-quiz-from-pdf.ts [pdfPath] [quizTitle] [sourceName]
 *
 * Requirements:
 *   - Node 18+
 *   - .env.local with:
 *       BAIDU_OCR_API_KEY
 *       BAIDU_OCR_API_SECRET
 *       SUPABASE_SERVICE_ROLE_KEY
 *       SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *       OPENROUTE_API_KEY
 *       (optional) OPENROUTE_MODEL, OPENROUTE_API_URL
 *   - Supabase tables:
 *       quiz_sources
 *       quiz_ocr_texts
 *       quiz_bank
 *       quiz_questions
 *       quiz_question_sources
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
let pdfjsInitialized = false;

type BaiduWord = {
  words?: string;
  words_location?: { top: number; left: number; width: number; height: number };
};

type BaiduParagraph = {
  para_location?: { top: number; left: number; width: number; height: number };
  para_words?: BaiduWord[];
};

type BaiduLayout = {
  layout_type?: string;
  layout_text?: string;
  layout_bbox?: { top: number; left: number; width: number; height: number };
  paragraph?: BaiduParagraph[];
};

type BaiduDocAnalysisResult = {
  paragraphs_result?: BaiduParagraph[];
  results?: Array<{ words?: { word?: string } }>;
  layout_data?: Array<{ layout_info?: BaiduLayout }>;
};

type LlmQuestionRaw = {
  id?: string;
  rawText?: string;
  type?: string;
  prompt?: string;
  options?: unknown;
  answer?: unknown;
  explanation?: unknown;
};

type LlmQuizRaw = {
  title?: string;
  durationMinutes?: number;
  questions?: LlmQuestionRaw[];
};

type NormalizedQuestion = {
  id: string;
  rawText: string;
  type: "single" | "multiple" | "blank" | "short";
  prompt: string;
  options: string[] | null;
  answer: string | string[] | null;
  explanation: string | null;
  llmOutput: LlmQuestionRaw;
};

const PDF_DEFAULT_PATH = "src/app/quiz/测试题目.pdf";
const DEFAULT_TITLE = "Imported TESOL Quiz";
const DEFAULT_SOURCE = "OCR Source";
const DEFAULT_DURATION = 90;

async function main() {
  loadEnvFile();

  const pdfPath = resolve(process.argv[2] ?? PDF_DEFAULT_PATH);
  const quizTitle = process.argv[3] ?? DEFAULT_TITLE;
  const sourceName =
    process.argv[4] ??
    `${DEFAULT_SOURCE} - ${basename(pdfPath)} - ${new Date().toISOString()}`;

  console.log(`[ingest] Reading PDF: ${pdfPath}`);
  const pdfBuffer = await readFile(pdfPath);
  const pdfBase64 = pdfBuffer.toString("base64");
  const token = await fetchBaiduToken();
  console.log("[ingest] Obtained Baidu OCR token");

  let ocrText = "";
  try {
    ocrText = await runDocAnalysis(token, pdfBase64);
  } catch (error) {
    console.warn("[ingest] OCR doc_analysis failed:", error);
  }
  const ocrTrimmed = ocrText.trim();
  if (ocrTrimmed.length > 0) {
    console.log("[ingest] OCR text reconstructed. Length:", ocrText.length);
  } else {
    console.warn("[ingest] OCR text is empty or whitespace.");
  }

  const parsedText = await extractPdfText(pdfBuffer);
  const parsedTrimmed = parsedText.trim();
  if (parsedTrimmed.length > 0) {
    console.log(
      "[ingest] PDF parser extracted text. Length:",
      parsedTrimmed.length
    );
  } else {
    console.warn("[ingest] PDF parser returned empty text.");
  }

  console.log(
    `[ingest] Text lengths - OCR: ${ocrTrimmed.length}, PDF parser: ${parsedTrimmed.length}`
  );

  const bestCandidate = [
    { source: "ocr", text: ocrTrimmed },
    { source: "pdf-parser", text: parsedTrimmed },
  ]
    .filter((candidate) => candidate.text.length > 0)
    .sort((a, b) => b.text.length - a.text.length)[0];

  if (!bestCandidate) {
    throw new Error(
      "No OCR or parsed text available. Check the PDF content and OCR configuration."
    );
  }

  const textSource = bestCandidate.source;
  const textForLlm = bestCandidate.text;
  const storedRawText =
    textSource === "pdf-parser" ? parsedTrimmed : ocrTrimmed;

  console.log(
    `[ingest] Using ${textSource} output for LLM (length ${textForLlm.length}).`
  );
  console.log(
    `[ingest] Persisting ${textSource} text (length ${storedRawText.length}) to quiz_ocr_texts.`
  );

  const llmQuiz = await runQuizStructuring(textForLlm);
  if (!llmQuiz.questions || llmQuiz.questions.length === 0) {
    throw new Error("LLM response contained no questions.");
  }
  console.log(`[ingest] LLM produced ${llmQuiz.questions.length} question(s).`);

  const supabase = createServiceClient();
  if (!supabase) {
    throw new Error("Supabase service client not available.");
  }

  const { data: sourceRow, error: sourceError } = await supabase
    .from("quiz_sources")
    .insert({
      name: sourceName,
      description: `OCR ingestion for ${quizTitle}`,
      source_file: pdfPath,
    })
    .select()
    .single();
  if (sourceError || !sourceRow) {
    throw new Error(
      `Failed to insert quiz_sources record: ${
        sourceError?.message ?? "unknown"
      }`
    );
  }

  const { data: textRow, error: textError } = await supabase
    .from("quiz_ocr_texts")
    .insert({
      source_id: sourceRow.id,
      raw_text: storedRawText,
    })
    .select()
    .single();
  if (textError || !textRow) {
    throw new Error(
      `Failed to insert OCR text record: ${textError?.message ?? "unknown"}`
    );
  }

  const titleFromLlm = llmQuiz.title?.trim() || quizTitle;
  const duration =
    typeof llmQuiz.durationMinutes === "number" && llmQuiz.durationMinutes > 0
      ? llmQuiz.durationMinutes
      : DEFAULT_DURATION;
  const ingestionMetadata = {
    text_source: textSource,
    ocr_length: ocrTrimmed.length,
    parser_length: parsedTrimmed.length,
    ocr_preview: ocrTrimmed ? ocrTrimmed.slice(0, 400) : null,
    parser_preview: parsedTrimmed ? parsedTrimmed.slice(0, 400) : null,
  };

  const { data: quizRow, error: quizError } = await supabase
    .from("quiz_bank")
    .insert({
      title: titleFromLlm,
      duration_minutes: duration,
      metadata: {
        source_id: sourceRow.id,
        ocr_text_id: textRow.id,
        ingestion: ingestionMetadata,
      },
    })
    .select()
    .single();
  if (quizError || !quizRow) {
    throw new Error(
      `Failed to insert quiz record: ${quizError?.message ?? "unknown"}`
    );
  }

  let count = 0;
  for (const [index, llmQuestion] of (llmQuiz.questions ?? []).entries()) {
    const normalized = normalizeQuestion(llmQuestion, index + 1);

    const { data: questionRow, error: questionError } = await supabase
      .from("quiz_questions")
      .insert({
        quiz_id: quizRow.id,
        question_type: normalized.type,
        prompt: normalized.prompt,
        options: normalized.options,
        answer: normalized.answer,
        explanation: normalized.explanation,
      })
      .select()
      .single();
    if (questionError || !questionRow) {
      throw new Error(
        `Failed to insert quiz question ${normalized.id}: ${
          questionError?.message ?? "unknown"
        }`
      );
    }

    const { error: sourceInsertError } = await supabase
      .from("quiz_question_sources")
      .insert({
        question_id: questionRow.id,
        ocr_text_id: textRow.id,
        question_index: index + 1,
        raw_text: normalized.rawText,
        llm_output: normalized.llmOutput,
      });
    if (sourceInsertError) {
      throw new Error(
        `Failed to insert quiz_question_sources for ${normalized.id}: ${sourceInsertError.message}`
      );
    }

    count += 1;
  }

  console.log(
    `[ingest] Stored quiz ${quizRow.id} with ${count} question(s).`
  );
  console.log("[ingest] Done.");
}

async function fetchBaiduToken(): Promise<string> {
  const apiKey = process.env.BAIDU_OCR_API_KEY;
  const apiSecret = process.env.BAIDU_OCR_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("Missing BAIDU_OCR_API_KEY or BAIDU_OCR_API_SECRET.");
  }
  const tokenUrl = new URL("https://aip.baidubce.com/oauth/2.0/token");
  tokenUrl.searchParams.set("grant_type", "client_credentials");
  tokenUrl.searchParams.set("client_id", apiKey);
  tokenUrl.searchParams.set("client_secret", apiSecret);
  const response = await fetch(tokenUrl, { method: "POST" });
  if (!response.ok) {
    throw new Error(
      `Baidu token request failed: ${response.status} ${response.statusText}`
    );
  }
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Baidu token response missing access_token.");
  }
  return data.access_token;
}

async function runDocAnalysis(
  accessToken: string,
  pdfBase64: string
): Promise<string> {
  const maxPages = 200;
  const pageSize = 1;
  const segments: string[] = [];
  const seenFingerprints = new Set<string>();

  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
    const pageData = await fetchDocAnalysisPage(
      accessToken,
      pdfBase64,
      pageIndex,
      pageSize
    );
    const pageText = reconstructText(pageData);
    const trimmed = pageText.trim();
    const hasContent = trimmed.length > 0;
    if (!hasContent) {
      if (pageIndex === 1) {
        // First page empty -> break immediately
        break;
      }
      // Assume no more pages
      break;
    }
    const fingerprint = fingerprintText(trimmed);
    if (fingerprint && seenFingerprints.has(fingerprint)) {
      console.warn(
        `[ingest] Duplicate OCR page detected at index ${pageIndex}, stopping pagination.`
      );
      break;
    }
    if (fingerprint) {
      seenFingerprints.add(fingerprint);
    }
    segments.push(trimmed);
    const totalPages = detectTotalPages(pageData);
    if (totalPages && pageIndex >= totalPages) {
      break;
    }
    if (!hasMorePages(pageData, pageIndex, pageSize)) {
      break;
    }
  }

  return segments.join("\n\n");
}

function detectTotalPages(data: BaiduDocAnalysisResult): number | null {
  const any = data as any;
  if (typeof any?.pdf_num === "number" && any.pdf_num > 0) {
    return any.pdf_num;
  }
  if (typeof any?.page_num === "number" && any.page_num > 0) {
    return any.page_num;
  }
  return null;
}

function hasMorePages(
  data: BaiduDocAnalysisResult,
  currentPage: number,
  pageSize: number
): boolean {
  const totalPages = detectTotalPages(data);
  if (totalPages) {
    return currentPage * pageSize < totalPages;
  }
  const resultsCount =
    (data as any)?.results_num ??
    (Array.isArray(data.results) ? data.results.length : 0);
  return resultsCount > 0;
}

async function fetchDocAnalysisPage(
  accessToken: string,
  pdfBase64: string,
  pageIndex: number,
  pageSize: number
): Promise<BaiduDocAnalysisResult> {
  const url = new URL(
    "https://aip.baidubce.com/rest/2.0/ocr/v1/doc_analysis"
  );
  url.searchParams.set("access_token", accessToken);
  const body = new URLSearchParams({
    pdf_file: pdfBase64,
    language_type: "ENG",
    type: "json",
    detect_direction: "true",
    paragraph: "true",
    page_index: Math.max(pageIndex - 1, 0).toString(),
    page_size: pageSize.toString(),
  });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `doc_analysis failed: ${response.status} ${response.statusText} ${text}`
    );
  }
  return response.json() as Promise<BaiduDocAnalysisResult>;
}

function reconstructText(data: BaiduDocAnalysisResult): string {
  const segments: string[] = [];

  if (Array.isArray(data.paragraphs_result) && data.paragraphs_result.length) {
    for (const para of data.paragraphs_result) {
      const text =
        para.para_words
          ?.map((word) => word.words?.trim() ?? "")
          .filter(Boolean)
          .join(" ") ?? "";
      if (text) {
        segments.push(text);
      }
    }
  }

  if (
    segments.length === 0 &&
    Array.isArray(data.layout_data) &&
    data.layout_data.length
  ) {
    for (const entry of data.layout_data) {
      const layout = entry.layout_info;
      if (!layout) continue;
      if (layout.layout_type === "text" && layout.layout_text) {
        segments.push(layout.layout_text.trim());
      } else if (layout.paragraph) {
        const paragraphs = layout.paragraph
          .map((para) => {
            const text =
              para.para_words
                ?.map((word) => word.words?.trim() ?? "")
                .filter(Boolean)
                .join(" ") ?? "";
            return text;
          })
          .filter(Boolean);
        if (paragraphs.length) {
          segments.push(paragraphs.join("\n"));
        }
      }
    }
  }

  if (
    segments.length === 0 &&
    Array.isArray(data.results) &&
    data.results.length
  ) {
    for (const item of data.results) {
      const text = item.words?.word?.trim();
      if (text) {
        segments.push(text);
      }
    }
  }

  return segments.join("\n");
}

async function runQuizStructuring(text: string): Promise<LlmQuizRaw> {
  const chunks = splitTextIntoChunks(text, 3500);
  console.log(
    `[ingest] Splitting text into ${chunks.length} chunk(s) for LLM processing.`
  );

  const aggregated: LlmQuestionRaw[] = [];
  let detectedTitle: string | undefined;
  let detectedDuration: number | undefined;

  const apiKey = process.env.OPENROUTE_API_KEY;
  const endpoint =
    process.env.OPENROUTE_API_URL ??
    "https://openrouter.ai/api/v1/chat/completions";
  const model = process.env.OPENROUTE_MODEL ?? "google/gemini-2.5-flash";
  if (!apiKey) {
    throw new Error("OPENROUTE_API_KEY is not configured.");
  }

  let chunkIndex = 1;
  for (const chunk of chunks) {
    const systemPrompt = `You convert OCR'd TESOL exam text into structured JSON.
Rules:
- Return JSON only.
- Include every question that appears in this chunk.
- Preserve the original wording.
- For each question, include rawText (verbatim).
- Provide options/answers exactly as they appear. Do NOT invent.
- If no explicit answer is stated, omit or set null.
- durationMinutes should be 90 unless the text clearly states otherwise.`;

    const userPrompt = `Chunk ${chunkIndex}/${chunks.length} of OCR exam text:
---
${chunk}
---

Return JSON with shape:
{
  "title": string,
  "durationMinutes": number,
  "questions": [
    {
      "id": string,
      "rawText": string,
      "type": "single" | "multiple" | "blank" | "short",
      "prompt": string,
      "options"?: string[],
      "answer"?: string | string[],
      "explanation"?: string
    }
  ]
}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://51talk.com",
        "X-Title": "TESOL Quiz Parser",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const textBody = await response.text();
      throw new Error(
        `LLM formatting failed on chunk ${chunkIndex}: ${response.status} ${response.statusText} ${textBody}`
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`LLM returned empty content for chunk ${chunkIndex}.`);
    }

    try {
      const parsed = JSON.parse(content) as LlmQuizRaw;
      if (parsed.questions && parsed.questions.length > 0) {
        aggregated.push(...parsed.questions);
      }
      if (!detectedTitle && parsed.title) {
        detectedTitle = parsed.title;
      }
      if (
        typeof parsed.durationMinutes === "number" &&
        parsed.durationMinutes > 0
      ) {
        detectedDuration = parsed.durationMinutes;
      }
    } catch (error) {
      throw new Error(
        `Failed to parse LLM JSON for chunk ${chunkIndex}: ${error}`
      );
    }

    chunkIndex += 1;
  }

  return {
    title: detectedTitle ?? undefined,
    durationMinutes: detectedDuration ?? undefined,
    questions: aggregated,
  };
}

function normalizeQuestion(
  llmQuestion: LlmQuestionRaw,
  questionIndex: number
): NormalizedQuestion {
  const indexId = questionIndex.toString().padStart(3, "0");
  const id =
    (typeof llmQuestion.id === "string" && llmQuestion.id.trim()) ||
    `Q${indexId}`;

  const rawText =
    typeof llmQuestion.rawText === "string"
      ? llmQuestion.rawText.trim()
      : typeof llmQuestion.prompt === "string"
      ? llmQuestion.prompt.trim()
      : "";

  const prompt =
    typeof llmQuestion.prompt === "string" && llmQuestion.prompt.trim()
      ? llmQuestion.prompt.trim()
      : rawText || `Question ${questionIndex}`;

  const type =
    typeof llmQuestion.type === "string"
      ? llmQuestion.type.toLowerCase().trim()
      : "short";
  const validTypes = new Set(["single", "multiple", "blank", "short"]);
  const normalizedType = validTypes.has(type) ? (type as any) : "short";

  let options: string[] | null = null;
  if (normalizedType === "single" || normalizedType === "multiple") {
    const rawOptions = Array.isArray(llmQuestion.options)
      ? llmQuestion.options
      : typeof llmQuestion.options === "string"
      ? llmQuestion.options.split(/\n+/)
      : [];
    const cleaned = rawOptions
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    options = cleaned.length > 0 ? cleaned : null;
  }

  let answer: string | string[] | null = null;
  if (llmQuestion.answer != null) {
    if (Array.isArray(llmQuestion.answer)) {
      const arr = llmQuestion.answer
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
      answer =
        normalizedType === "multiple"
          ? arr
          : arr.length > 0
          ? arr[0]
          : null;
    } else if (typeof llmQuestion.answer === "string") {
      const trimmed = llmQuestion.answer.trim();
      if (trimmed) {
        answer = normalizedType === "multiple" ? [trimmed] : trimmed;
      }
    }
  }

  const explanation =
    typeof llmQuestion.explanation === "string"
      ? llmQuestion.explanation.trim() || null
      : null;

  return {
    id,
    rawText,
    type: normalizedType,
    prompt,
    options,
    answer,
    explanation,
    llmOutput: llmQuestion,
  };
}

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfjsModule: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const getDocument =
      pdfjsModule?.getDocument ?? pdfjsModule?.default?.getDocument;
    const GlobalWorkerOptions =
      pdfjsModule?.GlobalWorkerOptions ??
      pdfjsModule?.default?.GlobalWorkerOptions;

    if (typeof getDocument !== "function") {
      console.warn("[ingest] pdfjs-dist did not provide getDocument.");
      return "";
    }

    if (!pdfjsInitialized && GlobalWorkerOptions) {
      try {
        const workerPath = require.resolve(
          "pdfjs-dist/legacy/build/pdf.worker.mjs"
        );
        GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
      } catch (error) {
        console.warn("[ingest] Unable to configure pdfjs worker:", error);
      }
      pdfjsInitialized = true;
    }

    const typedArray = Uint8Array.from(pdfBuffer);
    const pdfjsPackagePath = require.resolve("pdfjs-dist/package.json");
    const standardFontDir = pathToFileURL(
      join(dirname(pdfjsPackagePath), "standard_fonts")
    ).href;
    const standardFontDataUrl = standardFontDir.endsWith("/")
      ? standardFontDir
      : `${standardFontDir}/`;
    const loadingTask = getDocument({
      data: typedArray,
      standardFontDataUrl,
    });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lineBuffer: string[] = [];
      const pageLines: string[] = [];

      for (const item of textContent.items as any[]) {
        if (!item || typeof item.str !== "string") continue;
        const normalized = item.str.replace(/\s+/g, " ").trim();
        if (!normalized) continue;
        lineBuffer.push(normalized);
        if (item.hasEOL) {
          pageLines.push(lineBuffer.join(" "));
          lineBuffer.length = 0;
        }
      }

      if (lineBuffer.length) {
        pageLines.push(lineBuffer.join(" "));
      }

      if (pageLines.length) {
        pages.push(pageLines.join("\n"));
      }

      page.cleanup?.();
    }

    await pdf.destroy?.();

    if (pages.length === 0) {
      return "";
    }

    return normalizeExtractedPdfText(pages.join("\n\n"));
  } catch (error) {
    console.warn("[ingest] pdf text extraction failed:", error);
  }
  return "";
}

function normalizeExtractedPdfText(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s{2,}/g, " ").trim());
  const cleaned: string[] = [];
  let lastWasBlank = true;
  for (const line of lines) {
    if (!line) {
      if (!lastWasBlank) {
        cleaned.push("");
      }
      lastWasBlank = true;
      continue;
    }
    cleaned.push(line);
    lastWasBlank = false;
  }
  return cleaned.join("\n").trim();
}

function fingerprintText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 400);
}

function splitTextIntoChunks(text: string, maxChars: number): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;

  const questionStartPattern = /^(?:questions?\s+\d+(?:\s*[-–—]\s*\d+)?|question\s+\d+|\d{1,3}[\.\):])/i;

  for (const line of lines) {
    const trimmed = line.trim();
    const isQuestionStart = questionStartPattern.test(trimmed);
    const newLength = length + trimmed.length + 1;

    if (
      current.length > 0 &&
      newLength > maxChars &&
      (isQuestionStart || length > maxChars * 0.8)
    ) {
      chunks.push(current.join("\n"));
      current = [];
      length = 0;
    }

    current.push(trimmed);
    length += trimmed.length + 1;
  }

  if (current.length > 0) {
    chunks.push(current.join("\n"));
  }

  return chunks;
}

function createServiceClient() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.warn("[ingest] Supabase credentials missing.");
    return null;
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function loadEnvFile() {
  const envPath = resolve(".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error("[ingest] Failed:", error);
  process.exitCode = 1;
});
