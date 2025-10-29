"use client";

import { useState } from "react";
import type { TeachingPlanTemplate } from "@/data/mockData";

type AiFeedback = {
  model: string;
  keyConfigured: boolean;
  summary: string;
  strengths: string[];
  improvements: string[];
  submittedExcerpt: string;
};

export function TeachingPlanClient({
  template,
}: {
  template: TeachingPlanTemplate;
}) {
  const [content, setContent] = useState(buildDraft(template));
  const [feedback, setFeedback] = useState<AiFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFeedback(null);

    const response = await fetch("/api/teaching-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "提交失败，请稍后重试。");
    } else {
      const data = (await response.json()) as AiFeedback;
      setFeedback(data);
    }

    setSubmitting(false);
  }

  return (
    <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <form className="grid gap-6" onSubmit={handleSubmit}>
        <div className="grid gap-3">
          <label className="text-sm font-semibold text-zinc-700">
            Teaching Plan 草稿
          </label>
          <textarea
            className="min-h-[260px] w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <p className="text-xs text-zinc-500">
            表单提交后将调用 `/api/teaching-plan`，以演示方式返回 OpenRoute 模型的评分结果。
          </p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
            disabled={submitting}
          >
            {submitting ? "AI 评分中..." : "提交计划并获取 AI 反馈"}
          </button>
        </div>
      </form>
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-800">
          <p className="font-semibold">
            模型：{feedback.model} ·{" "}
            {feedback.keyConfigured ? "API Key 已配置" : "API Key 未配置（模拟返回）"}
          </p>
          <p className="mt-2 text-amber-700">{feedback.summary}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <FeedbackList title="亮点" items={feedback.strengths} />
            <FeedbackList title="可改进点" items={feedback.improvements} />
          </div>
          <p className="mt-4 text-xs text-amber-600">
            提交摘要：{feedback.submittedExcerpt}
            {feedback.submittedExcerpt.length >= 160 ? "..." : ""}
          </p>
        </div>
      )}
      <TemplateReference template={template} />
    </section>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        {title}
      </p>
      <ul className="mt-2 space-y-2 text-sm text-amber-700">
        {items.map((item) => (
          <li key={item} className="rounded-xl border border-amber-100 bg-white/70 p-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TemplateReference({ template }: { template: TeachingPlanTemplate }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-6 text-sm text-zinc-700">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        演示模板
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-700">教学目标</h4>
          <ul className="mt-2 space-y-2">
            {template.objectives.map((objective) => (
              <li key={objective} className="rounded-lg bg-white px-3 py-2 text-xs">
                {objective}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-700">教学步骤</h4>
          <ul className="mt-2 space-y-2">
            {template.steps.map((step) => (
              <li key={step} className="rounded-lg bg-white px-3 py-2 text-xs">
                {step}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-700">Tips</h4>
          <ul className="mt-2 space-y-2">
            {template.tips.map((tip) => (
              <li key={tip} className="rounded-lg bg-white px-3 py-2 text-xs">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
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
