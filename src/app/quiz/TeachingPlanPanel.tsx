"use client";

import { useState } from "react";
import type { TeachingPlanTemplate } from "@/data/mockData";

type AiFeedback =
  | {
      status: "loading" | "error";
      message: string;
    }
  | {
      status: "success";
      summary: string;
      suggestions: string[];
      keyConfigured: boolean;
      model: string;
      submittedExcerpt: string;
    };

export function TeachingPlanPanel({
  template,
}: {
  template: TeachingPlanTemplate;
}) {
  const [content, setContent] = useState(buildDraft(template));
  const [feedback, setFeedback] = useState<AiFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback({
      status: "loading",
      message: "Asking the AI reviewer…",
    });
    try {
      const response = await fetch("/api/teaching-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Submission failed, please try again.");
      }
      const data = await response.json();
      setFeedback({
        status: "success",
        summary: data.summary,
        suggestions: data.suggestions,
        keyConfigured: data.keyConfigured,
        model: data.model,
        submittedExcerpt: data.submittedExcerpt,
      });
    } catch (error) {
      setFeedback({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unexpected error when requesting AI feedback.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="teaching-plan"
      className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">
          Teaching Plan Submission
        </p>
        <h3 className="mt-2 text-xl font-semibold text-zinc-900">
          Draft your lesson plan and request instant AI feedback
        </h3>
        <p className="mt-2 text-sm text-zinc-600">
          The panel below shares the same page as the quiz so teachers can edit
          immediately after completing questions. AI feedback relies on
          OpenRoute (default model `gemini-2.0-flash`); configure your API key
          in `.env.local`.
        </p>
      </header>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <textarea
          className="min-h-[260px] w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            After submitting we will call `/api/teaching-plan` and display the
            AI response.
          </span>
          <button
            type="submit"
            className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
            disabled={submitting}
          >
            {submitting ? "Requesting..." : "Submit & Get Feedback"}
          </button>
        </div>
      </form>
      {feedback && <TeachingPlanFeedback feedback={feedback} />}
      <TemplateReference template={template} />
    </section>
  );
}

function TeachingPlanFeedback({ feedback }: { feedback: AiFeedback }) {
  if (feedback.status === "loading") {
    return (
      <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-700">
        {feedback.message}
      </div>
    );
  }
  if (feedback.status === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
        {feedback.message}
      </div>
    );
  }
  return (
    <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-sm text-emerald-800">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <p className="text-base font-semibold">
          AI Feedback · model {feedback.model}{" "}
          {feedback.keyConfigured ? "(API key configured)" : "(API key missing)"}
        </p>
        <p className="text-xs text-emerald-600">
          Submitted excerpt: {feedback.submittedExcerpt}
          {feedback.submittedExcerpt.length >= 160 ? "…" : ""}
        </p>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-emerald-900">Highlights</h4>
        <p className="mt-1 leading-6">{feedback.summary}</p>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-emerald-900">
          Suggestions
        </h4>
        <ul className="mt-1 list-disc pl-5 leading-6">
          {feedback.suggestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TemplateReference({ template }: { template: TeachingPlanTemplate }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-6 text-sm text-zinc-700">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Template Reference
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <TemplateColumn title="Objectives" items={template.objectives} />
        <TemplateColumn title="Steps" items={template.steps} numbered />
        <TemplateColumn title="Tips" items={template.tips} />
      </div>
    </div>
  );
}

function TemplateColumn({
  title,
  items,
  numbered = false,
}: {
  title: string;
  items: string[];
  numbered?: boolean;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-zinc-700">{title}</h4>
      {numbered ? (
        <ol className="mt-2 space-y-2 text-xs leading-5">
          {items.map((item, index) => (
            <li key={item} className="rounded-lg bg-white px-3 py-2">
              {index + 1}. {item}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="mt-2 space-y-2 text-xs leading-5">
          {items.map((item) => (
            <li key={item} className="rounded-lg bg-white px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildDraft(template: TeachingPlanTemplate) {
  return [
    "Lesson Title: Sharing Experiences with Present Perfect",
    "",
    "Objectives:",
    ...template.objectives.map((item) => `- ${item}`),
    "",
    "Procedure:",
    ...template.steps.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Differentiation Tips:",
    ...template.tips.map((item) => `- ${item}`),
  ].join("\n");
}
