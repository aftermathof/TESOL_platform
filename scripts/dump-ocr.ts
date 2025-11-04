#!/usr/bin/env tsx

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const PDF_DEFAULT_PATH = "src/app/quiz/测试题目.pdf";

async function main() {
  loadEnvFile();
  const pdfPath = resolve(process.argv[2] ?? PDF_DEFAULT_PATH);
  const pdfBase64 = (await readFile(pdfPath)).toString("base64");
  const token = await getBaiduAccessToken();
  const text = await runBaiduDocAnalysis(token, pdfBase64);
  const outputPath = resolve("ocr-output.txt");
  writeFileSync(outputPath, text, "utf-8");
  console.log(`[dump-ocr] OCR text saved to ${outputPath} (length: ${text.length})`);
}

async function getBaiduAccessToken(): Promise<string> {
  const apiKey = process.env.BAIDU_OCR_API_KEY;
  const apiSecret = process.env.BAIDU_OCR_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("Missing BAIDU_OCR_API_KEY or BAIDU_OCR_API_SECRET");
  }
  const tokenUrl = new URL("https://aip.baidubce.com/oauth/2.0/token");
  tokenUrl.searchParams.set("grant_type", "client_credentials");
  tokenUrl.searchParams.set("client_id", apiKey);
  tokenUrl.searchParams.set("client_secret", apiSecret);
  const response = await fetch(tokenUrl, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Baidu token error: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Baidu OCR response missing access_token");
  }
  return data.access_token;
}

async function runBaiduDocAnalysis(accessToken: string, pdfBase64: string) {
  const url = new URL("https://aip.baidubce.com/rest/2.0/ocr/v1/doc_analysis");
  url.searchParams.set("access_token", accessToken);
  const body = new URLSearchParams({
    pdf_file: pdfBase64,
    language_type: "ENG",
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
  const data = (await response.json()) as {
    results?: Array<{ words?: string }>;
    words_result?: Array<{ words?: string }>;
  };
  const words =
    data.results?.map((item) => item.words ?? "").filter(Boolean) ??
    data.words_result?.map((item) => item.words ?? "").filter(Boolean) ??
    [];
  return words.join("\n");
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
  console.error(error);
  process.exitCode = 1;
});
