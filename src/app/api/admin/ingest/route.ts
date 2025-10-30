import { NextResponse } from "next/server";
import { z } from "zod";
import { requestBaiduOcr } from "@/lib/ocr/baiduClient";
import { buildSectionsFromOcrText } from "@/lib/ocr/sectionBuilder";
import { getSupabaseServiceClient } from "@/lib/supabaseServerClient";

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

  const supabase = getSupabaseServiceClient();
  const cacheKey = `${data.fileUrl}::${pageRange ? pageRange.join("-") : "all"}`;

  let ocrResult:
    | {
        text: string;
        confidence: number;
        pages: number[];
      }
    | null = null;

  if (supabase) {
    const { data: cached } = await supabase
      .from("learning_ocr_cache")
      .select("text, confidence, pages")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached) {
      ocrResult = {
        text: String(cached.text ?? ""),
        confidence: Number(cached.confidence ?? 1),
        pages: Array.isArray(cached.pages) ? cached.pages : [],
      };
    }
  }

  if (!ocrResult) {
    ocrResult = await requestBaiduOcr({
      fileUrl: data.fileUrl,
      pageRange,
    });

    if (supabase) {
      await supabase
        .from("learning_ocr_cache")
        .upsert(
          {
            cache_key: cacheKey,
            module_id: data.moduleId,
            file_url: data.fileUrl,
            page_start: pageRange ? pageRange[0] : null,
            page_end: pageRange ? pageRange[1] : null,
            text: ocrResult.text,
            confidence: ocrResult.confidence,
            pages: ocrResult.pages,
          },
          { onConflict: "cache_key" }
        )
        .catch(() => {
          // swallow cache write errors
        });
    }
  }

  const sections = buildSectionsFromOcrText({
    moduleId: data.moduleId,
    baseTitle: data.baseTitle,
    ocrText: ocrResult.text,
  });

  return NextResponse.json({
    moduleId: data.moduleId,
    sections,
    confidence: ocrResult.confidence,
    pages: ocrResult.pages,
    message: supabase
      ? "OCR completed and cached in Supabase for future reuse."
      : "OCR completed. Configure SUPABASE_SERVICE_ROLE_KEY to enable caching.",
  });
}
