import { NextResponse } from "next/server";
import { getTeachingPlanTemplate } from "@/lib/dataService";
import { z } from "zod";

const submissionSchema = z.object({
  content: z.string().min(20, "Teaching Plan content is too short."),
});

const OPENROUTE_MODEL =
  process.env.OPENROUTE_MODEL?.trim() || "gemini-2.0-flash";

export async function GET() {
  const template = await getTeachingPlanTemplate();
  return NextResponse.json({ template });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const parseResult = submissionSchema.safeParse(payload);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid teaching plan submission", details: parseResult.error },
      { status: 400 }
    );
  }

  const { content } = parseResult.data;
  const apiKey = process.env.OPENROUTE_API_KEY;

  // TODO: Integrate with real OpenRoute inference call when ready.
  const aiFeedback = {
    model: OPENROUTE_MODEL,
    keyConfigured: Boolean(apiKey),
    summary:
      "Teaching Plan received. Focus on incorporating more learner interaction checkpoints.",
    strengths: [
      "Clear lesson objectives linked to communicative outcomes.",
      "Logical sequencing from warm-up to production.",
    ],
    improvements: [
      "Add explicit differentiation strategies for varied proficiency levels.",
      "Plan a reflective exit ticket to capture learner takeaways.",
    ],
    submittedExcerpt: content.slice(0, 160),
  };

  return NextResponse.json(aiFeedback);
}
