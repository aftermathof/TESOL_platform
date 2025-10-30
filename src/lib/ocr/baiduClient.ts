import { extname } from "path";
import { PDFDocument } from "pdf-lib";

type TokenCache = {
  token: string;
  expiresAt: number;
  keySignature: string;
};

let cachedToken: TokenCache | null = null;

export type OcrResult = {
  text: string;
  confidence: number;
  pages: number[];
};

type BaiduWordLike = {
  words?: unknown;
  text?: unknown;
  confidence?: number;
  probability?: number;
  page_num?: number;
};

function normaliseText(input: unknown): string {
  if (input === null || input === undefined) {
    return "";
  }
  const raw = typeof input === "string" ? input : String(input);
  return raw
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ \u00A0]+/g, " ")
    .trim();
}

function isPdf(contentType: string | null, url: string): boolean {
  if (contentType && contentType.toLowerCase().includes("pdf")) {
    return true;
  }
  const pathname = new URL(url).pathname;
  return extname(pathname).toLowerCase() === ".pdf";
}

function extractWordSegments(collection: unknown): BaiduWordLike[] {
  if (!Array.isArray(collection)) return [];
  return collection
    .map((item) => (item && typeof item === "object" ? (item as BaiduWordLike) : null))
    .filter((item): item is BaiduWordLike => Boolean(item));
}

function aggregateConfidence(items: BaiduWordLike[]): number {
  const values: number[] = [];
  for (const item of items) {
    const candidate =
      typeof item.confidence === "number"
        ? item.confidence
        : typeof item.probability === "number"
        ? item.probability
        : null;
    if (candidate != null && Number.isFinite(candidate)) {
      values.push(candidate);
    }
  }
  if (values.length === 0) {
    return 1;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.min(1, Math.max(0, mean));
}

function aggregatePages(items: BaiduWordLike[], fallbackPages: number[]): number[] {
  const pages = new Set<number>();
  for (const item of items) {
    if (typeof item.page_num === "number" && Number.isFinite(item.page_num)) {
      pages.add(item.page_num);
    }
  }
  if (pages.size > 0) {
    return Array.from(pages).sort((a, b) => a - b);
  }
  return fallbackPages;
}

function extractTextCandidates(value: unknown): string[] {
  const candidates: string[] = [];

  const push = (input: unknown) => {
    const text = normaliseText(input);
    if (text.length > 0) {
      candidates.push(text);
    }
  };

  const visit = (input: unknown) => {
    if (input === null || input === undefined) {
      return;
    }
    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
      push(input);
      return;
    }
    if (Array.isArray(input)) {
      for (const item of input) {
        visit(item);
      }
      return;
    }
    if (typeof input === "object") {
      const obj = input as Record<string, unknown>;
      if ("word" in obj) {
        visit(obj.word);
      }
      if ("text" in obj) {
        visit(obj.text);
      }
      if ("words" in obj) {
        visit(obj.words);
      }
    }
  };

  visit(value);

  return candidates;
}

function buildTextFromSegments(segments: BaiduWordLike[]): string {
  const lines: string[] = [];

  for (const segment of segments) {
    const candidates = [
      ...extractTextCandidates(segment.words),
      ...extractTextCandidates(segment.text),
    ];

    const content = candidates.join(" ").trim();
    if (content.length > 0) {
      lines.push(content);
    }
  }

  return lines.join("\n");
}

export async function fetchBaiduAccessToken(): Promise<string | null> {
  const apiKey = process.env.BAIDU_OCR_API_KEY ?? "";
  const apiSecret = process.env.BAIDU_OCR_API_SECRET ?? "";

  if (!apiKey || !apiSecret) {
    return null;
  }

  const signature = `${apiKey}:${apiSecret}`;

  if (
    cachedToken &&
    cachedToken.expiresAt > Date.now() &&
    cachedToken.keySignature === signature
  ) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: apiKey,
    client_secret: apiSecret,
  });

  const response = await fetch(
    `https://aip.baidubce.com/oauth/2.0/token?${params.toString()}`,
    { method: "POST" }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    return null;
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 0) - 60) * 1000,
    keySignature: signature,
  };

  return cachedToken.token;
}

