import { LearningWorkspaceClient } from "./LearningWorkspaceClient";

export const dynamic = "force-static";

export default function LearningPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-hidden">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">Learning Modules</h2>
        <p className="text-sm text-zinc-500">
          Complete each module in sequence and mark it as done to record your progress.
        </p>
      </header>
      <LearningWorkspaceClient />
    </div>
  );
}
