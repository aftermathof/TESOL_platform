import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ingestLearningDocument,
  type IngestLearningDocumentResult,
} from "@/lib/learningIngestor";

const ingestSchema = z.object({
  moduleId: z.string().min(1),
  baseTitle: z.string().min(1),
  fileUrl: z.string().url(),
  pageStart: z.number().int().min(1).optional(),
  pageEnd: z.number().int().min(1).optional(),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const parseResult = ingestSchema.safeParse(payload);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid ingest payload", details: parseResult.error },
      { status: 400 }
    );
  }

  const data = parseResult.data;
  const pageRange =
    typeof data.pageStart === "number" && typeof data.pageEnd === "number"
      ? ([data.pageStart, data.pageEnd] as [number, number])
      : undefined;

  try {
    const result: IngestLearningDocumentResult = await ingestLearningDocument({
      moduleId: data.moduleId,
      baseTitle: data.baseTitle,
      fileUrl: data.fileUrl,
      pageRange,
    });

    return NextResponse.json({
      ...result,
      message: `成功写入 ${result.modules.length} 个学习模块，共 ${result.totalSections} 个章节。`,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "无法完成学习模块生成，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
