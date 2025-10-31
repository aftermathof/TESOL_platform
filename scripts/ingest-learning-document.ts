#!/usr/bin/env tsx

import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { createHash } from "node:crypto";
import { ingestLearningDocument } from "@/lib/learningIngestor";
import { getSupabaseServiceClient } from "@/lib/supabaseServerClient";

type CliOptions = {
  file: string;
  moduleId: string;
  title: string;
  pageStart?: number;
  pageEnd?: number;
};

loadEnvConfig(process.cwd());

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (value && !value.startsWith("--")) {
      args.set(key, value);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }

  const file = args.get("file") ?? args.get("f");
  const moduleId = args.get("module") ?? args.get("m");
  const title = args.get("title") ?? args.get("t");

  if (!file || !moduleId || !title) {
    throw new Error(
      "Usage: npm run ingest-learning -- --file <path-to-pdf> --module <module-id> --title <module-title> [--pageStart 1 --pageEnd 3]"
    );
  }

  const pageStart = args.get("pageStart") ?? args.get("s");
  const pageEnd = args.get("pageEnd") ?? args.get("e");

  return {
    file,
    moduleId,
    title,
    pageStart: pageStart ? Number(pageStart) : undefined,
    pageEnd: pageEnd ? Number(pageEnd) : undefined,
  };
}

function resolveMimeType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

function normaliseStoragePath(moduleId: string, filePath: string) {
  const safeModuleId = moduleId.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const fileExtension = extname(filePath).toLowerCase() || ".bin";
  return `learning/${safeModuleId || "document"}${fileExtension}`;
}

async function uploadToSupabase(
  buffer: Buffer,
  mimeType: string,
  storagePath: string
): Promise<string> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("未配置 SUPABASE_SERVICE_ROLE_KEY，无法上传文件。");
  }

  const bucket = "learning-documents";

  await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 20 * 1024 * 1024,
  }).catch((error) => {
    if (error?.message?.includes("already exists")) {
      return;
    }
    throw error;
  });

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  if (!data?.publicUrl) {
    throw new Error("无法获取上传文件的公有访问地址。");
  }
  return data.publicUrl;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fileBuffer = await readFile(options.file);
  const mimeType = resolveMimeType(options.file);
  const storagePath = normaliseStoragePath(options.moduleId, options.file);
  const fileUrl = await uploadToSupabase(fileBuffer, mimeType, storagePath);

  const pageRange =
    typeof options.pageStart === "number" && typeof options.pageEnd === "number"
      ? ([options.pageStart, options.pageEnd] as [number, number])
      : undefined;

  const checksum = createHash("sha1").update(fileBuffer).digest("hex");

  console.log("📄 文件:", basename(options.file));
  console.log("🔗 Supabase URL:", fileUrl);
  console.log("🔑 Module ID:", options.moduleId);
  console.log("📝 Base title:", options.title);
  console.log("🔁 校验和:", checksum);

  const result = await ingestLearningDocument({
    moduleId: options.moduleId,
    baseTitle: options.title,
    fileUrl,
    pageRange,
  });

  console.log("");
  console.log("✅ 已写入学习模块:");
  for (const moduleEntry of result.modules) {
    console.log(
      `  - ${moduleEntry.title} (${moduleEntry.sectionCount} sections, id=${moduleEntry.id})`
    );
  }
  console.log("");
  console.log(
    `🧠 OCR 置信度: ${(result.ocrConfidence * 100).toFixed(1)}% | Fallback: ${
      result.usedFallback ? "是" : "否"
    }`
  );
  if (result.pages.length > 0) {
    console.log(`📑 涉及页码: ${result.pages.join(", ")}`);
  }
  console.log(
    `📚 共生成 ${result.modules.length} 个模块，${result.totalSections} 个章节。`
  );
}

main().catch((error) => {
  console.error("❌ Ingestion failed:", error);
  process.exitCode = 1;
});
