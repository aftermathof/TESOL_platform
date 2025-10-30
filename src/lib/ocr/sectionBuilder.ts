import type { LearningSection } from "@/data/mockData";

export function buildSectionsFromOcrText(params: {
  moduleId: string;
  baseTitle: string;
  ocrText: string;
}): LearningSection[] {
  const paragraphs = params.ocrText
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [
      {
        id: `${params.moduleId}-section-1`,
        title: params.baseTitle,
        duration: "15 min",
        content:
          "暂无 OCR 文本，待管理员校对后发布。This placeholder will be replaced with real OCR output.",
      },
    ];
  }

  return paragraphs.map((paragraph, index) => ({
    id: `${params.moduleId}-section-${index + 1}`,
    title: index === 0 ? params.baseTitle : `${params.baseTitle} · Part ${index + 1}`,
    duration: `${Math.max(10, Math.min(25, Math.round(paragraph.length / 40)))} min`,
    content: paragraph,
  }));
}
