#!/usr/bin/env node

/**
 * Dump the raw JSON returned by Baidu doc_analysis for debugging.
 * Usage:
 *   cmd /c node_modules\.bin\tsx.cmd scripts\dump-ocr-raw.ts [pdfPath]
 * Output:
 *   Writes the JSON to ocr-raw.json in the project root.
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

const PDF_DEFAULT_PATH = "src/app/quiz/测试题目.pdf";

async function main() {
  loadEnvFile();
  const pdfPath = resolve(process.argv[2] ?? PDF_DEFAULT_PATH);
  console.log(`[dump-ocr-raw] Reading PDF: ${pdfPath}`);
  const pdfBase64 = (await readFile(pdfPath)).toString("base64");

  const token = await getBaiduAccessToken();
  console.log("[dump-ocr-raw] Obtained Baidu OCR token");

  const pages = await collectDocAnalysisPages(token, pdfBase64);
  const outputPath = resolve("ocr-raw.json");
  writeFileSync(outputPath, JSON.stringify({ pages }, null, 2), "utf-8");
  console.log(
    `[dump-ocr-raw] Saved raw OCR JSON (${pages.length} page(s)) to ${outputPath}`
  );
}

async function getBaiduAccessToken(): Promise<string> {
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

async function collectDocAnalysisPages(token: string, pdfBase64: string) {
  const pages: any[] = [];
  const maxPages = 200;
  const pageSize = 1;

  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
    const pageJson = await callDocAnalysis(token, pdfBase64, pageIndex, pageSize);
    const hasContent =
      (Array.isArray(pageJson.paragraphs_result) &&
        pageJson.paragraphs_result.length > 0) ||
      (Array.isArray(pageJson.layout_data) &&
        pageJson.layout_data.length > 0) ||
      (Array.isArray(pageJson.results) &&
        pageJson.results.length > 0);

    if (!hasContent) {
      if (pageIndex === 1) {
        console.warn("[dump-ocr-raw] No content detected on first page.");
      }
      break;
    }

    pages.push(pageJson);

    const totalPages = detectTotalPages(pageJson);
    if (totalPages && pageIndex >= totalPages) {
      break;
    }

    const hasResults =
      typeof (pageJson as any)?.results_num === "number"
        ? (pageJson as any).results_num > 0
        : true;
    if (!hasResults) {
      break;
    }
  }

  return pages;
}

async function callDocAnalysis(
  token: string,
  pdfBase64: string,
  pageIndex: number,
  pageSize: number
) {
  const url = new URL(
    "https://aip.baidubce.com/rest/2.0/ocr/v1/doc_analysis"
  );
  url.searchParams.set("access_token", token);
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
  return response.json();
}

function detectTotalPages(data: any): number | null {
  if (typeof data?.pdf_num === "number" && data.pdf_num > 0) {
    return data.pdf_num;
  }
  if (typeof data?.page_num === "number" && data.page_num > 0) {
    return data.page_num;
  }
  return null;
}

function loadEnvFile() {
  const envPath = resolve(".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;
    const key = trimmed.slice(0, equals).trim();
    const value = trimmed.slice(equals + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error("[dump-ocr-raw] Failed:", error);
  process.exitCode = 1;
});
