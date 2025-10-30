import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  moduleId: z.string(),
  sectionId: z.string(),
  text: z.string().min(10, "Selected text is too short for a useful summary."),
});

const OPENROUTE_MODEL =
  process.env.OPENROUTE_MODEL?.trim() || "gemini-2.0-flash";
const OPENROUTE_ENDPOINT =
  process.env.OPENROUTE_API_URL?.trim() ||
  "https://openrouter.ai/api/v1/chat/completions";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const parseResult = requestSchema.safeParse(payload);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid assistant payload", details: parseResult.error },
      { status: 400 }
    );
  }

  const { text } = parseResult.data;
  const apiKey = process.env.OPENROUTE_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json({
      model: OPENROUTE_MODEL,
      keyConfigured: false,
      summary: buildSummaryFallback(text),
      suggestions: buildSuggestionsFallback(text),
      warning: "OPENROUTE_API_KEY is not configured; returned fallback summary.",
    });
  }

  try {
    const response = await fetch(OPENROUTE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENROUTE_MODEL,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You analyse TESOL teaching materials. Return JSON with keys summary (<=200 chars) and suggestions (array of up to 3 short actionable bullet items).",
          },
          {
            role: "user",
            content: `Text:\n${text}\n\nRespond ONLY with JSON in the format {"summary":"...","suggestions":["..."]}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRoute responded with status ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    let parsed: { summary?: string; suggestions?: string[] } = {};
    if (content) {
      try {
        parsed = JSON.parse(content);
      } catch {
        // ignore parse error and fall back
      }
    }

    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : buildSummaryFallback(text);
    const suggestions =
      Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
        ? parsed.suggestions.map((item) => String(item)).slice(0, 3)
        : buildSuggestionsFallback(text);

    return NextResponse.json({
      model: OPENROUTE_MODEL,
      keyConfigured: true,
      summary,
      suggestions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        model: OPENROUTE_MODEL,
        keyConfigured: true,
        summary: buildSummaryFallback(text),
        suggestions: buildSuggestionsFallback(text),
        error:
          error instanceof Error ? error.message : "Failed to contact OpenRoute API",
      },
      { status: 200 }
    );
  }
}

function buildSummaryFallback(text: string) {
  const sentences =
    text
      .replace(/\s+/g, " ")
      .match(/[^.!?。！？]+[.!?。！？]?/g) ?? [];

  if (sentences.length === 0) {
    return "This passage highlights classroom strategies and learner experience.";
  }

  const preview = sentences.slice(0, 2).join(" ");
  return preview.length > 200
    ? `${preview.slice(0, 200)}...`
    : preview;
}

function buildSuggestionsFallback(text: string) {
  const suggestions = [
    "Link the idea back to your lesson objectives and success criteria.",
    "Plan differentiated follow-up tasks for varying proficiency levels.",
    "Capture learner reflections to iterate on the activity next time.",
  ];

  if (text.toLowerCase().includes("feedback")) {
    suggestions.unshift(
      "Prepare a structured feedback prompt to guide peer or self review."
    );
  }
  if (text.toLowerCase().includes("assessment")) {
    suggestions.unshift(
      "Integrate formative checks mid-lesson to adjust pacing in real time."
    );
  }
  if (/motivation|engage/i.test(text)) {
    suggestions.unshift(
      "Open with an energising warm-up to sustain learner engagement."
    );
  }

  return suggestions.slice(0, 3);
}