async function runGeneralImageOcr(base64: string, token: string): Promise<OcrResult> {
  const form = new URLSearchParams({
    image: base64,
    language_type: "CHN_ENG",
  });

  const response = await fetch(
    `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  if (!response.ok) {
    throw new Error(`Baidu OCR responded with status ${response.status}`);
  }

  const data = (await response.json()) as {
    words_result?: BaiduWordLike[];
  };

  const segments = extractWordSegments(data.words_result);
  const text = buildTextFromSegments(segments);

  return {
    text: text.length > 0 ? text : "No text recognised.",
    confidence: aggregateConfidence(segments),
    pages: [],
  };
}

async function runDocumentOcr(
  base64: string,
  token: string,
  fallbackPages: number[]
): Promise<OcrResult> {
  const form = new URLSearchParams({
    pdf_file: base64,
    language_type: "CHN_ENG",
    result_type: "standard",
  });

  const response = await fetch(
    `https://aip.baidubce.com/rest/2.0/ocr/v1/doc_analysis?access_token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  if (!response.ok) {
    // 账号可能尚未开通 doc_analysis，回退到通用文字识别
    return runGeneralImageOcr(base64, token);
  }

  const data = (await response.json()) as Record<string, unknown>;

  const segments: BaiduWordLike[] = [];
  segments.push(...extractWordSegments((data as never)["paragraphs_result"]));
  segments.push(...extractWordSegments((data as never)["paragraph_result"]));
  segments.push(...extractWordSegments((data as never)["words_result"]));

  const resultEntries = extractWordSegments((data as never)["results"]);
  if (resultEntries.length > 0) {
    segments.push(...resultEntries);
  }

  const textField = normaliseText((data as { text?: string }).text);
  const combinedText =
    segments.length > 0 ? buildTextFromSegments(segments) : textField;

  const pages = aggregatePages(segments, fallbackPages);

  return {
    text: combinedText.length > 0 ? combinedText : textField || "No text recognised.",
    confidence: aggregateConfidence(segments),
    pages,
  };
}

export async function requestBaiduOcr(payload: {
  fileUrl: string;
  pageRange?: [number, number];
}): Promise<OcrResult> {
  const token = await fetchBaiduAccessToken();
  if (!token) {
    throw new Error("Baidu OCR credentials are missing or invalid.");
  }

  const response = await fetch(payload.fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file for OCR (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");

  if (isPdf(response.headers.get("content-type"), payload.fileUrl)) {
    return processPdfDocument(buffer, token, payload.pageRange);
  }

  return runGeneralImageOcr(base64, token);
}

async function processPdfDocument(
  buffer: Buffer,
  token: string,
  pageRange?: [number, number]
): Promise<OcrResult> {
  const pdf = await PDFDocument.load(buffer);
  const totalPages = pdf.getPageCount();

  const startIndex =
    pageRange != null ? Math.max(0, Math.min(totalPages - 1, pageRange[0] - 1)) : 0;
  const endIndex =
    pageRange != null
      ? Math.max(startIndex, Math.min(totalPages - 1, pageRange[1] - 1))
      : totalPages - 1;

  const selectedIndices: number[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    selectedIndices.push(index);
  }

  if (selectedIndices.length === 0) {
    return {
      text: "",
      confidence: 0,
      pages: [],
    };
  }

  const results: OcrResult[] = [];

  for (const pageIndex of selectedIndices) {
    const chunkPdf = await PDFDocument.create();
    const [copiedPage] = await chunkPdf.copyPages(pdf, [pageIndex]);
    chunkPdf.addPage(copiedPage);
    const chunkBytes = await chunkPdf.save();
    const chunkBase64 = Buffer.from(chunkBytes).toString("base64");
    const pageNumber = pageIndex + 1;
    const chunkResult = await runDocumentOcr(chunkBase64, token, [pageNumber]);
    results.push(chunkResult);
  }

  return mergeOcrResults(results);
}

function mergeOcrResults(chunks: OcrResult[]): OcrResult {
  if (chunks.length === 0) {
    return {
      text: "",
      confidence: 0,
      pages: [],
    };
  }

  const combinedText = chunks
    .map((chunk) => chunk.text.trim())
    .filter((text) => text.length > 0)
    .join("\n\n");

  const weighted = chunks.reduce(
    (acc, chunk) => {
      const length = chunk.text.length || 1;
      return {
        weight: acc.weight + length,
        confidence: acc.confidence + chunk.confidence * length,
      };
    },
    { weight: 0, confidence: 0 }
  );

  const confidence =
    weighted.weight > 0 ? Math.min(1, Math.max(0, weighted.confidence / weighted.weight)) : 0;

  const pages = Array.from(
    new Set(
      chunks
        .flatMap((chunk) => chunk.pages)
        .filter((page) => typeof page === "number" && !Number.isNaN(page))
    )
  ).sort((a, b) => a - b);

  return {
    text: combinedText,
    confidence,
    pages,
  };
}
