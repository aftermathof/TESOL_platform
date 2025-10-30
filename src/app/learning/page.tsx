import { getLearningModules } from "@/lib/dataService";
import { LearningWorkspace } from "./learningWorkspace";

export const dynamic = "force-static";

export default async function LearningPage() {
  const modules = await getLearningModules();

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">学习模块</h2>
      </header>
      <LearningWorkspace modules={modules} />
    </div>
  );
}
