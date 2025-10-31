import { LearningWorkspaceClient } from "./LearningWorkspaceClient";

export const dynamic = "force-static";

export default function LearningPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-hidden">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">学习模块</h2>
        <p className="text-sm text-zinc-500">
          按顺序完成每个模块的内容与学习任务，点击“完成学习”后才会记录进度。
        </p>
      </header>
      <LearningWorkspaceClient />
    </div>
  );
}
