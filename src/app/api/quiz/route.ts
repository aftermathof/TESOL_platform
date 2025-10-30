import { NextResponse } from "next/server";
import { getQuiz, scoreQuiz } from "@/lib/dataService";
import { z } from "zod";

const submissionSchema = z.object({
  answers: z.record(z.union([z.string(), z.array(z.string())])).default({}),
});

export async function GET() {
  const quiz = await getQuiz();
  return NextResponse.json({ quiz });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const parseResult = submissionSchema.safeParse(payload);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid quiz submission format", details: parseResult.error },
      { status: 400 }
    );
  }

  const { answers } = parseResult.data;
  const result = await scoreQuiz(answers);

  return NextResponse.json(result);
}
