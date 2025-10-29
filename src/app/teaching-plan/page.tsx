import { getTeachingPlanTemplate } from "@/lib/dataService";
import { TeachingPlanClient } from "./teachingPlanClient";

export const dynamic = "force-static";

export default async function TeachingPlanPage() {
  const template = await getTeachingPlanTemplate();
  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">
          Teaching Plan 提交与 AI 评分
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600">
          暂未接入真实大模型，本页面会调用 `/api/teaching-plan` 返回演示评分结果。
          所有密钥均需放置在 `.env` 中（例如 `OPENROUTE_API_KEY`）。
        </p>
      </header>
      <TeachingPlanClient template={template} />
    </div>
  );
}
